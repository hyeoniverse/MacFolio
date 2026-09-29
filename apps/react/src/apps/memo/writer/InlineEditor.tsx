import { useEffect, useRef } from 'react';
import { defaultValueCtx, Editor, remarkStringifyOptionsCtx, rootCtx } from '@milkdown/kit/core';
import { clipboard } from '@milkdown/kit/plugin/clipboard';
import { history } from '@milkdown/kit/plugin/history';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { CONTENT_IMAGES } from '../contentImages';
import { fromEditorMarkdown, toEditorMarkdown } from './markdownImages';

interface Props {
	/** 처음 본문 (Markdown) */
	markdown: string;
	/** 고칠 때마다 바뀐 본문 (Markdown) */
	onChange: (markdown: string) => void;
	placeholder?: string;
}

const Inner = ({ markdown, onChange }: Props) => {
	const onChangeRef = useRef(onChange);
	useEffect(() => {
		onChangeRef.current = onChange;
	});

	useEditor(
		(root) =>
			Editor.make()
				.config((ctx) => {
					ctx.set(rootCtx, root);
					// 저장소 글의 상대 경로 이미지도 편집기 안에서 보이게 한다
					ctx.set(defaultValueCtx, toEditorMarkdown(markdown, CONTENT_IMAGES));
					// 목록 기호는 지금 글들처럼 '-'로 쓴다
					ctx.update(remarkStringifyOptionsCtx, (options) => ({ ...options, bullet: '-' as const }));
					ctx.get(listenerCtx).markdownUpdated((_ctx, next, prev) => {
						if (next !== prev) onChangeRef.current(fromEditorMarkdown(next, CONTENT_IMAGES));
					});
				})
				.use(commonmark)
				.use(gfm)
				.use(history)
				.use(clipboard)
				.use(listener),
		[]
	);

	return <Milkdown />;
};

/**
 * 보이는 그대로 고치는 본문 편집기 (Milkdown). 제목·굵게·목록·코드·표를 쓰는 모양 그대로 편집하고, 저장은 Markdown으로 한다.
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
