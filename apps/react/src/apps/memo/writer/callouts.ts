// 편집기의 콜아웃: `> [!NOTE]`로 시작하는 인용 블록을 읽기 화면의 콜아웃과 같은 색 상자로 보인다.
// 글(인용 블록과 [!NOTE] 글자)은 그대로 두고 class만 덧씌운다 (styles/prose.css의 .memo-callout)
import type { Node } from '@milkdown/kit/prose/model';
import { Plugin } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';
import { CALLOUT_MARK } from '../markdownPlugins';

function calloutDecorations(doc: Node) {
	const decorations: Decoration[] = [];
	doc.descendants((node, pos) => {
		if (node.type.name !== 'blockquote') return true;
		const match = CALLOUT_MARK.exec(node.firstChild?.textContent ?? '');
		if (match)
			decorations.push(
				Decoration.node(pos, pos + node.nodeSize, {
					class: `memo-callout memo-callout-${match[1].toLowerCase()}`,
				})
			);
		return true;
	});
	return DecorationSet.create(doc, decorations);
}

export const calloutsPlugin = $prose(
	() =>
		new Plugin<DecorationSet>({
			state: {
				init: (_config, state) => calloutDecorations(state.doc),
				apply: (tr, old) => (tr.docChanged ? calloutDecorations(tr.doc) : old),
			},
			props: {
				decorations(state) {
					return this.getState(state);
				},
			},
		})
);
