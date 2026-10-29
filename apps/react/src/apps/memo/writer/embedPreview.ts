import { $prose } from '@milkdown/kit/utils';
import type { Node } from '@milkdown/kit/prose/model';
import { Plugin } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { embedBlockOf, type EmbedBlock } from '../embedBlock';
import { EMBED_ALLOW } from '../components/MemoEmbed';

/** 편집기 문단이 주소 링크 하나뿐이면 그 임베드 (읽기 화면의 embedBlockOfParagraph와 같은 규칙) */
function embedBlockOfNode(paragraph: Node): EmbedBlock | null {
	if (paragraph.type.name !== 'paragraph' || paragraph.childCount !== 1) return null;
	const text = paragraph.firstChild!;
	const link = text.isText ? text.marks.find((mark) => mark.type.name === 'link') : undefined;
	return link ? embedBlockOf(String(link.attrs.href), text.text ?? '') : null;
}

/** 읽기 화면의 MemoEmbed와 같은 모양의 DOM. 편집할 수 없는 자리라 contenteditable="false" */
function embedDom({ embed }: EmbedBlock): HTMLElement {
	const figure = document.createElement('figure');
	figure.className = 'memo-embed';
	figure.dataset.provider = embed.provider;
	figure.contentEditable = 'false';
	const frame = figure.appendChild(document.createElement('div'));
	frame.className = 'memo-embed-frame';
	if (embed.aspectRatio) frame.style.aspectRatio = embed.aspectRatio;
	else frame.style.height = `${embed.height}px`;
	const iframe = frame.appendChild(document.createElement('iframe'));
	iframe.src = embed.src;
	iframe.title = `${embed.name} 임베드`;
	iframe.loading = 'lazy';
	iframe.allow = EMBED_ALLOW;
	iframe.allowFullscreen = true;
	iframe.referrerPolicy = 'strict-origin-when-cross-origin';
	return figure;
}

/**
 * 주소만 한 줄로 적은 문단 아래에 임베드 미리 보기를 붙인다. 글(Markdown)은 바꾸지 않는 위젯 장식이고,
 * 같은 주소면 같은 key로 위젯을 다시 쓰므로 글자를 입력해도 iframe이 다시 불러와지지 않는다
 */
export const embedPreview = $prose(
	() =>
		new Plugin({
			props: {
				decorations: (state) => {
					const decorations: Decoration[] = [];
					state.doc.descendants((node, pos) => {
						if (node.type.name !== 'paragraph') return true;
						const block = embedBlockOfNode(node);
						if (block)
							decorations.push(
								Decoration.widget(pos + node.nodeSize, () => embedDom(block), {
									side: -1,
									key: `embed:${block.embed.src}`,
									ignoreSelection: true,
									stopEvent: () => true,
								})
							);
						return false;
					});
					return decorations.length ? DecorationSet.create(state.doc, decorations) : null;
				},
			},
		})
);
