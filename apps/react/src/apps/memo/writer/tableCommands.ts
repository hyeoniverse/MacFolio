// 표 편집: 줄·칸 넣기와 지우기, 정렬, 표 안에서의 Enter·Tab.
// Markdown 표는 머리글 한 줄 + 본문 한 줄 이상이어야 해서, 그보다 줄이 적어지는 지우기는 막는다.
import type { Ctx } from '@milkdown/kit/ctx';
import { editorViewCtx } from '@milkdown/kit/core';
import { addRowAfterCommand, addRowBeforeCommand } from '@milkdown/kit/preset/gfm';
import { Fragment, Slice, type Node } from '@milkdown/kit/prose/model';
import {
	NodeSelection,
	Plugin,
	PluginKey,
	Selection,
	TextSelection,
	type EditorState,
	type Transaction,
} from '@milkdown/kit/prose/state';
import { GapCursor } from '@milkdown/kit/prose/gapcursor';
import {
	CellSelection,
	addColumnAfter,
	addColumnBefore,
	deleteColumn,
	deleteRow,
	deleteTable,
	findTable,
	isInTable,
	moveTableColumn,
	moveTableRow,
	selectedRect,
	TableMap,
} from '@milkdown/kit/prose/tables';
import type { EditorView } from '@milkdown/kit/prose/view';
import { callCommand } from '@milkdown/kit/utils';
import type { TableAlign, TableOp, TableState } from './editorControls';
import { canRunTableOp } from './tableRules';

/**
 * 고른 칸이 손잡이(손잡이 누르기, 꼭짓점 끌기, 행·열 옮기기)로 고른 것인지 기억한다.
 * 칸을 마우스로 끌어 고르면 손잡이와 테두리 없이 고른 칸만 보여 준다.
 */
const handleSelectionKey = new PluginKey<boolean>('memoTableHandleSelection');

export const tableHandleSelection = new Plugin<boolean>({
	key: handleSelectionKey,
	state: {
		init: () => false,
		apply: (tr, current) => {
			const meta = tr.getMeta(handleSelectionKey) as boolean | undefined;
			if (meta !== undefined) return meta;
			return tr.selectionSet ? false : current;
		},
	},
});

/** 틈 커서 자리에 빈 문단을 넣고 그 안에 커서를 둔다 (넣을 수 없는 자리면 null) */
function paragraphAtGap(state: EditorState) {
	const { $from } = state.selection;
	const wrapping = $from.parent.contentMatchAt($from.index()).findWrapping(state.schema.nodes.text);
	if (!wrapping) return null;
	let fragment = Fragment.empty;
	for (let i = wrapping.length - 1; i >= 0; i--) fragment = Fragment.from(wrapping[i].createAndFill(null, fragment));
	const tr = state.tr.replace($from.pos, $from.pos, new Slice(fragment, 0, 0));
	return tr.setSelection(TextSelection.near(tr.doc.resolve($from.pos + 1)));
}

/**
 * 틈 커서(표 옆 등)에서 글을 쓰면 그 자리에 새 문단을 만들어 쓴다.
 * prosemirror-gapcursor는 한글 조합 입력에만 이렇게 해서, 옆에 문단이 있는 자리에서는 친 글자가 사라졌다.
 */
export const gapTyping = new Plugin({
	props: {
		handleTextInput: (view, _from, _to, text) => {
			if (!(view.state.selection instanceof GapCursor)) return false;
			const tr = paragraphAtGap(view.state);
			if (!tr) return false;
			view.dispatch(tr.insertText(text).scrollIntoView());
			return true;
		},
		handleDOMEvents: {
			// 조합 입력·붙여 넣지 않은 글자 입력: 문단만 만들고 글자는 브라우저가 그 안에 넣게 둔다
			beforeinput: (view, event) => {
				if (!(view.state.selection instanceof GapCursor) || !event.inputType.startsWith('insert')) return false;
				if (event.inputType === 'insertParagraph' || event.inputType === 'insertFromPaste') return false;
				const tr = paragraphAtGap(view.state);
				if (tr) view.dispatch(tr);
				return false;
			},
		},
	},
});

