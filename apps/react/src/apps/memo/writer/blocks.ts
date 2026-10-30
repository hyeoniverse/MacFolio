// 편집기 블록: 이미지 블록(이미지만 있는 문단), 복사 버튼이 있는 코드 블록.
// 둘 다 읽기 화면(MarkdownImage, CodeBlock)과 같은 DOM 구조로 그린다.
import { codeBlockSchema, imageSchema } from '@milkdown/kit/preset/commonmark';
import type { Node } from '@milkdown/kit/prose/model';
import type { EditorView, ViewMutationRecord } from '@milkdown/kit/prose/view';
import { $nodeSchema, $remark, $view } from '@milkdown/kit/utils';
import { visit } from 'unist-util-visit';
import { captionParts, imageLayoutOf, withImageLayout, type ImageLayout } from '@macfolio/desktop-core/memo';
import { downloadImage } from '../download';
import { openImageZoom } from './imageZoom';

/** 이 파일에서 쓰는 Markdown 트리(mdast)의 모양 */
interface MdNode {
	type: string;
	children?: MdNode[];
	url?: string;
	alt?: string | null;
	title?: string | null;
}

/**
 * Markdown을 읽을 때 이미지 하나만 있는 문단을 이미지 블록으로 바꾼다.
 * 글줄 사이의 이미지(인라인)로 두면 커서가 이미지 옆에 들어가 줄이 이상하게 늘고, 이미지 뒤로 글을 이어 쓰기 어렵다.
 */
export const imageBlockRemark = $remark('imageBlockRemark', () => () => (tree: MdNode) => {
	visit(tree, 'paragraph', (node: MdNode, index, parent: MdNode | undefined) => {
		const children = node.children ?? [];
		if (children.length !== 1 || children[0].type !== 'image' || !parent?.children || index === undefined) return;
		const image = children[0];
		// 이 편집기 안에서만 쓰는 노드 (저장할 때는 다시 문단 + 이미지)
		parent.children[index] = { type: 'imageBlock', url: image.url, alt: image.alt ?? '', title: image.title ?? '' };
	});
});

export const imageBlockSchema = $nodeSchema('image_block', () => ({
	group: 'block',
	atom: true,
	selectable: true,
	draggable: true,
	isolating: true,
	defining: true,
	attrs: {
		src: { default: '', validate: 'string' },
		alt: { default: '', validate: 'string' },
		title: { default: '', validate: 'string' },
	},
	parseDOM: [
		{
			tag: 'span[data-image-block]',
			getAttrs: (dom) => {
				const img = (dom as HTMLElement).querySelector('img');
				return {
					src: img?.getAttribute('src') ?? '',
					alt: img?.getAttribute('alt') ?? '',
					title: (dom as HTMLElement).dataset.title ?? '',
				};
			},
		},
	],
	toDOM: (node) => [
		'span',
		{ 'data-image-block': '', 'data-title': node.attrs.title, class: 'memo-figure' },
		['img', { src: node.attrs.src, alt: node.attrs.alt }],
	],
	parseMarkdown: {
		match: (node) => node.type === 'imageBlock',
		runner: (state, node, type) => {
			const image = node as unknown as { url: string; alt: string; title: string };
			state.addNode(type, { src: image.url, alt: image.alt, title: image.title });
		},
	},
	toMarkdown: {
		match: (node) => node.type.name === 'image_block',
		runner: (state, node) => {
			state.openNode('paragraph');
			state.addNode('image', undefined, undefined, {
				url: node.attrs.src,
				alt: node.attrs.alt,
				title: node.attrs.title || null,
			});
			state.closeNode();
		},
	},
}));

/** 캡션을 그린다 ([글자](주소)는 링크로) */
function renderCaption(caption: HTMLElement, title: string) {
	caption.replaceChildren(
		...captionParts(title).map((part) => {
			if (!part.href) return document.createTextNode(part.text);
			const link = document.createElement('a');
			link.href = part.href;
			link.target = '_blank';
			link.rel = 'noopener noreferrer';
			link.textContent = part.text;
			return link;
		})
	);
	caption.hidden = !title;
}

