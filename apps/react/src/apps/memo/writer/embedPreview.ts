import { $prose } from '@milkdown/kit/utils';
import type { Node } from '@milkdown/kit/prose/model';
import { Plugin, TextSelection, type EditorState, type Transaction } from '@milkdown/kit/prose/state';
import { embedOf, mediaKindOf } from '@macfolio/desktop-core/memo';
import { Decoration, DecorationSet, type EditorView } from '@milkdown/kit/prose/view';
import { linkBlockOf, type EmbedBlock, type LinkBlock, type MediaBlock } from '../embedBlock';
import { EMBED_ALLOW } from '../components/MemoEmbed';

/**
 * 편집기 문단이 링크 하나뿐이면 그 임베드·재생기 (읽기 화면의 linkBlockOfParagraph와 같은 규칙).
 * 올린 파일을 넣으면 링크 뒤에 빈칸 하나가 붙으므로 공백 글자는 무시한다
 */
function linkBlockOfNode(paragraph: Node): LinkBlock | null {
	if (paragraph.type.name !== 'paragraph') return null;
	const parts: Node[] = [];
	let other = false;
	paragraph.forEach((child) => {
		if (!child.isText) other = true;
		else if (child.marks.some((mark) => mark.type.name === 'link')) parts.push(child);
		else if (child.text?.trim()) other = true;
	});
	if (other || parts.length !== 1) return null;
	const link = parts[0].marks.find((mark) => mark.type.name === 'link')!;
	return linkBlockOf(String(link.attrs.href), parts[0].text ?? '', link.attrs.title as string | null);
}

/**
 * 표는 건너뛴다: 표 칸 안의 문단은 읽기 화면에서 <p>가 아니라 임베드하지 않고, 칸 안에 재생기를 넣지도 않는다
 */
const TABLE_NODES = new Set(['table']);

/** 주소 하나뿐인 문단의 글자 (공백 없는 https 주소) */
const URL_ONLY = /^https:\/\/\S+$/;

/**
 * 주소만 있는 문단의 링크를 글자와 맞춘다. 저장하는 Markdown과 읽기 화면의 임베드가 글자의 주소를 따르게 하려는 것이다.
 * - 주소 글자를 고치면 링크 대상(href)이 예전 주소로 남는다 → 링크를 새 글자 주소로 바꾼다
 * - 지원 사이트나 영상·음악 파일의 주소를 직접 입력하면 링크가 없는 글자다 → 링크를 건다 (붙여 넣은 주소는 편집기가 이미 링크로 만든다)
 */
