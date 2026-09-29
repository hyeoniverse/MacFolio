// 편집기 명령. Milkdown 명령과 ProseMirror 상태를 쓴다 (InlineEditor에서만 불러온다).
import type { Ctx } from '@milkdown/kit/ctx';
import { editorViewCtx } from '@milkdown/kit/core';
import { lift } from '@milkdown/kit/prose/commands';
import type { Node } from '@milkdown/kit/prose/model';
import { NodeSelection, TextSelection, type EditorState } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import {
	createCodeBlockCommand,
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
import { runTableOp, tableStateOf } from './tableCommands';
import { attachmentTitle } from './attachments';
import { blockOfHeading, EMPTY_FORMAT, HEADING_LEVEL, type FormatAction, type FormatState } from './editorControls';

/** 커서 자리의 서식 */
export function formatStateOf(state: EditorState): FormatState {
	const { $from, from, to, empty } = state.selection;
	const parent = $from.parent;
	const result: FormatState = {
		...EMPTY_FORMAT,
		table: tableStateOf(state),
		image: imageStateOf(state),
		marks: { ...EMPTY_FORMAT.marks },
	};
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

const IMAGE_NODES = ['image', 'image_block'];

/** 이미지를 골랐으면 그 속성 */
function imageStateOf(state: EditorState) {
	const { selection } = state;
	if (!(selection instanceof NodeSelection) || !IMAGE_NODES.includes(selection.node.type.name)) return null;
	const { src, alt, title } = selection.node.attrs as { src: string; alt: string; title: string };
	return { src, alt, title };
}

/** 이미지를 블록으로 넣는다. 빈 문단에 있으면 그 문단 자리에, 글 가운데면 문단을 나눠 그 사이에 */
function insertImage(view: EditorView, attrs: { src: string; alt: string; title: string }) {
	const { state } = view;
	const node = state.schema.nodes.image_block.create(attrs);
	const { $from } = state.selection;
	const tr = state.tr;
	if ($from.parent.type.name === 'paragraph' && $from.parent.content.size === 0 && $from.depth > 0)
		tr.replaceWith($from.before(), $from.after(), node);
	else tr.replaceSelectionWith(node);
	view.dispatch(tr.scrollIntoView());
}

/** 커서 앞에 끝나는 표의 수 */
const tablesBefore = (doc: Node, pos: number) => {
	let count = 0;
	doc.descendants((node, at) => {
		if (node.type.name === 'table' && at + node.nodeSize <= pos) count++;
		return node.type.name !== 'table';
	});
	return count;
};

/** 3×3 표를 넣고 머리글 첫 칸으로 커서를 옮긴다 (편집기 기본 명령은 커서를 표 앞에 남겨 둔다) */
function insertTable(ctx: Ctx) {
	const view = ctx.get(editorViewCtx);
	const index = tablesBefore(view.state.doc, view.state.selection.from);
	if (!callCommand(insertTableCommand.key, { row: 3, col: 3 })(ctx)) return;
	let seen = 0;
	let target: number | null = null;
	view.state.doc.descendants((node, pos) => {
		if (target !== null) return false;
		if (node.type.name !== 'table') return true;
		if (seen++ === index) target = pos;
		return false;
	});
	// 표 → 머리글 행 → 칸 → 문단 → 글자
	if (target !== null)
		view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, target + 4)).scrollIntoView());
}

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
			insertTable(ctx);
			break;
		case 'tableOp':
			runTableOp(ctx, action.op);
			break;
		case 'image':
			insertImage(view, { src: action.src, alt: action.alt, title: action.title ?? '' });
			break;
		case 'imageAttrs': {
			const { selection } = view.state;
			if (selection instanceof NodeSelection && IMAGE_NODES.includes(selection.node.type.name)) {
				const tr = view.state.tr.setNodeMarkup(selection.from, undefined, {
					...selection.node.attrs,
					alt: action.alt,
					title: action.title,
				});
				view.dispatch(tr.setSelection(NodeSelection.create(tr.doc, selection.from)));
			}
			break;
		}
		case 'attachment': {
			// 파일 이름 글자에 링크를 건다. 제목(title)으로 첨부 파일임을 표시해 읽기·편집 화면이 같은 모양으로 그린다
			const { state } = view;
			const link = state.schema.marks.link.create({ href: action.href, title: attachmentTitle(action.size) });
			view.dispatch(state.tr.replaceSelectionWith(state.schema.text(action.name, [link]), false).insertText(' '));
			break;
		}
	}
	view.focus();
}