/** 이미지 내려받기 버튼 (읽기 화면과 같은 자리·모양) */
function downloadButton(getNode: () => Node) {
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'memo-overlay-button memo-figure-download';
	button.contentEditable = 'false';
	button.setAttribute('aria-label', '이미지 내려받기');
	button.title = '이미지 내려받기';
	button.innerHTML = '<i class="fa-solid fa-download" aria-hidden="true"></i>';
	button.addEventListener('mousedown', (event) => event.preventDefault());
	button.addEventListener('click', () => {
		const node = getNode();
		void downloadImage(node.attrs.src, node.attrs.alt);
	});
	return button;
}

/** 배치 버튼의 이름과 그림 (네모는 이미지, 줄은 글). 그림은 고정된 SVG라 innerHTML로 넣는다 */
const LAYOUT_BUTTONS: { layout: ImageLayout; label: string; icon: string }[] = [
	{ layout: 'left', label: '왼쪽 정렬', icon: '<rect x="1" y="3" width="8" height="10" rx="1"/>' },
	{ layout: 'center', label: '가운데 정렬', icon: '<rect x="4" y="3" width="8" height="10" rx="1"/>' },
	{ layout: 'right', label: '오른쪽 정렬', icon: '<rect x="7" y="3" width="8" height="10" rx="1"/>' },
	{
		layout: 'float-left',
		label: '왼쪽에 띄우고 글 감싸기',
		icon: '<rect x="1" y="3" width="6" height="7" rx="1"/><path d="M9 4h6M9 7h6M9 10h6M1 13h14"/>',
	},
	{
		layout: 'float-right',
		label: '오른쪽에 띄우고 글 감싸기',
		icon: '<rect x="9" y="3" width="6" height="7" rx="1"/><path d="M1 4h6M1 7h6M1 10h6M1 13h14"/>',
	},
];

/**
 * 이미지 배치 버튼 다섯 개 (그림 왼쪽 아래). 이미지를 고르거나 올리면 보인다.
 * 누르면 이미지 주소 끝의 배치 표기를 바꾼다 (desktop-core의 imageLayout.ts): 저장하면 `![설명](주소#float-right)`
 */
function layoutBar(getNode: () => Node, setLayout: (layout: ImageLayout) => void) {
	const bar = document.createElement('span');
	bar.className = 'memo-figure-layout';
	bar.contentEditable = 'false';
	bar.setAttribute('role', 'group');
	bar.setAttribute('aria-label', '이미지 배치');
	const buttons = LAYOUT_BUTTONS.map(({ layout, label, icon }) => {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'memo-overlay-button';
		button.dataset.layout = layout;
		button.setAttribute('aria-label', label);
		button.title = label;
		button.innerHTML = `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true">${icon}</svg>`;
		button.addEventListener('mousedown', (event) => event.preventDefault());
		button.addEventListener('click', () => setLayout(layout));
		bar.append(button);
		return button;
	});
	/** 지금 배치를 눌린 버튼으로 */
	const sync = () => {
		const current = imageLayoutOf(getNode().attrs.src).layout;
		for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.layout === current));
	};
	return { bar, sync };
}

/** 이미지 크게 보기 버튼 (내려받기 버튼 왼쪽). 편집기에서는 이미지를 누르면 이미지가 골라지므로 따로 둔다 */
function zoomButton(getNode: () => Node) {
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'memo-overlay-button memo-figure-zoom';
	button.contentEditable = 'false';
	button.setAttribute('aria-label', '이미지 크게 보기');
	button.title = '이미지 크게 보기 (이미지를 두 번 눌러도 된다)';
	button.innerHTML = '<i class="fa-solid fa-magnifying-glass-plus" aria-hidden="true"></i>';
	button.addEventListener('mousedown', (event) => event.preventDefault());
	button.addEventListener('click', () => {
		const node = getNode();
		openImageZoom(node.attrs.src, node.attrs.alt);
	});
	return button;
}

