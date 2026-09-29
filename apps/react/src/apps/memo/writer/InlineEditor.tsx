import { useEffect, useRef } from 'react';
import { defaultValueCtx, Editor, editorViewOptionsCtx, remarkStringifyOptionsCtx, rootCtx } from '@milkdown/kit/core';
import { clipboard } from '@milkdown/kit/plugin/clipboard';
import { history } from '@milkdown/kit/plugin/history';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { Plugin } from '@milkdown/kit/prose/state';
import { $prose } from '@milkdown/kit/utils';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { CONTENT_IMAGES } from '../contentImages';
import { editorControls, EMPTY_FORMAT } from './editorControls';
import { formatStateOf, runFormat } from './formatCommands';
import { fromEditorMarkdown, toEditorMarkdown } from './markdownImages';

interface Props {
	/** 처음 본문 (Markdown) */
	markdown: string;
	/** 고칠 때마다 바뀐 본문 (Markdown) */
	onChange: (markdown: string) => void;
	placeholder?: string;
}

/** 체크 항목의 네모(왼쪽 여백)를 눌렀는지 */
const CHECKBOX_HIT_PX = 26;

/** 커서 자리의 서식을 도구 막대에 알린다 (글이나 커서가 바뀔 때마다) */
const publishFormat = $prose(
	() =>
		new Plugin({
			view: (view) => {
				editorControls.setState({ state: formatStateOf(view.state) });
				return {
					update: (next, prev) => {
						if (
							next.state.doc !== prev.doc ||
							!next.state.selection.eq(prev.selection) ||
							next.state.storedMarks !== prev.storedMarks
						)
							editorControls.setState({ state: formatStateOf(next.state) });
					},
				};
			},
		})
);

const Inner = ({ markdown, onChange }: Props) => {
	const onChangeRef = useRef(onChange);
	useEffect(() => {
		onChangeRef.current = onChange;
	});

	const { get } = useEditor(
		(root) =>
			Editor.make()
				.config((ctx) => {
					ctx.set(rootCtx, root);
					// 저장소 글의 상대 경로 이미지도 편집기 안에서 보이게 한다
					ctx.set(defaultValueCtx, toEditorMarkdown(markdown, CONTENT_IMAGES));
					// 목록 기호는 지금 글들처럼 '-'로 쓴다
					ctx.update(remarkStringifyOptionsCtx, (options) => ({ ...options, bullet: '-' as const }));
					// 체크 항목: 네모를 누르면 체크를 켜고 끈다
					ctx.update(editorViewOptionsCtx, (options) => ({
						...options,
						handleClickOn: (view, _pos, node, nodePos, event, direct) => {
							if (!direct || node.type.name !== 'list_item' || node.attrs.checked == null) return false;
							const dom = view.nodeDOM(nodePos) as HTMLElement | null;
							if (!dom || event.clientX - dom.getBoundingClientRect().left > CHECKBOX_HIT_PX) return false;
							view.dispatch(
								view.state.tr.setNodeMarkup(nodePos, undefined, { ...node.attrs, checked: !node.attrs.checked })
							);
							return true;
						},
					}));
					ctx.get(listenerCtx).markdownUpdated((_ctx, next, prev) => {
						if (next !== prev) onChangeRef.current(fromEditorMarkdown(next, CONTENT_IMAGES));
					});
				})
				.use(commonmark)
				.use(gfm)
				.use(history)
				.use(clipboard)
				.use(listener)
				.use(publishFormat),
		[]
	);

	// 도구 막대가 이 편집기에 명령을 보낼 수 있게 한다 (편집기가 사라지면 도구 막대도 숨는다)
	const getRef = useRef(get);
	useEffect(() => {
		getRef.current = get;
	});
	useEffect(() => {
		editorControls.setState({
			run: (action) => getRef.current()?.action((ctx) => runFormat(ctx, action)),
		});
		return () => editorControls.setState({ run: null, state: EMPTY_FORMAT });
	}, []);

	return <Milkdown />;
};

/**
 * 보이는 그대로 고치는 본문 편집기 (Milkdown). 제목·굵게·목록·코드·표를 쓰는 모양 그대로 편집하고, 저장은 Markdown으로 한다.
 * 서식은 창 위 도구 막대(FormatTools)나 단축키(⌘B, ⌘I 등)로 바꾼다.
 * 관리자에게만 필요해서 처음 쓸 때 따로 불러온다 (React.lazy).
 */
const InlineEditor = (props: Props) => (
	<div className="memo-inline-editor memo-markdown" data-placeholder={props.placeholder}>
		<MilkdownProvider>
			<Inner {...props} />
		</MilkdownProvider>
	</div>
);

export default InlineEditor;
