// 편집기의 각주와 글 안 링크: 읽기 화면(MarkdownLink, remark-gfm의 각주)과 같은 번호와 같은 이동.
// - 각주 번호는 저장한 이름([^no-ff])이 아니라 본문에 처음 나온 차례(1, 2, 3 …)로 보인다
// - 본문의 [번호]를 누르면 각주 내용으로, 각주 끝의 ↩ 를 누르면 본문의 그 자리로 간다
// - [글자](#terms) 같은 글 안 링크를 누르면 그 자리(접기 블록, 각주)로 간다. Option(Alt)을 누른 채 누르면 링크 글자를 고친다
// 도착한 자리는 읽기 화면처럼 잠깐 칠한다 (memo-anchor-hit)
import type { Node } from '@milkdown/kit/prose/model';
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet, type EditorView, type ViewMutationRecord } from '@milkdown/kit/prose/view';
import { footnoteDefinitionSchema, footnoteReferenceSchema } from '@milkdown/kit/preset/gfm';
import { $prose, $view } from '@milkdown/kit/utils';

/** 도착 표시를 지우기까지 (styles/markdown.css의 memo-anchor-hit 애니메이션 길이) */
const HIT_MS = 1600;

/** 각주 이름 → 번호. 본문에 처음 나온 차례로 매기고, 본문에서 쓰지 않은 각주는 그 뒤에 이어 붙인다 */
export function footnoteNumbers(doc: Node): Map<string, number> {
	const numbers = new Map<string, number>();
	const definitions: string[] = [];
	doc.descendants((node) => {
		const label = node.attrs.label as string;
		if (node.type.name === 'footnote_reference' && !numbers.has(label)) numbers.set(label, numbers.size + 1);
		if (node.type.name === 'footnote_definition') definitions.push(label);
	});
	for (const label of definitions) if (!numbers.has(label)) numbers.set(label, numbers.size + 1);
	return numbers;
}

/** 이름이 label인 첫 노드의 자리 */
function findNode(doc: Node, type: string, label: string) {
	let found: { pos: number; node: Node } | null = null;
	doc.descendants((node, pos) => {
		if (found) return false;
		if (node.type.name === type && node.attrs.label === label) found = { pos, node };
		return true;
	});
	return found as { pos: number; node: Node } | null;
}

/** 접기 블록 id(짧은 이름)로 찾는다 */
function findDetails(doc: Node, id: string) {
	let found: { pos: number; node: Node } | null = null;
	doc.descendants((node, pos) => {
		if (found) return false;
		if (node.type.name === 'details_block' && node.attrs.id === id) found = { pos, node };
		return true;
	});
	return found as { pos: number; node: Node } | null;
}

/**
 * 글 안 링크의 # 뒤 이름으로 갈 자리. 읽기 화면의 id와 같은 이름을 받는다:
 * user-content-fn-이름(각주 내용), user-content-fnref-이름(본문의 각주 번호), 접기 블록의 id(terms, user-content-terms)
 */
