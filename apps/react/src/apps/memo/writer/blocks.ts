// 편집기 블록: 이미지 블록(이미지만 있는 문단), 복사 단추가 있는 코드 블록.
// 둘 다 읽기 화면(MarkdownImage, CodeBlock)과 같은 DOM 구조로 그린다.
import { codeBlockSchema, imageSchema } from '@milkdown/kit/preset/commonmark';
import type { Node } from '@milkdown/kit/prose/model';
import type { ViewMutationRecord } from '@milkdown/kit/prose/view';
import { $nodeSchema, $remark, $view } from '@milkdown/kit/utils';
import { visit } from 'unist-util-visit';
import { captionParts } from '../caption';

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

/** 이미지(블록·글줄 안) 모양: 읽기 화면처럼 가운데 그림 + 아래 캡션 */
const figureView = (initial: Node) => {
	const dom = document.createElement('span');
	dom.className = 'memo-figure';
	const img = document.createElement('img');
	const caption = document.createElement('span');
	caption.className = 'memo-caption';
	const render = (node: Node) => {
		img.src = node.attrs.src;
		img.alt = node.attrs.alt;
		renderCaption(caption, node.attrs.title);
	};
	render(initial);
	dom.append(img, caption);
	return {
		dom,
		update: (node: Node) => {
			if (node.type !== initial.type) return false;
			render(node);
			return true;
		},
		selectNode: () => dom.classList.add('selected'),
		deselectNode: () => dom.classList.remove('selected'),
		ignoreMutation: () => true,
		// 캡션의 링크는 눌러서 열 수 있게 (편집기가 가로채지 않게)
		stopEvent: (event: Event) => event.type === 'click' && (event.target as Element).closest('a') !== null,
	};
};

export const imageBlockView = $view(imageBlockSchema.node, () => (node) => figureView(node));
export const inlineImageView = $view(imageSchema.node, () => (node) => figureView(node));

/** 복사 단추를 누르면 코드를 클립보드에 넣고 잠깐 '복사됨'을 보여 준다 (읽기 화면과 같이) */
export function copyCodeButton(getText: () => string) {
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'memo-code-copy';
	button.contentEditable = 'false';
	button.setAttribute('aria-label', '코드 복사');
	button.textContent = '복사';
	let timer: number | undefined;
	button.addEventListener('mousedown', (event) => event.preventDefault());
	button.addEventListener('click', () => {
		void navigator.clipboard?.writeText(getText());
		button.textContent = '복사됨';
		window.clearTimeout(timer);
		timer = window.setTimeout(() => (button.textContent = '복사'), 1500);
	});
	return button;
}

/** 코드 블록: 읽기 화면처럼 오른쪽 위에 복사 단추 */
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
