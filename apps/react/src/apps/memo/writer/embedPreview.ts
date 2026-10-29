import { $prose } from '@milkdown/kit/utils';
import type { Node } from '@milkdown/kit/prose/model';
import { Plugin, type EditorState, type Transaction } from '@milkdown/kit/prose/state';
import { embedOf } from '@macfolio/desktop-core/memo';
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

/** 주소 하나뿐인 문단의 글자 (공백 없는 https 주소) */
const URL_ONLY = /^https:\/\/\S+$/;

/**
 * 주소만 있는 문단의 링크를 글자와 맞춘다. 저장하는 Markdown과 읽기 화면의 임베드가 글자의 주소를 따르게 하려는 것이다.
 * - 주소 글자를 고치면 링크 대상(href)이 예전 주소로 남는다 → 링크를 새 글자 주소로 바꾼다
 * - 지원 사이트의 주소를 직접 입력하면 링크가 없는 글자다 → 링크를 건다 (붙여 넣은 주소는 편집기가 이미 링크로 만든다)
 */
function syncUrlLinks(state: EditorState): Transaction | null {
	const link = state.schema.marks.link;
	if (!link) return null;
	let tr: Transaction | null = null;
	state.doc.descendants((node, pos) => {
		if (node.type.name !== 'paragraph') return true;
		const text = node.textContent;
		if (!URL_ONLY.test(text)) return false;
		let linked = false;
		let matches = true;
		let onlyText = true;
		node.forEach((child) => {
			const mark = link.isInSet(child.marks);
			if (!child.isText) onlyText = false;
			if (mark) linked = true;
			if (!mark || mark.attrs.href !== text) matches = false;
		});
		if (!onlyText || matches || (!linked && !embedOf(text))) return false;
		const from = pos + 1;
		const to = from + node.content.size;
		tr ??= state.tr;
		tr.removeMark(from, to, link).addMark(from, to, link.create({ href: text, title: null }));
		return false;
	});
	return tr;
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
 * 주소만 한 줄로 적은 문단 아래에 임베드 미리 보기를 붙인다 (주소 글자를 고치면 링크와 미리 보기가 함께 바뀐다). 글(Markdown)은 바꾸지 않는 위젯 장식이고,
 * 같은 주소면 같은 key로 위젯을 다시 쓰므로 글자를 입력해도 iframe이 다시 불러와지지 않는다
 */
export const embedPreview = $prose(
	() =>
		new Plugin({
			appendTransaction: (transactions, _old, state) =>
				transactions.some((tr) => tr.docChanged) ? syncUrlLinks(state) : null,
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