export function anchorTarget(doc: Node, hash: string) {
	const name = decodeURIComponent(hash.replace(/^#/, '')).replace(/^user-content-/, '');
	const fn = /^fn-(.+)$/.exec(name);
	if (fn) return findNode(doc, 'footnote_definition', fn[1]);
	const ref = /^fnref-(.+?)(?:-\d+)?$/.exec(name);
	if (ref) return findNode(doc, 'footnote_reference', ref[1]);
	return findDetails(doc, name.toLowerCase());
}

interface AnchorsState {
	/** 잠깐 칠할 도착 자리 */
	hit: { from: number; to: number } | null;
	/**
	 * 링크를 따라가느라 화면에서만 펼친 접기 블록의 자리. 읽기 화면처럼 저장한 글(<details open>)은 바꾸지 않는다.
	 * › 를 누르면 다시 접힌다 (details.ts)
	 */
	revealed: number[];
}

const key = new PluginKey<AnchorsState>('memoAnchors');

/** 화면에서만 펼친 접기 블록인지 */
export const isRevealed = (state: EditorState, pos: number) => key.getState(state)?.revealed.includes(pos) ?? false;

/** 화면에서만 펼친 것을 거둔다 (› 로 접을 때) */
export const unreveal = (tr: Transaction, state: EditorState, pos: number) =>
	tr.setMeta(key, { revealed: (key.getState(state)?.revealed ?? []).filter((at) => at !== pos) });

/** 노드 안의 마지막 글자 자리 (각주 내용 끝에 커서를 둔다) */
function lastTextPos(node: Node, pos: number) {
	let end = pos + 1;
	node.descendants((child, at) => {
		if (child.isTextblock) end = pos + 1 + at + child.nodeSize - 1;
	});
	return end;
}

/**
 * pos의 노드로 간다: 그 노드를 감싼 접힌 블록을 화면에서 펼치고, 커서를 옮기고, 화면 가운데로 부드럽게 넘기고, 잠깐 칠한다
 * @param caret 커서를 둘 자리 (각주 내용이면 그 끝, 본문 번호면 바로 뒤)
 */
function goTo(view: EditorView, pos: number, caret: number) {
	const { state } = view;
	const node = state.doc.nodeAt(pos);
	if (!node) return;
	const revealed = new Set(key.getState(state)?.revealed ?? []);
	const $pos = state.doc.resolve(pos);
	for (let depth = $pos.depth; depth > 0; depth--) {
		if ($pos.node(depth).type.name === 'details_block' && !$pos.node(depth).attrs.open)
			revealed.add($pos.before(depth));
	}
	if (node.type.name === 'details_block' && !node.attrs.open) revealed.add(pos);
	const tr = state.tr.setSelection(TextSelection.near(state.doc.resolve(caret)));
	tr.setMeta(key, { hit: { from: pos, to: pos + node.nodeSize }, revealed: [...revealed] });
	view.dispatch(tr);
	view.focus();
	const dom = view.nodeDOM(pos);
	if (dom instanceof HTMLElement) {
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		dom.scrollIntoView({
			block: node.type.name === 'details_block' ? 'start' : 'center',
			behavior: reduce ? 'auto' : 'smooth',
		});
	}
	window.setTimeout(() => {
		if (!view.isDestroyed) view.dispatch(view.state.tr.setMeta(key, { hit: null }));
	}, HIT_MS);
}

/** 본문의 [번호] → 각주 내용 */
export function goToDefinition(view: EditorView, label: string) {
	const found = findNode(view.state.doc, 'footnote_definition', label);
	if (found) goTo(view, found.pos, lastTextPos(found.node, found.pos));
}

/** 각주 내용의 ↩ → 본문에서 그 각주를 처음 쓴 자리 */
export function goToReference(view: EditorView, label: string) {
	const found = findNode(view.state.doc, 'footnote_reference', label);
	if (found) goTo(view, found.pos, found.pos + found.node.nodeSize);
}

/** 글 안 링크(#이름)를 따라간다. 갈 자리가 없으면 false */
export function followAnchor(view: EditorView, hash: string): boolean {
	const found = anchorTarget(view.state.doc, hash);
	if (!found) return false;
	const { pos, node } = found;
	if (node.type.name === 'footnote_definition') goTo(view, pos, lastTextPos(node, pos));
	else if (node.type.name === 'footnote_reference') goTo(view, pos, pos + node.nodeSize);
	// 접기 블록은 요약 끝에 커서를 둔다
	else goTo(view, pos, pos + 1 + (node.firstChild?.nodeSize ?? 2) - 1);
	return true;
}

/** ↩ 버튼 (각주 내용 끝, 읽기 화면의 되돌아가기 링크와 같은 자리·모양) */
function backrefWidget(label: string, number: number) {
	return (view: EditorView) => {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'memo-footnote-backref';
		button.contentEditable = 'false';
		button.textContent = '↩';
		button.setAttribute('aria-label', `본문의 ${number}번 각주 자리로 돌아가기`);
		button.title = '본문의 각주 자리로 돌아가기';
		button.addEventListener('mousedown', (event) => event.preventDefault());
		button.addEventListener('click', () => goToReference(view, label));
		return button;
	};
}

function decorationsOf(state: EditorState, { hit, revealed }: AnchorsState) {
	const numbers = footnoteNumbers(state.doc);
	const referenced = new Set<string>();
	state.doc.descendants((node) => {
		if (node.type.name === 'footnote_reference') referenced.add(node.attrs.label as string);
	});
	const decorations: Decoration[] = [];
	state.doc.descendants((node, pos) => {
		const label = node.attrs.label as string;
		const number = numbers.get(label);
		if (node.type.name === 'footnote_reference' && number) {
			decorations.push(Decoration.node(pos, pos + node.nodeSize, { title: `${number}번 각주로 가기` }, { number }));
		}
		if (node.type.name === 'footnote_definition' && number) {
			decorations.push(Decoration.node(pos, pos + node.nodeSize, {}, { number }));
			if (referenced.has(label))
				decorations.push(
					Decoration.widget(lastTextPos(node, pos), backrefWidget(label, number), {
						side: 1,
						ignoreSelection: true,
						key: `backref-${label}-${number}`,
					})
				);
		}
	});
	if (hit && hit.to <= state.doc.content.size)
		decorations.push(Decoration.node(hit.from, hit.to, { class: 'memo-anchor-hit' }));
	for (const pos of revealed) {
		const node = state.doc.nodeAt(pos);
		if (node?.type.name === 'details_block')
			// data-open을 덮어쓰면 데코레이션을 거둘 때 속성이 지워진다. 따로 class로 표시한다
			decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: 'memo-details-revealed' }));
	}
	return DecorationSet.create(state.doc, decorations);
}

