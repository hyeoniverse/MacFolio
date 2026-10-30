// 편집기의 토글 목록(접기 블록): 읽기 화면의 remarkDetails와 같은 `<details>` 표기를 읽고, 고친 뒤 같은 표기로 저장한다.
// 요약 줄은 글자만 쓰는 칸이고, 그 아래 블록이 접히는 내용이다. 요약 앞의 › 를 누르면 화면에서만 접고 펼친다 (글은 바꾸지 않아 저장하지 않는다).
// 저장하는 펼침 여부(<details open>)는 읽어 온 그대로이고, 새로 만든 토글은 펼친 것으로 저장한다.
import { Fragment, type Node } from '@milkdown/kit/prose/model';
import { Plugin, TextSelection, type EditorState } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { $nodeSchema, $prose, $remark } from '@milkdown/kit/utils';
import { decodeText, DETAILS_CLOSE, DETAILS_OPEN, detailsOpenHtml } from '../markdownPlugins';
import { isShownOpen, showOnScreen } from './anchors';

interface MdNode {
	type: string;
	value?: string;
	children?: MdNode[];
	summary?: string;
	open?: boolean;
	id?: string;
}

/** 요약 앞의 › 자리 (이만큼 왼쪽을 누르면 접고 펼친다) */
const TOGGLE_HIT_PX = 26;

/** 블록 HTML 한 줄의 글. 편집기는 맨 위의 HTML을 문단으로 감싸 두므로 그 모양도 본다 */
const htmlOf = (node: MdNode) => {
	if (node.type === 'html') return node.value ?? '';
	const only = node.type === 'paragraph' && node.children?.length === 1 ? node.children[0] : null;
	return only?.type === 'html' ? (only.value ?? '') : '';
};

/** 여는 줄과 닫는 줄 사이의 블록을 토글 노드로 감싼다 (짝이 없으면 글 끝까지) */
export const detailsRemark = $remark('memoDetailsRemark', () => () => (tree: MdNode) => {
	const group = (parent: MdNode) => {
		if (!parent.children) return;
		const out: MdNode[] = [];
		const stack: { node: MdNode; from: MdNode[] }[] = [];
		let target = out;
		for (const child of parent.children) {
			// 문단은 글줄만 담으므로 들여다보지 않는다 (HTML 줄을 감싼 문단 안에 토글을 만들면 문단을 만들 수 없다)
			if (child.type !== 'paragraph') group(child);
			const html = htmlOf(child).trim();
			const open = html.match(DETAILS_OPEN);
			if (open) {
				const [, id, isOpen, summary] = open;
				const node: MdNode = {
					type: 'memoDetailsBlock',
					summary: decodeText(summary ?? ''),
					open: Boolean(isOpen),
					id: id?.toLowerCase() ?? '',
					children: [],
				};
				stack.push({ node, from: target });
				target = node.children!;
				continue;
			}
			if (DETAILS_CLOSE.test(html) && stack.length) {
				const { node, from } = stack.pop()!;
				from.push(node);
				target = from;
				continue;
			}
			target.push(child);
		}
		while (stack.length) {
			const { node, from } = stack.pop()!;
			from.push(node);
		}
		parent.children = out;
	};
	group(tree);
});

export const detailsSummarySchema = $nodeSchema('details_summary', () => ({
	content: 'text*',
	marks: '',
	defining: true,
	parseDOM: [{ tag: 'div[data-details-summary]' }],
	toDOM: () => ['div', { 'data-details-summary': '', class: 'memo-details-summary' }, 0],
	// 토글 노드가 읽고 쓴다
	parseMarkdown: { match: () => false, runner: () => {} },
	toMarkdown: { match: (node) => node.type.name === 'details_summary', runner: () => {} },
}));