/** 이미지 삭제 버튼 (크게 보기 버튼 왼쪽). 그림을 골라 Delete를 누르지 않아도 지울 수 있게 */
function deleteButton(view: EditorView, getPos: () => number | undefined, getNode: () => Node) {
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'memo-overlay-button memo-figure-delete';
	button.contentEditable = 'false';
	button.setAttribute('aria-label', '이미지 삭제');
	button.title = '이미지 삭제';
	button.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i>';
	button.addEventListener('mousedown', (event) => event.preventDefault());
	button.addEventListener('click', () => {
		const pos = getPos();
		if (pos === undefined) return;
		view.dispatch(view.state.tr.delete(pos, pos + getNode().nodeSize));
		view.focus();
	});
	return button;
}

/**
 * 이미지(블록·글줄 안) 모양: 읽기 화면처럼 가운데 그림 + 아래 캡션, 그림 오른쪽 위에 삭제·크게 보기·내려받기 버튼.
 * 편집기에서는 이미지를 누르면 이미지가 골라진다. 크게 보려면 크게 보기 버튼을 누르거나 이미지를 두 번 누른다.
 * 캡션을 누르면 그 자리에서 고친다 (비어 있으면 '캡션 추가'). Enter나 초점을 옮기면 저장, Esc는 취소
 */
const figureView = (initial: Node, view: EditorView, getPos: () => number | undefined) => {
	let current = initial;
	const dom = document.createElement('span');
	dom.className = 'memo-figure';
	const frame = document.createElement('span');
	frame.className = 'memo-figure-frame';
	const img = document.createElement('img');
	const layout = layoutBar(
		() => current,
		(next) => {
			const pos = getPos();
			const src = withImageLayout(current.attrs.src, next);
			if (pos !== undefined && src !== current.attrs.src)
				view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, src }));
		}
	);
	frame.append(
		img,
		layout.bar,
		deleteButton(view, getPos, () => current),
		zoomButton(() => current),
		downloadButton(() => current)
	);
	img.addEventListener('dblclick', (event) => {
		event.preventDefault();
		openImageZoom(current.attrs.src, current.attrs.alt);
	});
	const caption = document.createElement('span');
	caption.className = 'memo-caption';
	// 긴 캡션도 다 보이게 줄을 바꾸는 입력칸 (캡션은 한 줄이라 Enter는 줄바꿈 대신 저장)
	const input = document.createElement('textarea');
	input.className = 'memo-caption-input';
	input.rows = 1;
	input.setAttribute('aria-label', '캡션');
	input.placeholder = '캡션 ([글자](주소)로 링크)';
	input.hidden = true;
	const fit = () => {
		input.style.height = 'auto';
		input.style.height = `${input.scrollHeight + 2}px`;
	};
	input.addEventListener('input', () => {
		// 붙여 넣은 줄바꿈은 띄어쓰기로
		if (/\n/.test(input.value)) input.value = input.value.replace(/\s*\n\s*/g, ' ');
		fit();
	});

	const render = (node: Node) => {
		img.src = node.attrs.src;
		img.alt = node.attrs.alt;
		const { layout: placed } = imageLayoutOf(node.attrs.src);
		if (placed === 'center') delete dom.dataset.layout;
		else dom.dataset.layout = placed;
		layout.sync();
		renderCaption(caption, node.attrs.title);
		caption.hidden = false;
		caption.classList.toggle('empty', !node.attrs.title);
		if (!node.attrs.title) caption.textContent = '캡션 추가';
	};

	const startEdit = () => {
		input.value = current.attrs.title;
		caption.hidden = true;
		input.hidden = false;
		fit();
		input.focus();
		// 글 끝에 커서 (전부 골라 두면 글자 하나에 캡션이 통째로 지워진다)
		input.setSelectionRange(input.value.length, input.value.length);
	};
	let editing = false;
	const finish = (save: boolean) => {
		if (input.hidden) return;
		input.hidden = true;
		// 저장하면 곧바로 update가 불려 새 캡션을 그리도록 먼저 편집을 끝낸다
		editing = false;
		const pos = getPos();
		const title = input.value.trim();
		if (save && pos !== undefined && title !== current.attrs.title)
			view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, title }));
		else render(current);
	};
	caption.addEventListener('mousedown', (event) => {
		// 캡션의 링크는 눌러서 연다
		if ((event.target as Element).closest('a')) return;
		event.preventDefault();
		editing = true;
		startEdit();
	});
	input.addEventListener('keydown', (event) => {
		if (event.isComposing) return;
		if (event.key === 'Enter') {
			event.preventDefault();
			finish(true);
			view.focus();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			finish(false);
			view.focus();
		}
	});
	input.addEventListener('blur', () => finish(true));

	render(initial);
	dom.append(frame, caption, input);
	return {
		dom,
		update: (node: Node) => {
			if (node.type !== initial.type) return false;
			current = node;
			if (!editing) render(node);
			return true;
		},
		selectNode: () => dom.classList.add('selected'),
		deselectNode: () => dom.classList.remove('selected'),
		ignoreMutation: () => true,
		// 캡션 입력칸·배치·삭제·크게 보기·내려받기 버튼·캡션 링크는 편집기가 가로채지 않게
		stopEvent: (event: Event) => {
			const target = event.target as Element;
			return Boolean(
				target.closest?.(
					'.memo-caption-input, .memo-figure-delete, .memo-figure-zoom, .memo-figure-download, .memo-figure-layout'
				) ||
				(event.type === 'click' && target.closest?.('.memo-caption a')) ||
				(event.type === 'mousedown' && target.closest?.('.memo-caption'))
			);
		},
	};
};

