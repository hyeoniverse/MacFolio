// 표 편집: 줄·칸 넣기와 지우기, 정렬, 표 안에서의 Enter·Tab.
// Markdown 표는 머리글 한 줄 + 본문 한 줄 이상이어야 해서, 그보다 줄이 적어지는 지우기는 막는다.
import type { Ctx } from '@milkdown/kit/ctx';
import { editorViewCtx } from '@milkdown/kit/core';
import { addRowAfterCommand, addRowBeforeCommand } from '@milkdown/kit/preset/gfm';
import type { Node } from '@milkdown/kit/prose/model';
import { NodeSelection, TextSelection, type EditorState } from '@milkdown/kit/prose/state';
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

/** 커서가 있는 표의 모양 (표 밖이면 null) */
export function tableStateOf(state: EditorState): TableState | null {
	if (!isInTable(state)) return null;
	const rect = selectedRect(state);
	const cell = rect.table.nodeAt(rect.map.map[rect.top * rect.map.width + rect.left]);
	const align = cell?.attrs.alignment;
	const cells = state.selection instanceof CellSelection ? state.selection : null;
	return {
		header: rect.top === 0,
		row: rect.top,
		col: rect.left,
		rows: rect.map.height - 1,
		cols: rect.map.width,
		align: align === 'center' || align === 'right' ? align : 'left',
		selectedRows: rect.bottom - rect.top,
		selectedCols: rect.right - rect.left,
		selecting: cells?.isColSelection() ? 'col' : cells?.isRowSelection() ? 'row' : null,
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
	command(view.state, view.dispatch);
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
	view.dispatch(tr.setSelection(CellSelection.rowSelection($cell)));
}

/** 칸 범위를 고른다: anchor 칸에서 head 칸까지 [행, 열] */
export function selectCells(view: EditorView, anchor: [number, number], head: [number, number]) {
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
	if (!selection.eq(view.state.selection)) view.dispatch(view.state.tr.setSelection(selection));
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
				state.tr.setSelection(
					op === 'selectRow' ? CellSelection.rowSelection($cell) : CellSelection.colSelection($cell)
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

/** 글자를 쓸 수 없는 블록 (Backspace 한 번에 지우지 않고 먼저 고른다) */
const SOLID_BLOCKS = ['table', 'image_block'];

/**
 * 표·이미지 바로 뒤 문단의 맨 앞에서 Backspace: 그 블록을 고른다 (한 번 더 누르면 지워진다).
 * 편집기 기본 동작은 빈 문단만 지우는데, 글 끝의 빈 문단은 늘 다시 생겨서 표를 지울 길이 없었다.
 */
function selectBlockBefore(view: EditorView) {
	const { selection } = view.state;
	if (!(selection instanceof TextSelection) || !selection.empty) return false;
	const { $from } = selection;
	if ($from.parentOffset !== 0 || $from.depth < 1) return false;
	const $block = view.state.doc.resolve($from.before());
	const before = $block.nodeBefore;
	if (!before || !SOLID_BLOCKS.includes(before.type.name)) return false;
	view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, $block.pos - before.nodeSize)));
	return true;
}

/**
 * 표의 첫 행에서 ↑, 마지막 행에서 ↓: 표 앞뒤에 글을 쓸 문단이 없으면 틈 커서를 둔다 (거기서 글을 쓰거나 Backspace로 표를 지운다)
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
 */
export function handleTableKey(ctx: Ctx, view: EditorView, event: KeyboardEvent): boolean {
	if (event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return false;
	if (event.key === 'Backspace' && selectBlockBefore(view)) return true;
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
