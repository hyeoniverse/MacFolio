import { useEffect, useRef } from 'react';
import { defaultValueCtx, Editor, editorViewCtx, remarkStringifyOptionsCtx, rootCtx } from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
import { clipboard } from '@milkdown/kit/plugin/clipboard';
import { history, redoCommand, undoCommand } from '@milkdown/kit/plugin/history';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import {
	commonmark,
	liftListItemCommand,
	toggleEmphasisCommand,
	toggleInlineCodeCommand,
	toggleLinkCommand,
	toggleStrongCommand,
	turnIntoTextCommand,
	wrapInBlockquoteCommand,
	wrapInBulletListCommand,
	wrapInHeadingCommand,
	wrapInOrderedListCommand,
} from '@milkdown/kit/preset/commonmark';
import { gfm, remarkGFMPlugin, strikethroughInputRule, toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm';
import { lift } from '@milkdown/kit/prose/commands';
import { Plugin, type EditorState } from '@milkdown/kit/prose/state';
import { $prose, $remark, callCommand, getMarkdown, replaceAll } from '@milkdown/kit/utils';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import remarkCjkFriendly from 'remark-cjk-friendly';
import { GFM_OPTIONS } from '@/apps/memo/markdownPlugins';
import { fromEditorMarkdown, type MarkdownFormat } from './markdownFormat';
import { EMPTY_RICH_STATE, type RichControls, type RichState } from './richControls';

interface Props {
	/** 처음 글 (Markdown) */
	markdown: string;
	/** 고칠 때마다 바뀐 글 (Markdown) */
	onChange: (markdown: string) => void;
	/** 커서 자리의 서식이 바뀔 때 (서식 막대) */
	onState: (state: RichState) => void;
	/** 편집기가 다 만들어졌을 때 명령을 넘긴다 */
	onReady: (controls: RichControls) => void;
}

/** 커서 자리의 서식 */
function stateOf(state: EditorState): RichState {
	const { $from, from, to, empty } = state.selection;
	const result: RichState = { ...EMPTY_RICH_STATE, marks: { ...EMPTY_RICH_STATE.marks } };
	if ($from.parent.type.name === 'heading') result.level = $from.parent.attrs.level as number;
	for (let depth = $from.depth; depth > 0 && !result.kind; depth--) {
		const name = $from.node(depth).type.name;
		if (name === 'bullet_list') result.kind = 'list';
		else if (name === 'ordered_list') result.kind = 'ordered';
		else if (name === 'blockquote') result.kind = 'quote';
	}
	const has = (mark: string) => {
		const type = state.schema.marks[mark];
		if (!type) return false;
		return empty ? Boolean(type.isInSet(state.storedMarks ?? $from.marks())) : state.doc.rangeHasMark(from, to, type);
	};
	result.marks = {
		bold: has('strong'),
		italic: has('emphasis'),
		strike: has('strike_through'),
		code: has('inlineCode'),
		link: has('link'),
	};
	return result;
}

const cjkFriendly = $remark('cjkFriendly', () => remarkCjkFriendly);
const gfmWithoutSingleTilde = gfm.filter((plugin) => plugin !== strikethroughInputRule);

/** 줄 묶음(목록·번호·인용): 이미 그 종류면 풀고, 아니면 감싼다 */
function toggleLine(ctx: Ctx, format: 'list' | 'ordered' | 'quote', current: RichState['kind']) {
	if (current === format) {
		if (format === 'quote') {
			const view = ctx.get(editorViewCtx);
			lift(view.state, view.dispatch);
		} else callCommand(liftListItemCommand.key)(ctx);
		return;
	}
	if (format === 'list') callCommand(wrapInBulletListCommand.key)(ctx);
	else if (format === 'ordered') callCommand(wrapInOrderedListCommand.key)(ctx);
	else callCommand(wrapInBlockquoteCommand.key)(ctx);
}

const Inner = ({ markdown, onChange, onState, onReady }: Props) => {
	const callbacks = useRef({ onChange, onState, onReady });
	useEffect(() => {
		callbacks.current = { onChange, onState, onReady };
	});
	const current = useRef<RichState>(EMPTY_RICH_STATE);

	const { get, loading } = useEditor((root) => {
		/** 커서 자리의 서식을 서식 막대에 알린다 */
		const publish = $prose(
			() =>
				new Plugin({
					view: (view) => {
						current.current = stateOf(view.state);
						callbacks.current.onState(current.current);
						return {
							update: (next) => {
								current.current = stateOf(next.state);
								callbacks.current.onState(current.current);
							},
						};
					},
				})
		);
		return Editor.make()
			.config((ctx) => {
				ctx.set(rootCtx, root);
				ctx.set(remarkGFMPlugin.options.key, GFM_OPTIONS);
				ctx.set(defaultValueCtx, markdown);
				// 이력서 규칙과 같게: 목록 '-', 기울임 '_', 굵게 '**'
				ctx.update(remarkStringifyOptionsCtx, (options) => ({
					...options,
					bullet: '-' as const,
					emphasis: '_' as const,
					strong: '*' as const,
					rule: '-' as const,
				}));
				ctx.get(listenerCtx).markdownUpdated((_ctx, next, prev) => {
					if (next !== prev) callbacks.current.onChange(fromEditorMarkdown(next));
				});
			})
			.use(commonmark)
			.use(gfmWithoutSingleTilde)
			.use(cjkFriendly)
			.use(history)
			.use(clipboard)
			.use(listener)
			.use(publish);
	}, []);

	useEffect(() => {
		if (loading) return;
		const run = (action: (ctx: Ctx) => void) => get()?.action(action);
		callbacks.current.onReady({
			format: (format: MarkdownFormat) =>
				run((ctx) => {
					if (format === 'bold') callCommand(toggleStrongCommand.key)(ctx);
					else if (format === 'italic') callCommand(toggleEmphasisCommand.key)(ctx);
					else if (format === 'strike') callCommand(toggleStrikethroughCommand.key)(ctx);
					else if (format === 'code') callCommand(toggleInlineCodeCommand.key)(ctx);
					else if (format === 'link') {
						// 링크가 있으면 풀고, 없으면 주소를 물어 건다
						if (current.current.marks.link) return void callCommand(toggleLinkCommand.key)(ctx);
						const href = window.prompt('링크 주소 (프로젝트는 #project/아이디)', 'https://');
						if (href) callCommand(toggleLinkCommand.key, { href })(ctx);
					} else toggleLine(ctx, format, current.current.kind);
					ctx.get(editorViewCtx).focus();
				}),
			heading: (level) =>
				run((ctx) => {
					if (level === 0) callCommand(turnIntoTextCommand.key)(ctx);
					else callCommand(wrapInHeadingCommand.key, level)(ctx);
					ctx.get(editorViewCtx).focus();
				}),
			replace: (next) => run(replaceAll(next)),
			markdown: () => fromEditorMarkdown(get()?.action(getMarkdown()) ?? ''),
			undo: () => run((ctx) => callCommand(undoCommand.key)(ctx)),
			redo: () => run((ctx) => callCommand(redoCommand.key)(ctx)),
			focus: () => run((ctx) => ctx.get(editorViewCtx).focus()),
		});
	}, [loading, get]);

	return <Milkdown />;
};

/**
 * 이력서를 보이는 그대로 고치는 편집기 (Milkdown, 메모의 편집기와 같은 규칙). 읽기 화면(DocView)과 같은 모양(.finder-doc)으로 그리고,
 * 저장은 Markdown 한 장으로 한다. 관리자에게만 필요해서 처음 쓸 때 따로 불러온다 (React.lazy)
 */
const ResumeRichEditor = (props: Props) => (
	<div className="prose finder-doc textedit-rich">
		<MilkdownProvider>
			<Inner {...props} />
		</MilkdownProvider>
	</div>
);

export default ResumeRichEditor;