export const detailsSchema = $nodeSchema('details_block', (ctx) => ({
	group: 'block',
	content: 'details_summary block+',
	defining: true,
	attrs: {
		open: { default: true, validate: 'boolean' },
		id: { default: '', validate: 'string' },
	},
	parseDOM: [
		{
			tag: 'div[data-details]',
			getAttrs: (dom) => ({
				open: (dom as HTMLElement).dataset.open !== 'false',
				id: (dom as HTMLElement).dataset.id ?? '',
			}),
		},
	],
	toDOM: (node) => [
		'div',
		{
			'data-details': '',
			'data-open': String(node.attrs.open),
			'data-id': node.attrs.id,
			class: 'memo-details prose-details',
		},
		0,
	],
	parseMarkdown: {
		match: (node) => node.type === 'memoDetailsBlock',
		runner: (state, node, type) => {
			const { summary, open, id, children } = node as unknown as MdNode;
			state.openNode(type, { open: Boolean(open), id: id ?? '' });
			state.openNode(detailsSummarySchema.type(ctx));
			if (summary) state.addText(summary);
			state.closeNode();
			state.next((children ?? []) as never);
			state.closeNode();
		},
	},
	toMarkdown: {
		match: (node) => node.type.name === 'details_block',
		runner: (state, node) => {
			const blocks: Node[] = [];
			node.forEach((child, _offset, index) => {
				if (index > 0) blocks.push(child);
			});
			const summary = node.firstChild?.textContent ?? '';
			state.addNode('html', undefined, detailsOpenHtml({ summary, open: node.attrs.open, id: node.attrs.id }));
			state.next(Fragment.from(blocks));
			state.addNode('html', undefined, '</details>');
		},
	},
}));

/** 커서가 있는 가장 안쪽 토글 (없으면 null) */
export function detailsAt(state: EditorState) {
	const { $from } = state.selection;
	for (let depth = $from.depth; depth > 0; depth--) {
		const node = $from.node(depth);
		if (node.type.name === 'details_block') return { pos: $from.before(depth), node };
	}
	return null;
}

/**
 * 토글 목록을 켜고 끈다.
 * 토글 안이면 풀어서 요약은 문단으로, 내용은 그 아래로 꺼낸다.
 * 아니면 지금 줄(문단·머리말)을 제목으로 삼는 토글을 만든다. 머리말이면 글자만 제목이 된다 (한 줄에 모양은 하나).
 * 줄을 바꿀 수 없는 자리면 그 블록 아래에 새로 만든다
 */
export function toggleDetails(view: EditorView) {
	const { state } = view;
	const { schema } = state;
	const found = detailsAt(state);
	if (found) {
		const { pos, node } = found;
		const summary = node.firstChild?.textContent ?? '';
		const blocks: Node[] = summary ? [schema.nodes.paragraph.create(null, schema.text(summary))] : [];
		node.forEach((child, _offset, index) => {
			if (index > 0 && !(child.type.name === 'paragraph' && child.content.size === 0)) blocks.push(child);
		});
		if (!blocks.length) blocks.push(schema.nodes.paragraph.create());
		const tr = state.tr.replaceWith(pos, pos + node.nodeSize, blocks);
		view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1))).scrollIntoView());
		return;
	}

	const { $from } = state.selection;
	const paragraph = ['paragraph', 'heading'].includes($from.parent.type.name) ? $from.parent : null;
	const text = paragraph?.textContent ?? '';
	const summaryNode = schema.nodes.details_summary.create(null, text ? schema.text(text) : null);
	const details = schema.nodes.details_block.create({ open: true, id: '' }, [
		summaryNode,
		schema.nodes.paragraph.create(),
	]);
	const container = $from.node(-1);
	const index = $from.index(-1);
	const replace = paragraph && $from.depth > 0 && container.canReplaceWith(index, index + 1, details.type);
	const at = replace ? $from.before() : $from.after(1);
	const tr = replace ? state.tr.replaceWith(at, $from.after(), details) : state.tr.insert(at, details);
	// 요약이 비었으면 요약에, 있으면 내용 첫 줄에 커서를 둔다
	const cursor = text ? at + 1 + summaryNode.nodeSize + 1 : at + 2;
	view.dispatch(tr.setSelection(TextSelection.create(tr.doc, cursor)).scrollIntoView());
}

/**
 * 요약 줄의 키: Enter는 내용 첫 줄로 내려가고(접혀 있으면 펼친다), 맨 앞의 Backspace는 토글을 푼다.
 * 한글을 조합하는 중의 Enter는 건드리지 않는다
 */