function syncUrlLinks(state: EditorState): Transaction | null {
	const link = state.schema.marks.link;
	if (!link) return null;
	let tr: Transaction | null = null;
	state.doc.descendants((node, pos) => {
		if (TABLE_NODES.has(node.type.name)) return false;
		if (node.type.name !== 'paragraph') return true;
		const text = node.textContent;
		if (!URL_ONLY.test(text)) return false;
		let linked = false;
		let matches = true;
		let onlyText = true;
		node.forEach((child) => {
			const mark = link.isInSet(child.marks);
			// 코드 글자(`https://…`)는 주소를 보여 주려고 쓴 것이라 링크를 걸지 않는다
			if (!child.isText || child.marks.some((other) => other.type.name === 'inlineCode')) onlyText = false;
			if (mark) linked = true;
			if (!mark || mark.attrs.href !== text) matches = false;
		});
		if (!onlyText || matches || (!linked && !embedOf(text) && !mediaKindOf(text))) return false;
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
	if (!paragraph || !linkBlockOfNode(paragraph)) return null;
	const start = widgetPos - paragraph.nodeSize;
	return { start, end: widgetPos, from: start + 1, to: widgetPos - 1, paragraph };
}

type EmbedAction = 'edit' | 'unembed' | 'remove';

/** 아이콘은 YouTube 재생기의 버튼처럼 24px 채운 모양. '링크로 바꾸기'는 YouTube의 링크 복사(사슬)와 헷갈리지 않게 밑줄 친 글자 */
const TOOL_BUTTONS: { action: EmbedAction; label: string; icon: string }[] = [
	{
		action: 'edit',
		label: '주소 바꾸기',
		icon: '<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm17.71-10.21a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"/>',
	},
	{
		action: 'unembed',
		label: '링크로 바꾸기',
		icon: '<path d="M12 17a6 6 0 0 0 6-6V3h-2.5v8a3.5 3.5 0 1 1-7 0V3H6v8a6 6 0 0 0 6 6Zm-7 2v2h14v-2H5Z"/>',
	},
	{
		action: 'remove',
		label: '임베드 삭제',
		icon: '<path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z"/>',
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

/** 임베드 위의 도구 버튼 (마우스를 올리면 보인다). YouTube 재생기 안의 버튼(링크 복사)과 같은 모양 (styles/markdown.css) */
function toolBar(view: EditorView, getPos: () => number | undefined, actions: readonly EmbedAction[]): HTMLElement {
	const bar = document.createElement('span');
	bar.className = 'memo-embed-tools';
	bar.setAttribute('role', 'group');
	bar.setAttribute('aria-label', '임베드');
	for (const { action, label, icon } of TOOL_BUTTONS.filter((button) => actions.includes(button.action))) {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'memo-overlay-button';
		button.setAttribute('aria-label', label);
		button.title = label;
		button.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">${icon}</svg>`;
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
	if (embed.maxWidth) {
		frame.style.maxWidth = `${embed.maxWidth}px`;
		frame.style.marginInline = 'auto';
	}
	const iframe = frame.appendChild(document.createElement('iframe'));
	iframe.src = embed.src;
	iframe.title = `${embed.name} 임베드`;
	iframe.loading = 'lazy';
	iframe.allow = EMBED_ALLOW;
	iframe.allowFullscreen = true;
	iframe.referrerPolicy = 'strict-origin-when-cross-origin';
	frame.append(toolBar(view, getPos, ['edit', 'unembed', 'remove']));
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
 * 읽기 화면의 MemoMedia와 같은 모양의 <video>·<audio>와 도구 버튼(주소 바꾸기·삭제).
 * 재생기는 이미 링크가 아니므로 '링크로 바꾸기'는 없다
 */
function mediaDom({ href, kind, name, title }: MediaBlock, view: EditorView, getPos: () => number | undefined) {
	const figure = document.createElement('figure');
	figure.className = 'memo-media';
	figure.dataset.kind = kind;
	figure.contentEditable = 'false';
	const frame = figure.appendChild(document.createElement('div'));
	frame.className = 'memo-media-frame';
	const player = frame.appendChild(document.createElement(kind));
	player.src = href;
	player.controls = true;
	player.preload = 'metadata';
	player.setAttribute('aria-label', name);
	if (player instanceof HTMLVideoElement) player.playsInline = true;
	// Safari는 처음 재생한 뒤부터 영상 위쪽 줄에 전체 화면·PiP 버튼을 보인다. 도구 버튼이 그 자리를 비키도록 표시한다
	player.addEventListener('play', () => (figure.dataset.started = ''), { once: true });
	frame.append(toolBar(view, getPos, ['edit', 'remove']));
	const caption = figure.appendChild(document.createElement('figcaption'));
	const link = caption.appendChild(document.createElement('a'));
	link.href = href;
	if (title) link.title = title;
	link.target = '_blank';
	link.rel = 'noopener noreferrer';
	link.textContent = name;
	return figure;
}

/**
 * 위젯 DOM: 임베드는 iframe, 영상·음악은 재생기. 재생기 위젯은 원래 문단 앞에 붙으므로(decorations 참고),
 * 도구 버튼에는 임베드처럼 원래 문단의 끝 위치를 넘긴다
 */
function widgetDom(block: LinkBlock, view: EditorView, getPos: () => number | undefined) {
	if (block.type === 'embed') return embedDom(block, view, getPos);
	const sourceEnd = () => {
		const pos = getPos();
		const paragraph = pos === undefined ? null : view.state.doc.nodeAt(pos);
		return pos === undefined || !paragraph ? undefined : pos + paragraph.nodeSize;
	};
	return mediaDom(block, view, sourceEnd);
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
	if (!sibling || !linkBlockOfNode(sibling)) return false;
	const target = down ? boundary + 1 : boundary - 1;
	view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, target)).scrollIntoView());
	return true;
}

/**
 * 주소만 한 줄로 적은 문단과 영상·음악 파일 링크를 읽기 화면처럼 임베드·재생기로 보인다. 글(Markdown)은 그대로 주소 한 줄이고, 화면에서만
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
						if (TABLE_NODES.has(node.type.name)) return false;
						if (node.type.name !== 'paragraph') return true;
						const block = linkBlockOfNode(node);
						if (!block) return false;
						// 주소 문단은 숨기고, 커서나 선택이 그 안에 있을 때만 보인다 (styles/markdown.css의 .memo-embed-source)
						const editing = from > pos && to < pos + node.nodeSize;
						decorations.push(
							Decoration.node(pos, pos + node.nodeSize, {
								class: 'memo-embed-source',
								...(editing && { 'data-editing': 'true' }),
							})
						);
						// 임베드는 주소 문단 뒤에 붙여, 고치는 주소 줄이 임베드 위에 보인다. 영상·음악은 원래 문단 앞에 붙여, 커서가 들어와
						// 보이는 첨부 파일 줄이 평소의 캡션처럼 재생기 아래에 놓인다 (편집 여부로 파일 이름 자리가 바뀌지 않게)
						const media = block.type === 'media';
						decorations.push(
							Decoration.widget(media ? pos : pos + node.nodeSize, (view, getPos) => widgetDom(block, view, getPos), {
								side: media ? 1 : -1,
								// 같은 key면 DOM(iframe·재생기)을 다시 만들지 않는다
								key: block.type === 'embed' ? `embed:${block.embed.src}` : `media:${block.href}`,
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