/** (x, y)가 표 양옆이면 그쪽 틈 커서 자리 (표 앞·뒤), 아니면 null */
function gapBesideTableAt(view: EditorView, x: number, y: number) {
	let gap: number | null = null;
	view.state.doc.forEach((node, offset) => {
		if (gap !== null || node.type.name !== 'table') return;
		const dom = view.nodeDOM(offset);
		if (!(dom instanceof HTMLElement)) return;
		const rect = dom.getBoundingClientRect();
		if (y < rect.top || y > rect.bottom) return;
		if (x >= rect.right) gap = offset + node.nodeSize;
		else if (x <= rect.left) gap = offset;
	});
	return gap;
}

function placeGap(view: EditorView, pos: number) {
	view.dispatch(view.state.tr.setSelection(new GapCursor(view.state.doc.resolve(pos))));
	view.focus();
}

/**
 * 표 양옆을 누르면 그쪽에 틈 커서를 둔다 (←·→로 가는 자리와 같다).
 * 표 옆은 문단이 아니라서, 누르면 편집기가 가까운 칸이나 문단으로 커서를 옮겨 버렸다.
 * 표가 편집기 폭을 다 쓰면 표 옆은 편집기 밖(본문의 여백)이라, 여백을 누른 것도 본다.
 */
export const gapClick = new Plugin({
	props: {
		handleClick: (view, _pos, event) => {
			const gap = gapBesideTableAt(view, event.clientX, event.clientY);
			if (gap === null) return false;
			placeGap(view, gap);
			return true;
		},
	},
	view: (view) => {
		const area = view.dom.closest('.memo-scroll') ?? view.dom.parentElement;
		const onDown = (event: Event) => {
			const mouse = event as MouseEvent;
			if (mouse.button !== 0 || view.dom.contains(mouse.target as globalThis.Node)) return;
			const gap = gapBesideTableAt(view, mouse.clientX, mouse.clientY);
			if (gap === null) return;
			// 여백을 눌러 편집기의 초점이 빠지지 않게
			mouse.preventDefault();
			placeGap(view, gap);
		};
		area?.addEventListener('mousedown', onDown);
		return { destroy: () => area?.removeEventListener('mousedown', onDown) };
	},
});

/** 손잡이로 고르는 변경이라고 표시한다 */
const byHandle = (tr: Transaction) => tr.setMeta(handleSelectionKey, true);

/** 커서가 있는 표의 모양 (표 밖이면 null) */
export function tableStateOf(state: EditorState): TableState | null {
	if (!isInTable(state)) return null;
	const rect = selectedRect(state);
	const cell = rect.table.nodeAt(rect.map.map[rect.top * rect.map.width + rect.left]);
	const align = cell?.attrs.alignment;
	const cells = state.selection instanceof CellSelection ? state.selection : null;
	const dragged = Boolean(cells) && !handleSelectionKey.getState(state);
	return {
		header: rect.top === 0,
		row: rect.top,
		col: rect.left,
		rows: rect.map.height - 1,
		cols: rect.map.width,
		align: align === 'center' || align === 'right' ? align : 'left',
		selectedRows: rect.bottom - rect.top,
		selectedCols: rect.right - rect.left,
		selecting: dragged ? null : cells?.isColSelection() ? 'col' : cells?.isRowSelection() ? 'row' : null,
		dragged,
	};
}

/**
 * 행·열 옮기기. Markdown 표는 첫 행이 늘 머리글이라, 행이 첫 자리로 오가면 표를 다시 짜서
 * 새로 첫 행이 된 행을 머리글로, 밀려난 머리글을 보통 행으로 바꾼다.
 */
export function moveTablePart(view: EditorView, kind: 'row' | 'col', from: number, to: number) {
	if (from === to) return;
	if (kind === 'row' && (from === 0 || to === 0)) return moveRowAcrossHeader(view, from, to);
	const pos = view.state.selection.from;
	const command = kind === 'row' ? moveTableRow({ from, to, pos }) : moveTableColumn({ from, to, pos });
	command(view.state, (tr) => view.dispatch(byHandle(tr)));
}

