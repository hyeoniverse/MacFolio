// 편집기 명령. Milkdown 명령과 ProseMirror 상태를 쓴다 (InlineEditor에서만 불러온다).
import type { Ctx } from '@milkdown/kit/ctx';
import { editorViewCtx } from '@milkdown/kit/core';
import { lift } from '@milkdown/kit/prose/commands';
import type { EditorState } from '@milkdown/kit/prose/state';
import {
	createCodeBlockCommand,
	insertImageCommand,
	liftListItemCommand,
	toggleEmphasisCommand,
	toggleInlineCodeCommand,
	toggleStrongCommand,
	turnIntoTextCommand,
	wrapInBlockquoteCommand,
	wrapInBulletListCommand,
	wrapInHeadingCommand,
	wrapInOrderedListCommand,
} from '@milkdown/kit/preset/commonmark';
import { insertTableCommand, toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm';
import { callCommand } from '@milkdown/kit/utils';
import { blockOfHeading, EMPTY_FORMAT, HEADING_LEVEL, type FormatAction, type FormatState } from './editorControls';

/** 커서 자리의 서식 */
export function formatStateOf(state: EditorState): FormatState {
	const { $from, from, to, empty } = state.selection;
	const parent = $from.parent;
	const result: FormatState = { ...EMPTY_FORMAT, marks: { ...EMPTY_FORMAT.marks } };
	if (parent.type.name === 'heading') result.block = blockOfHeading(parent.attrs.level as number);
	else if (parent.type.name === 'code_block') result.block = 'mono';

	for (let depth = $from.depth; depth > 0; depth--) {
		const node = $from.node(depth);
		const name = node.type.name;
		if (name === 'blockquote') result.quote = true;
		if (!result.list && name === 'list_item' && node.attrs.checked != null) result.list = 'task';
		if (!result.list && name === 'bullet_list') result.list = 'bullet';
		if (!result.list && name === 'ordered_list') result.list = 'ordered';
	}

	const has = (markName: string) => {
		const type = state.schema.marks[markName];
		if (!type) return false;
		return empty ? Boolean(type.isInSet(state.storedMarks ?? $from.marks())) : state.doc.rangeHasMark(from, to, type);
	};
	result.marks = {
		strong: has('strong'),
		emphasis: has('emphasis'),
		strike: has('strike_through'),
		code: has('inlineCode'),
	};
	return result;
}

/** 커서가 있는 목록 항목 (없으면 null) */
function listItemAt(state: EditorState) {
	const { $from } = state.selection;
	for (let depth = $from.depth; depth > 0; depth--) {
		if ($from.node(depth).type.name === 'list_item') return { pos: $from.before(depth), node: $from.node(depth) };
	}
	return null;
}

/** 목록 항목을 체크 항목으로(또는 체크 항목을 보통 항목으로) */
function setTask(ctx: Ctx, checked: boolean | null) {
	const view = ctx.get(editorViewCtx);
	const item = listItemAt(view.state);
	if (!item) return;
	view.dispatch(view.state.tr.setNodeMarkup(item.pos, undefined, { ...item.node.attrs, checked }));
}

/** 목록에서 빠져나온다 (여러 단이면 한 단씩) */
const leaveList = (ctx: Ctx) => {
	while (listItemAt(ctx.get(editorViewCtx).state)) {
		if (!callCommand(liftListItemCommand.key)(ctx)) break;
	}
};

/** 도구 막대의 명령을 실행한다. 이미 그 서식이면 푼다 (macOS 메모처럼 누를 때마다 켜고 끈다) */
export function runFormat(ctx: Ctx, action: FormatAction) {
	const view = ctx.get(editorViewCtx);
	const current = formatStateOf(view.state);

	switch (action.type) {
		case 'mark': {
			const command = {
				strong: toggleStrongCommand,
				emphasis: toggleEmphasisCommand,
				strike: toggleStrikethroughCommand,
				code: toggleInlineCodeCommand,
			}[action.mark];
			callCommand(command.key)(ctx);
			break;
		}
		case 'block': {
			if (action.block === 'body' || current.block === action.block) callCommand(turnIntoTextCommand.key)(ctx);
			else if (action.block === 'mono') callCommand(createCodeBlockCommand.key)(ctx);
			else callCommand(wrapInHeadingCommand.key, HEADING_LEVEL[action.block])(ctx);
			break;
		}
		case 'list': {
			if (current.list === action.list) {
				if (action.list === 'task') setTask(ctx, null);
				else leaveList(ctx);
				break;
			}
			if (action.list === 'task') {
				if (current.list !== 'bullet') {
					leaveList(ctx);
					callCommand(wrapInBulletListCommand.key)(ctx);
				}
				setTask(ctx, false);
				break;
			}
			leaveList(ctx);
			callCommand((action.list === 'bullet' ? wrapInBulletListCommand : wrapInOrderedListCommand).key)(ctx);
			break;
		}
		case 'quote': {
			if (current.quote) lift(view.state, view.dispatch);
			else callCommand(wrapInBlockquoteCommand.key)(ctx);
			break;
		}
		case 'table':
			callCommand(insertTableCommand.key, { row: 3, col: 3 })(ctx);
			break;
		case 'image':
			callCommand(insertImageCommand.key, { src: action.src, alt: action.alt })(ctx);
			break;
	}
	view.focus();
}
