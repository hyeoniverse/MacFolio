// 편집기 안에서 찾기·대치 (macOS 메모의 찾기 막대). 찾은 자리를 칠하고, 지금 자리는 진하게, 대치는 트랜잭션으로.
import type { Node } from '@milkdown/kit/prose/model';
import { Plugin, PluginKey, TextSelection, type Transaction } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet, type EditorView } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';
import { findMatches, type FindOptions } from '@macfolio/desktop-core/memo';
import { editorControls } from './editorControls';

interface Match {
	from: number;
	to: number;
}

interface FindState {
	query: string;
	options: FindOptions | null;
	index: number;
	matches: Match[];
}

const EMPTY: FindState = { query: '', options: null, index: -1, matches: [] };

export const findKey = new PluginKey<FindState>('memo-find');

/** 문단·칸마다 찾는다. 글줄 안의 이미지 같은 요소는 한 글자로 쳐서 자리가 어긋나지 않게 한다 */
function matchesIn(doc: Node, query: string, options: FindOptions): Match[] {
	const matches: Match[] = [];
	doc.descendants((node, pos) => {
		if (!node.isTextblock) return true;
		const text = node.textBetween(0, node.content.size, undefined, '￼');
		for (const [start, end] of findMatches(text, query, options))
			matches.push({ from: pos + 1 + start, to: pos + 1 + end });
		return false;
	});
	return matches;
}

const publishResult = (state: FindState) =>
	editorControls.setState((current) => ({
		...current,
		find: state.options ? { count: state.matches.length, index: state.index } : null,
	}));

export const findPlugin = $prose(
	() =>
		new Plugin<FindState>({
			key: findKey,
			state: {
				init: () => EMPTY,
				apply: (tr, prev) => {
					const meta = tr.getMeta(findKey) as Partial<FindState> | 'clear' | undefined;
					if (meta === 'clear') return EMPTY;
					const next = { ...prev, ...meta };
					if (!next.options || !next.query) return { ...next, matches: [], index: -1 };
					if (!meta && !tr.docChanged) return prev;
					const matches = matchesIn(tr.doc, next.query, next.options);
					return { ...next, matches, index: Math.min(next.index, matches.length - 1) };
				},
			},
			props: {
				decorations(state) {
					const find = findKey.getState(state);
					if (!find?.matches.length) return null;
					return DecorationSet.create(
						state.doc,
						find.matches.map((match, index) =>
							Decoration.inline(match.from, match.to, {
								class: index === find.index ? 'memo-find-match memo-find-current' : 'memo-find-match',
							})
						)
					);
				},
			},
			view: () => ({
				update: (view, prevState) => {
					const next = findKey.getState(view.state);
					if (next && next !== findKey.getState(prevState)) publishResult(next);
				},
				destroy: () => editorControls.setState((current) => ({ ...current, find: null })),
			}),
		})
);

/** 지금 자리를 고르고 화면에 보이게 (찾기 칸의 초점은 그대로) */
function reveal(tr: Transaction, match: Match | undefined) {
	return match ? tr.setSelection(TextSelection.create(tr.doc, match.from, match.to)).scrollIntoView() : tr;
}

/** 찾기: 검색어·옵션·지금 몇 번째를 정한다 (index -1이면 아직 고르지 않음) */
export function setFind(view: EditorView, query: string, options: FindOptions, index: number) {
	const tr = view.state.tr.setMeta(findKey, { query, options, index });
	const matches = options && query ? matchesIn(view.state.doc, query, options) : [];
	view.dispatch(index >= 0 ? reveal(tr, matches[index]) : tr);
}

export function clearFind(view: EditorView) {
	view.dispatch(view.state.tr.setMeta(findKey, 'clear'));
}

/** 대치: 지금 자리 하나(없으면 첫 자리)나 모두. 하나를 바꾸면 다음 자리로 간다 */
export function replaceFind(view: EditorView, replacement: string, all: boolean) {
	const find = findKey.getState(view.state);
	if (!find?.matches.length) return;
	const { tr } = view.state;
	if (all) {
		// 뒤에서부터 바꿔야 앞 자리가 밀리지 않는다
		for (const match of [...find.matches].reverse()) tr.insertText(replacement, match.from, match.to);
		view.dispatch(tr.setMeta(findKey, { index: -1 }));
		return;
	}
	const index = Math.max(find.index, 0);
	const match = find.matches[index];
	tr.insertText(replacement, match.from, match.to);
	const rest = matchesIn(tr.doc, find.query, find.options!);
	// 바꾼 자리 뒤의 첫 자리 (없으면 순환 검색일 때 처음으로)
	let next = rest.findIndex((item) => item.from >= match.from + replacement.length);
	if (next === -1) next = find.options!.wrap && rest.length ? 0 : rest.length - 1;
	view.dispatch(reveal(tr.setMeta(findKey, { index: next }), rest[next]));
}