export function handleDetailsKey(view: EditorView, event: KeyboardEvent): boolean {
	if (event.isComposing || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return false;
	const { state } = view;
	const { $from, empty } = state.selection;
	if ($from.parent.type.name !== 'details_summary') return false;
	const found = detailsAt(state);
	if (!found) return false;

	if (event.key === 'Backspace' && empty && $from.parentOffset === 0) {
		toggleDetails(view);
		return true;
	}
	if (event.key !== 'Enter') return false;
	const { pos, node } = found;
	const tr = state.tr;
	// 접혀 보이면 화면에서 펼친다 (글은 바꾸지 않는다)
	if (!isShownOpen(state, pos, node)) showOnScreen(tr, state, pos, node, true);
	// 요약 다음 자리. 첫 블록이 빈 문단이면 거기로, 아니면 맨 위에 새 문단을 넣는다
	const contentStart = pos + 1 + (node.firstChild?.nodeSize ?? 0);
	const first = node.maybeChild(1);
	if (!(first?.type.name === 'paragraph' && first.content.size === 0))
		tr.insert(contentStart, state.schema.nodes.paragraph.create());
	view.dispatch(tr.setSelection(TextSelection.create(tr.doc, contentStart + 1)).scrollIntoView());
	return true;
}

/** 접고 펼치는 동안 편집기 전체에 붙이는 표시: 이때만 토글 내용이 아코디언처럼 움직인다 (styles/markdown.css).
 * 늘 움직이게 두면 편집기를 열 때나 토글 안에 새 문단을 쓸 때도 나타나는 움직임이 걸린다.
 * 편집기 맨 바깥(view.dom)의 속성 변화는 편집기가 글 변경으로 읽지 않는다 */
const ANIMATING = 'memo-details-animating';
const ANIMATION_MS = 450;
const animationTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

function animateToggle(view: EditorView) {
	const root = view.dom;
	clearTimeout(animationTimers.get(root));
	root.classList.add(ANIMATING);
	animationTimers.set(
		root,
		setTimeout(() => root.classList.remove(ANIMATING), ANIMATION_MS)
	);
}

/** › 를 누른 것이면 화면에서만 접고 펼친다: 글은 그대로라 고친 것으로 치지 않는다 (임시 저장하지 않는다) */
function toggleOnClick(view: EditorView, node: Node, nodePos: number, event: MouseEvent, direct: boolean): boolean {
	if (!direct || node.type.name !== 'details_summary') return false;
	const dom = view.nodeDOM(nodePos) as HTMLElement | null;
	if (!dom || event.clientX - dom.getBoundingClientRect().left > TOGGLE_HIT_PX) return false;
	const detailsPos = view.state.doc.resolve(nodePos).before();
	const details = view.state.doc.nodeAt(detailsPos);
	if (!details) return false;
	const open = !isShownOpen(view.state, detailsPos, details);
	const tr = showOnScreen(view.state.tr, view.state, detailsPos, details, open);
	// 접을 때 커서가 내용 안에 있으면 요약 끝으로
	if (!open) tr.setSelection(TextSelection.create(tr.doc, nodePos + node.nodeSize - 1));
	animateToggle(view);
	view.dispatch(tr);
	return true;
}

/**
 * 요약 앞의 › 를 누르면 접고 펼친다. 빠르게 다시 누르면 편집기가 두 번 누름으로 받으므로 그것도 한 번 더 누른 것으로 본다
 * (그러지 않으면 펼치자마자 다시 눌러도 접히지 않는다)
 */
export const detailsToggleClick = $prose(
	() =>
		new Plugin({
			props: {
				handleClickOn: (view, _pos, node, nodePos, event, direct) => toggleOnClick(view, node, nodePos, event, direct),
				handleDoubleClickOn: (view, _pos, node, nodePos, event, direct) =>
					toggleOnClick(view, node, nodePos, event, direct),
				handleTripleClickOn: (view, _pos, node, nodePos, event, direct) =>
					toggleOnClick(view, node, nodePos, event, direct),
			},
		})
);