function moveRowAcrossHeader(view: EditorView, from: number, to: number) {
	const { state } = view;
	const table = findTable(state.selection.$from);
	if (!table) return;
	const { table_header_row, table_row, table_header, table_cell } = state.schema.nodes;
	const rows: Node[] = [];
	table.node.forEach((row) => rows.push(row));
	const [moved] = rows.splice(from, 1);
	rows.splice(to, 0, moved);
	const rebuilt = rows.map((row, index) => {
		const cells: Node[] = [];
		row.forEach((cell) => cells.push((index === 0 ? table_header : table_cell).create(cell.attrs, cell.content)));
		return (index === 0 ? table_header_row : table_row).create(null, cells);
	});
	const next = table.node.type.create(table.node.attrs, rebuilt);
	const tr = state.tr.replaceWith(table.pos, table.pos + table.node.nodeSize, next);
	// 옮긴 행을 계속 고른 채로
	const map = TableMap.get(next);
	const $cell = tr.doc.resolve(table.pos + 1 + map.map[to * map.width]);
	view.dispatch(byHandle(tr.setSelection(CellSelection.rowSelection($cell))));
}

/** 칸 범위를 고른다: anchor 칸에서 head 칸까지 [행, 열]. viaHandle이 false면 끌어 고른 범위로 남긴다 */
export function selectCells(view: EditorView, anchor: [number, number], head: [number, number], viaHandle = true) {
	const table = findTable(view.state.selection.$from);
	if (!table) return;
	const map = TableMap.get(table.node);
	const clamp = ([row, col]: [number, number]) => [
		Math.max(0, Math.min(row, map.height - 1)),
		Math.max(0, Math.min(col, map.width - 1)),
	];
	const pos = (cell: [number, number]) => {
		const [row, col] = clamp(cell);
		return table.start + map.map[row * map.width + col];
	};
	const selection = CellSelection.create(view.state.doc, pos(anchor), pos(head));
	if (selection.eq(view.state.selection)) return;
	const tr = view.state.tr.setSelection(selection);
	view.dispatch(viaHandle ? byHandle(tr) : tr.setMeta(handleSelectionKey, false));
}

export function runTableOp(ctx: Ctx, op: TableOp) {
	const view = ctx.get(editorViewCtx);
	const table = tableStateOf(view.state);
	if (!table || !canRunTableOp(table, op)) return;
	const { state, dispatch } = view;
	switch (op) {
		case 'rowBefore':
			callCommand(addRowBeforeCommand.key)(ctx);
			break;
		case 'rowAfter':
			callCommand(addRowAfterCommand.key)(ctx);
			break;
		case 'colBefore':
			addColumnBefore(state, dispatch);
			break;
		case 'colAfter':
			addColumnAfter(state, dispatch);
			break;
		case 'deleteRow':
			deleteRow(state, dispatch);
			break;
		case 'deleteCol':
			deleteColumn(state, dispatch);
			break;
		case 'deleteTable':
			deleteTable(state, dispatch);
			break;
		case 'selectRow':
		case 'selectCol': {
			// 지금 칸이 있는 행·열 전체를 고른다 (Backspace로 칸을 비우거나, 손잡이 메뉴로 지운다)
			const rect = selectedRect(state);
			const $cell = state.doc.resolve(rect.tableStart + rect.map.map[rect.top * rect.map.width + rect.left]);
			dispatch(
				byHandle(
					state.tr.setSelection(
						op === 'selectRow' ? CellSelection.rowSelection($cell) : CellSelection.colSelection($cell)
					)
				)
			);
			break;
		}
		default:
			// 정렬은 칸 하나가 아니라 그 열 전체에 (Markdown 표의 정렬은 열 단위)
			alignColumn(view, op);
	}
}

function alignColumn(view: EditorView, align: TableAlign) {
	const rect = selectedRect(view.state);
	const { tr } = view.state;
	for (let row = 0; row < rect.map.height; row++) {
		for (let col = rect.left; col < rect.right; col++) {
			const pos = rect.tableStart + rect.map.map[row * rect.map.width + col];
			const cell = tr.doc.nodeAt(pos);
			if (cell) tr.setNodeMarkup(pos, undefined, { ...cell.attrs, alignment: align });
		}
	}
	view.dispatch(tr);
}

/**
 * 표·이미지 바로 뒤 문단의 맨 앞에서 Backspace (표 뒤 틈 커서에서도):
 * - 표는 바로 지운다
 * - 이미지는 먼저 고른다 (한 번 더 누르면 지워진다. 이미지는 고른 모양이 보여서 무엇을 지울지 알 수 있다)
 * 편집기 기본 동작은 빈 문단만 지우는데, 글 끝의 빈 문단은 늘 다시 생겨서 표를 지울 길이 없었다.
 */