export const imageBlockView = $view(
	imageBlockSchema.node,
	() => (node, view, getPos) => figureView(node, view, getPos)
);
export const inlineImageView = $view(imageSchema.node, () => (node, view, getPos) => figureView(node, view, getPos));

/** 복사 버튼을 누르면 코드를 클립보드에 넣고 잠깐 체크 표시를 보여 준다 (읽기 화면과 같이) */
export function copyCodeButton(getText: () => string) {
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'memo-overlay-button memo-code-copy';
	button.contentEditable = 'false';
	button.setAttribute('aria-label', '코드 복사');
	const icon = document.createElement('i');
	icon.setAttribute('aria-hidden', 'true');
	const show = (copied: boolean) => {
		icon.className = copied ? 'fa-solid fa-check' : 'fa-regular fa-copy';
		button.title = copied ? '복사됨' : '코드 복사';
		button.toggleAttribute('data-copied', copied);
	};
	show(false);
	button.append(icon);
	let timer: number | undefined;
	button.addEventListener('mousedown', (event) => event.preventDefault());
	button.addEventListener('click', () => {
		void navigator.clipboard?.writeText(getText());
		show(true);
		window.clearTimeout(timer);
		timer = window.setTimeout(() => show(false), 1500);
	});
	return button;
}

/** 코드 블록: 읽기 화면처럼 오른쪽 위에 복사 버튼 */
export const codeBlockView = $view(codeBlockSchema.node, () => (initial) => {
	let current = initial;
	const dom = document.createElement('div');
	dom.className = 'memo-code';
	const pre = document.createElement('pre');
	const code = document.createElement('code');
	pre.append(code);
	const setLanguage = (node: Node) => {
		if (node.attrs.language) pre.dataset.language = node.attrs.language;
		else delete pre.dataset.language;
	};
	setLanguage(initial);
	dom.append(
		pre,
		copyCodeButton(() => current.textContent)
	);
	return {
		dom,
		contentDOM: code,
		update: (node: Node) => {
			if (node.type !== initial.type) return false;
			current = node;
			setLanguage(node);
			return true;
		},
		ignoreMutation: (mutation: ViewMutationRecord) => mutation.type !== 'selection' && !code.contains(mutation.target),
	};
});
