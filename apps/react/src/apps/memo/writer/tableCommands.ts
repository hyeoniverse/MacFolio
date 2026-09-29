// 표 편집: 줄·칸 넣기와 지우기, 정렬, 표 안에서의 Enter·Tab.
// Markdown 표는 머리글 한 줄 + 본문 한 줄 이상이어야 해서, 그보다 줄이 적어지는 지우기는 막는다.
import type { Ctx } from '@milkdown/kit/ctx';
import { editorViewCtx } from '@milkdown/kit/core';
import { addRowAfterCommand, addRowBeforeCommand } from '@milkdown/kit/preset/gfm';
import type { Node } from '@milkdown/kit/prose/model';
import { TextSelection, type EditorState } from '@milkdown/kit/prose/state';
import {
	addColumnAfter,
	addColumnBefore,
	deleteColumn,
	deleteRow,
	deleteTable,
	findTable,
	isInTable,
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
	const cell = state.selection.$from.node(-1);
	const align = cell?.attrs.alignment;
	return {
		header: rect.top === 0,
		rows: rect.map.height - 1,
		cols: rect.map.width,
		align: align === 'center' || align === 'right' ? align : 'left',
	};
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
	if (event.isComposing || event.metaKey || event.ctrlKey || event.altKey || !isInTable(view.state)) return false;
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