function removeBlockBefore(view: EditorView) {
	const { state } = view;
	const { selection } = state;
	let $block;
	if (selection instanceof GapCursor) $block = selection.$from;
	else if (selection instanceof TextSelection && selection.empty) {
		const { $from } = selection;
		if ($from.parentOffset !== 0 || $from.depth < 1) return false;
		$block = state.doc.resolve($from.before());
	} else return false;
	const before = $block.nodeBefore;
	if (!before) return false;
	const start = $block.pos - before.nodeSize;
	if (before.type.name === 'table') {
		view.dispatch(state.tr.delete(start, $block.pos).scrollIntoView());
		return true;
	}
	if (before.type.name !== 'image_block') return false;
	view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, start)));
	return true;
}

/** 표 앞 틈 커서에서 Delete: 표를 지운다 */
function removeTableAfter(view: EditorView) {
	const { state } = view;
	const { selection } = state;
	if (!(selection instanceof GapCursor)) return false;
	const after = selection.$from.nodeAfter;
	if (after?.type.name !== 'table') return false;
	view.dispatch(state.tr.delete(selection.from, selection.from + after.nodeSize).scrollIntoView());
	return true;
}

/**
 * 표의 첫 행에서 ↑, 마지막 행에서 ↓: 표 앞뒤에 글을 쓸 문단이 없으면 틈 커서를 둔다 (거기서 글을 쓰거나 Backspace·Delete로 표를 지운다)
 */
function gapAroundTable(view: EditorView, direction: -1 | 1) {
	const { state } = view;
	if (!isInTable(state) || !state.selection.empty) return false;
	const rect = selectedRect(state);
	if (direction === -1 ? rect.top !== 0 : rect.bottom !== rect.map.height) return false;
	const table = findTable(state.selection.$from);
	if (!table) return false;
	const $gap = state.doc.resolve(direction === -1 ? table.pos : table.pos + table.node.nodeSize);
	const neighbor = direction === -1 ? $gap.nodeBefore : $gap.nodeAfter;
	if (neighbor?.isTextblock) return false;
	view.dispatch(state.tr.setSelection(new GapCursor($gap)).scrollIntoView());
	return true;
}

/**
 * 행·열 전체를 고르고 Backspace·Delete: 고른 칸에 글이 있으면 먼저 비우고(편집기 기본), 다 빈 칸이면 그 행·열을 지운다.
 * 표 전체를 골랐으면 표를 지운다. Markdown 표라 머리글 행과 마지막 본문 행은 남긴다.
 */
function deleteEmptyLines(view: EditorView) {
	const { selection } = view.state;
	if (!(selection instanceof CellSelection)) return false;
	const cols = selection.isColSelection();
	const rows = selection.isRowSelection();
	if (!cols && !rows) return false;
	let empty = true;
	selection.forEachCell((cell) => {
		if (cell.textContent || cell.firstChild?.childCount) empty = false;
	});
	if (!empty) return false;
	const { state, dispatch } = view;
	if (cols && rows) return deleteTable(state, dispatch);
	const table = tableStateOf(state);
	if (!table) return false;
	const op: TableOp = cols ? 'deleteCol' : 'deleteRow';
	// 지울 수 없는 행(머리글, 마지막 본문 행)이면 아무것도 하지 않는다 (이미 빈 칸이다)
	if (!canRunTableOp(table, op)) return true;
	return cols ? deleteColumn(state, dispatch) : deleteRow(state, dispatch);
}

/**
 * ←·→로 표 양옆에 커서를 둔다 (macOS 메모처럼). 표 앞은 표 왼쪽, 표 뒤는 표 오른쪽에 세로 커서로 보인다.
 * - 첫 칸 맨 앞에서 ← → 표 앞, 마지막 칸 맨 끝에서 → → 표 뒤
 * - 표 바로 뒤 문단의 맨 앞에서 ← → 표 뒤, 표 바로 앞 문단의 맨 끝에서 → → 표 앞
 * - 표 옆에서 한 번 더 누르면 그쪽으로 (표 안의 칸이나 옆 문단)
 * 거기서 글을 쓰면 표 앞뒤에 새 문단이 생기고, 표 뒤에서 Backspace(표 앞에서 Delete)를 누르면 표를 지운다.
 */
