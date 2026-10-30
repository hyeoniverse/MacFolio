// 편집기 명령. Milkdown 명령과 ProseMirror 상태를 쓴다 (InlineEditor에서만 불러온다).
import type { Ctx } from '@milkdown/kit/ctx';
import { mediaKindOf } from '@macfolio/desktop-core/memo';
import { editorViewCtx } from '@milkdown/kit/core';
import { lift } from '@milkdown/kit/prose/commands';
import type { Node } from '@milkdown/kit/prose/model';
import { NodeSelection, TextSelection, type EditorState } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import {
	createCodeBlockCommand,
	liftListItemCommand,
	sinkListItemCommand,
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
import { moveTablePart, runTableOp, selectCells, tableStateOf } from './tableCommands';
import { clearFind, replaceFind, setFind } from './findPlugin';
import { attachmentTitle } from './attachments';
import { detailsAt, toggleDetails } from './details';
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
		details: detailsAt(state) !== null,
		summary: parent.type.name === 'details_summary',
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

/** 커서가 있는 문단(목록이면 그 항목, 인용·토글 안이면 그 안의 문단)을 위·아래 이웃 블록과 맞바꾼다 */
function moveBlock(view: EditorView, dir: 'up' | 'down') {
	const { state } = view;
	const { $from } = state.selection;
	// 목록 항목이 있으면 가장 안쪽 항목, 없으면 글의 맨 위 블록
	let depth = 1;
	for (let d = $from.depth; d > 0; d--) {
		if ($from.node(d).type.name === 'list_item') {
			depth = d;
			break;
		}
	}
	if ($from.depth < depth) return;
	const parent = $from.node(depth - 1);
	const index = $from.index(depth - 1);
	const other = dir === 'up' ? index - 1 : index + 1;
	if (other < 0 || other >= parent.childCount) return;
	const node = $from.node(depth);
	const sibling = parent.child(other);
	const start = $from.before(depth);
	const offset = state.selection.from - start;
	const tr = state.tr;
	if (dir === 'up') {
		const siblingStart = start - sibling.nodeSize;
		tr.delete(start, start + node.nodeSize).insert(siblingStart, node);
		tr.setSelection(TextSelection.create(tr.doc, siblingStart + offset));
	} else {
		const end = start + node.nodeSize;
		tr.delete(end, end + sibling.nodeSize).insert(start, sibling);
		tr.setSelection(TextSelection.create(tr.doc, start + sibling.nodeSize + offset));
	}
	view.dispatch(tr.scrollIntoView());
}

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

/** 아직 쓰지 않은 가장 작은 각주 번호 */
export function nextFootnoteLabel(labels: Iterable<string>) {
	const used = new Set(labels);
	let label = 1;
	while (used.has(String(label))) label++;
	return String(label);
}

/**
 * 각주: 커서 자리(고른 글이 있으면 그 뒤)에 번호를 넣고, 글 끝에 같은 번호의 각주 내용을 만들어 그리로 간다.
 * 읽기 화면은 GFM 규칙대로 본문에 나온 차례로 번호를 다시 매긴다
 */
function insertFootnote(view: EditorView) {
	const { state } = view;
	const { schema } = state;
	const labels: string[] = [];
	state.doc.descendants((node) => {
		if (node.type.name === 'footnote_reference' || node.type.name === 'footnote_definition')
			labels.push(node.attrs.label as string);
	});
	const label = nextFootnoteLabel(labels);
	const tr = state.tr.insert(state.selection.to, schema.nodes.footnote_reference.create({ label }));
	// 글 끝의 빈 문단(편집기가 늘 남겨 두는 줄) 앞에 넣는다. 뒤에 넣으면 그 빈 문단이 글 가운데에 남아 <br />로 저장된다
	const last = tr.doc.lastChild;
	const end = tr.doc.content.size - (last?.type.name === 'paragraph' && last.content.size === 0 ? last.nodeSize : 0);
	tr.insert(end, schema.nodes.footnote_definition.create({ label }, schema.nodes.paragraph.create()));
	// 각주 내용 → 문단 → 글자
	view.dispatch(tr.setSelection(TextSelection.create(tr.doc, end + 2)).scrollIntoView());
}

/** 도구 막대의 명령을 실행한다. 이미 그 서식이면 푼다 (macOS 메모처럼 누를 때마다 켜고 끈다) */
export function runFormat(ctx: Ctx, action: FormatAction) {
	const view = ctx.get(editorViewCtx);
	// 찾기·대치는 찾기 칸에 초점을 둔 채로 한다 (편집기로 초점을 옮기지 않는다)
	if (action.type === 'find') return setFind(view, action.query, action.options, action.index);
	if (action.type === 'findClear') return clearFind(view);
	if (action.type === 'replace') return replaceFind(view, action.replacement, action.all);
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
			// macOS 메모처럼 한 줄에 모양은 하나: 목록이나 토글 제목에서 고르면 그 줄을 꺼내 고른 모양으로 바꾼다
			const converted = current.summary || current.list !== null;
			if (current.summary) toggleDetails(view);
			else if (current.list) leaveList(ctx);
			if (action.block === 'body' || (!converted && current.block === action.block)) {
				if (!converted || action.block !== 'body') callCommand(turnIntoTextCommand.key)(ctx);
			} else if (action.block === 'mono') callCommand(createCodeBlockCommand.key)(ctx);
			else callCommand(wrapInHeadingCommand.key, HEADING_LEVEL[action.block])(ctx);
			break;
		}
		case 'list': {
			// 토글 제목은 토글을 풀고, 머리말은 본문으로 바꾼 뒤 목록으로 (목록 항목의 첫 줄은 본문이다)
			if (current.summary) toggleDetails(view);
			else if (current.list === null && current.block !== 'body') callCommand(turnIntoTextCommand.key)(ctx);
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
			if (current.summary) toggleDetails(view);
			if (current.quote) lift(view.state, view.dispatch);
			else callCommand(wrapInBlockquoteCommand.key)(ctx);
			break;
		}
		case 'indent':
			callCommand((action.dir === 'in' ? sinkListItemCommand : liftListItemCommand).key)(ctx);
			break;
		case 'moveBlock':
			moveBlock(view, action.dir);
			break;
		case 'details':
			// 표 칸에는 블록을 넣을 수 없다
			if (current.table) break;
			// 목록 항목은 목록에서 꺼내 토글로 (한 줄에 모양은 하나)
			if (!current.details && current.list) leaveList(ctx);
			toggleDetails(view);
			break;
		case 'footnote':
			insertFootnote(view);
			break;
		case 'table':
			insertTable(ctx);
			break;
		case 'tableOp':
			runTableOp(ctx, action.op);
			break;
		case 'tableSelect':
			selectCells(view, action.anchor, action.head, action.byHandle ?? true);
			break;
		case 'tableMove':
			moveTablePart(view, action.kind, action.from, action.to);
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
			const text = state.schema.text(action.name, [link]);
			if (!mediaKindOf(action.name)) {
				view.dispatch(state.tr.replaceSelectionWith(text, false).insertText(' '));
				break;
			}
			// 영상·음악은 링크 혼자 한 문단이어야 재생기로 그린다 (embedPreview.ts). 커서는 그 다음 새 문단에 둔다:
			// 커서가 링크 문단 안에 남으면 고치라고 원래 링크 줄을 보이고 아래 캡션을 숨겨, 이름이 위에 있다가 나가면 아래로 옮겨 간다
			const paragraph = state.schema.nodes.paragraph;
			const { $from } = state.selection;
			const blocks = [paragraph.create(null, text), paragraph.create()];
			const empty = $from.parent.isTextblock && $from.parent.content.size === 0;
			const at = empty ? $from.before() : $from.after();
			const tr = empty ? state.tr.replaceWith(at, $from.after(), blocks) : state.tr.insert(at, blocks);
			view.dispatch(tr.setSelection(TextSelection.create(tr.doc, at + blocks[0].nodeSize + 1)).scrollIntoView());
			break;
		}
	}
	view.focus();
}
