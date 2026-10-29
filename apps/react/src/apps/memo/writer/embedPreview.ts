import { $prose } from '@milkdown/kit/utils';
import type { Node } from '@milkdown/kit/prose/model';
import { Plugin, TextSelection, type EditorState, type Transaction } from '@milkdown/kit/prose/state';
import { embedOf } from '@macfolio/desktop-core/memo';
import { Decoration, DecorationSet, type EditorView } from '@milkdown/kit/prose/view';
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

/** 위젯 위치(주소 문단 바로 뒤)에서 주소 문단의 범위. 문서가 바뀌어 그 자리에 주소 문단이 없으면 null */
function sourceRange(view: EditorView, widgetPos: number | undefined) {
	if (widgetPos === undefined) return null;
	const paragraph = view.state.doc.resolve(widgetPos).nodeBefore;
	if (!paragraph || !embedBlockOfNode(paragraph)) return null;
	const start = widgetPos - paragraph.nodeSize;
	return { start, end: widgetPos, from: start + 1, to: widgetPos - 1, paragraph };
}

type EmbedAction = 'edit' | 'unembed' | 'remove';

const TOOL_BUTTONS: { action: EmbedAction; label: string; icon: string }[] = [
	{
		action: 'edit',
		label: '주소 바꾸기',
		icon: '<path d="M10.5 2.5l3 3L6 13H3v-3z"/>',
	},
	{
		action: 'unembed',
		label: '링크로 바꾸기',
		icon: '<path d="M6.5 9.5l3-3"/><path d="M7 4.5l1-1a2.5 2.5 0 013.5 3.5l-1 1"/><path d="M9 11.5l-1 1A2.5 2.5 0 014.5 9l1-1"/>',
	},
	{
		action: 'remove',
		label: '임베드 삭제',
		icon: '<path d="M3 4.5h10"/><path d="M6.5 4.5V3h3v1.5"/><path d="M4.5 4.5l.5 8.5h6l.5-8.5"/>',
	},
];

/**
 * 도구 버튼의 동작.
 * - 주소 바꾸기: 숨긴 주소 문단의 글자를 모두 골라 보이게 한다. 새 주소를 입력하거나 붙여 넣으면 링크와 임베드가 따라 바뀐다
 * - 링크로 바꾸기: 링크 글자를 https:// 를 뺀 주소로 바꿔 임베드 규칙(글자 = 주소)에서 뺀다 → 저장하면 `[youtube.com/…](https://…)`
 * - 임베드 삭제: 주소 문단을 지운다
 */
function runEmbedAction(view: EditorView, widgetPos: number | undefined, action: EmbedAction) {
	const range = sourceRange(view, widgetPos);
	if (!range) return;
	const { state } = view;
	if (action === 'edit') {
		view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, range.from, range.to)).scrollIntoView());
	} else if (action === 'unembed') {
		const href = range.paragraph.textContent;
		const label = href.replace(/^https:\/\//, '');
		view.dispatch(
			state.tr.replaceWith(
				range.from,
				range.to,
				state.schema.text(label, [state.schema.marks.link.create({ href, title: null })])
			)
		);
	} else {
		view.dispatch(state.tr.delete(range.start, range.end));
	}
	view.focus();
}

/** 임베드 위의 도구 버튼 (마우스를 올리면 보인다). YouTube 재생기 안의 버튼처럼 둥근 반투명 버튼 (styles/markdown.css) */
function toolBar(view: EditorView, getPos: () => number | undefined): HTMLElement {
	const bar = document.createElement('span');
	bar.className = 'memo-embed-tools';
	bar.setAttribute('role', 'group');
	bar.setAttribute('aria-label', '임베드');
	for (const { action, label, icon } of TOOL_BUTTONS) {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'memo-overlay-button';
		button.setAttribute('aria-label', label);
		button.title = label;
		button.innerHTML = `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg>`;
		button.addEventListener('mousedown', (event) => event.preventDefault());
		button.addEventListener('click', () => runEmbedAction(view, getPos(), action));
		bar.append(button);
	}
	return bar;
}

/** 읽기 화면의 MemoEmbed와 같은 모양의 DOM에 도구 버튼을 더한다. 편집할 수 없는 자리라 contenteditable="false" */
function embedDom({ href, embed }: EmbedBlock, view: EditorView, getPos: () => number | undefined): HTMLElement {
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
	frame.append(toolBar(view, getPos));
	// 읽기 화면과 같은 캡션: 원래 주소를 새 탭에서 연다
	const caption = figure.appendChild(document.createElement('figcaption'));
	const link = caption.appendChild(document.createElement('a'));
	link.href = href;
	link.target = '_blank';
	link.rel = 'noopener noreferrer';
	link.textContent = `${embed.name}에서 열기`;
	return figure;
}

/**
 * 숨긴 주소 문단으로 키보드 커서를 옮긴다. 높이가 0인 문단은 브라우저의 위·아래 화살표 이동이 건너뛰므로,
 * 문단 끝에서 위·아래로 갈 때 옆 문단이 주소 문단이면 직접 그 안에 커서를 둔다 (아래로 가면 주소 앞, 위로 가면 주소 끝)
 */
function moveIntoSource(view: EditorView, event: KeyboardEvent): boolean {
	if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return false;
	if (event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) return false;
	const { $head, empty } = view.state.selection;
	const down = event.key === 'ArrowDown';
	if (!empty || !$head.parent.isTextblock || !view.endOfTextblock(down ? 'down' : 'up')) return false;
	const boundary = down ? $head.after() : $head.before();
	const $boundary = view.state.doc.resolve(boundary);
	const sibling = down ? $boundary.nodeAfter : $boundary.nodeBefore;
	if (!sibling || !embedBlockOfNode(sibling)) return false;
	const target = down ? boundary + 1 : boundary - 1;
	view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, target)).scrollIntoView());
	return true;
}

/**
 * 주소만 한 줄로 적은 문단을 읽기 화면처럼 임베드로 보인다. 글(Markdown)은 그대로 주소 한 줄이고, 화면에서만
 * 주소 문단을 숨기고(커서가 들어오면 보인다) 그 뒤에 임베드 위젯을 붙인다. 주소를 고치면 링크와 임베드가 함께 바뀐다.
 * 같은 주소면 같은 key로 위젯을 다시 쓰므로 글자를 입력해도 iframe이 다시 불러와지지 않는다
 */
export const embedPreview = $prose(
	() =>
		new Plugin({
			appendTransaction: (transactions, _old, state) =>
				transactions.some((tr) => tr.docChanged) ? syncUrlLinks(state) : null,
			props: {
				handleKeyDown: moveIntoSource,
				decorations: (state) => {
					const decorations: Decoration[] = [];
					const { from, to } = state.selection;
					state.doc.descendants((node, pos) => {
						if (node.type.name !== 'paragraph') return true;
						const block = embedBlockOfNode(node);
						if (!block) return false;
						// 주소 문단은 숨기고, 커서나 선택이 그 안에 있을 때만 보인다 (styles/markdown.css의 .memo-embed-source)
						const editing = from > pos && to < pos + node.nodeSize;
						decorations.push(
							Decoration.node(pos, pos + node.nodeSize, {
								class: 'memo-embed-source',
								...(editing && { 'data-editing': 'true' }),
							})
						);
						decorations.push(
							Decoration.widget(pos + node.nodeSize, (view, getPos) => embedDom(block, view, getPos), {
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