function gapBesideTable(view: EditorView, direction: -1 | 1) {
	const { state } = view;
	const { selection } = state;
	const isTable = (node: Node | null | undefined) => node?.type.name === 'table';
	const gapAt = (pos: number) => {
		view.dispatch(state.tr.setSelection(new GapCursor(state.doc.resolve(pos))).scrollIntoView());
		return true;
	};
	// 표 옆의 틈 커서에서: 누른 쪽의 가장 가까운 글자 자리로
	if (selection instanceof GapCursor) {
		const { $from } = selection;
		if (!isTable($from.nodeBefore) && !isTable($from.nodeAfter)) return false;
		const next = Selection.findFrom($from, direction, true);
		if (next) view.dispatch(state.tr.setSelection(next).scrollIntoView());
		return true;
	}
	if (!(selection instanceof TextSelection) || !selection.empty) return false;
	const { $from } = selection;
	const atEdge = direction === -1 ? $from.parentOffset === 0 : $from.parentOffset === $from.parent.content.size;
	if (!atEdge) return false;
	if (isInTable(state)) {
		const rect = selectedRect(state);
		const first = rect.top === 0 && rect.left === 0;
		const last = rect.bottom === rect.map.height && rect.right === rect.map.width;
		const table = findTable($from);
		if (!table || (direction === -1 ? !first : !last)) return false;
		return gapAt(direction === -1 ? table.pos : table.pos + table.node.nodeSize);
	}
	// 표 바로 옆 문단의 끝에서 표 쪽으로
	if ($from.depth < 1) return false;
	const $block = state.doc.resolve(direction === -1 ? $from.before() : $from.after());
	if (!isTable(direction === -1 ? $block.nodeBefore : $block.nodeAfter)) return false;
	return gapAt($block.pos);
}

/** 표 안의 (줄, 칸) 칸 첫 글자로 커서를 옮긴다 */
function moveToCell(view: EditorView, tableNode: Node, tableStart: number, row: number, col: number) {
	const map = TableMap.get(tableNode);
	const pos = tableStart + map.map[row * map.width + col];
	// 칸(pos) → 문단(pos + 1) → 글자(pos + 2)
	view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos + 2)).scrollIntoView());
}

/**
 * 표 안의 키 (편집기 기본 동작보다 먼저):
 * - Enter: 아래 칸으로. 마지막 줄이면 줄을 하나 넣는다 (Markdown 칸 안에서는 줄을 바꿀 수 없다)
 * - Tab: 마지막 칸에서 누르면 줄을 넣고 새 줄 첫 칸으로 (그 밖의 Tab·Shift+Tab은 편집기가 칸을 옮긴다)
 * - ⌘Enter: 표 밖으로 (편집기 기본)
 * - Backspace·Delete: 행·열 전체를 골랐고 칸이 다 비었으면 그 행·열을 지운다
 * - ←·→: 표 양옆에 틈 커서 (gapBesideTable)
 */
export function handleTableKey(ctx: Ctx, view: EditorView, event: KeyboardEvent): boolean {
	if (event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return false;
	if (event.key === 'Backspace' && removeBlockBefore(view)) return true;
	if (event.key === 'Delete' && removeTableAfter(view)) return true;
	if ((event.key === 'Backspace' || event.key === 'Delete') && deleteEmptyLines(view)) return true;
	if (
		(event.key === 'ArrowLeft' || event.key === 'ArrowRight') &&
		gapBesideTable(view, event.key === 'ArrowLeft' ? -1 : 1)
	)
		return true;
	if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && gapAroundTable(view, event.key === 'ArrowUp' ? -1 : 1))
		return true;
	if (!isInTable(view.state)) return false;
	const isEnter = event.key === 'Enter' && !event.shiftKey;
	const isTab = event.key === 'Tab' && !event.shiftKey;
	if (!isEnter && !isTab) return false;

	const rect = selectedRect(view.state);
	const lastRow = rect.bottom === rect.map.height;
	if (isTab && !(lastRow && rect.right === rect.map.width)) return false;

	const row = rect.bottom;
	const col = isTab ? 0 : rect.left;
	if (lastRow) callCommand(addRowAfterCommand.key)(ctx);
	const table = findTable(view.state.selection.$from);
	if (!table) return true;
	moveToCell(view, table.node, table.start, row, col);
	return true;
}