export const anchorsPlugin = $prose(
	() =>
		new Plugin<AnchorsState>({
			key,
			state: {
				init: (): AnchorsState => ({ hit: null, revealed: [] }),
				apply: (tr, value, _old, next) => {
					const meta = tr.getMeta(key) as Partial<AnchorsState> | undefined;
					const current = meta ? { ...value, ...meta } : value;
					if (!tr.docChanged) return current;
					// 글이 바뀌면 칠한 자리와 펼친 블록도 따라간다
					const hit = current.hit && {
						from: tr.mapping.map(current.hit.from),
						to: tr.mapping.map(current.hit.to, -1),
					};
					const revealed = current.revealed
						.map((pos) => tr.mapping.map(pos))
						.filter((pos) => next.doc.nodeAt(pos)?.type.name === 'details_block');
					return { hit: hit && hit.to > hit.from ? hit : null, revealed };
				},
			},
			props: {
				decorations(state) {
					return decorationsOf(state, key.getState(state) ?? { hit: null, revealed: [] });
				},
				handleClickOn(view, _pos, node, _nodePos, event, direct) {
					if (!direct || node.type.name !== 'footnote_reference' || event.button !== 0) return false;
					goToDefinition(view, node.attrs.label as string);
					return true;
				},
				handleClick(view, _pos, event) {
					if (event.button !== 0 || event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return false;
					const link = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
					const href = link?.getAttribute('href');
					if (!link || !href || href.length < 2 || !view.dom.contains(link)) return false;
					return followAnchor(view, href);
				},
			},
		})
);

/** 데코레이션에 실어 보낸 각주 번호 */
const numberOf = (decorations: readonly Decoration[]) =>
	String((decorations.find((decoration) => decoration.spec.number)?.spec.number as number | undefined) ?? '');

/** 본문의 각주 번호: 이름([^no-ff]) 대신 번호만 그린다. [ ] 는 CSS가 붙인다 (읽기 화면과 같게) */
export const footnoteReferenceView = $view(
	footnoteReferenceSchema.node,
	() => (initial, _view, _getPos, decorations) => {
		const dom = document.createElement('sup');
		dom.dataset.type = 'footnote_reference';
		dom.dataset.label = initial.attrs.label as string;
		dom.textContent = numberOf(decorations);
		return {
			dom,
			update: (node, next) => {
				if (node.type !== initial.type) return false;
				dom.dataset.label = node.attrs.label as string;
				dom.textContent = numberOf(next);
				return true;
			},
			ignoreMutation: () => true,
		};
	}
);

/** 글 끝의 각주 내용: 번호 칸(고칠 수 없다) + 내용 */
export const footnoteDefinitionView = $view(
	footnoteDefinitionSchema.node,
	() => (initial, _view, _getPos, decorations) => {
		const dom = document.createElement('dl');
		dom.dataset.type = 'footnote_definition';
		dom.dataset.label = initial.attrs.label as string;
		const dt = document.createElement('dt');
		dt.contentEditable = 'false';
		const dd = document.createElement('dd');
		dom.append(dt, dd);
		const setNumber = (decos: readonly Decoration[]) => {
			const number = numberOf(decos);
			dt.textContent = number ? `${number}.` : '';
		};
		setNumber(decorations);
		return {
			dom,
			contentDOM: dd,
			update: (node, next) => {
				if (node.type !== initial.type) return false;
				dom.dataset.label = node.attrs.label as string;
				setNumber(next);
				return true;
			},
			ignoreMutation: (mutation: ViewMutationRecord) => mutation.type !== 'selection' && !dd.contains(mutation.target),
		};
	}
);
