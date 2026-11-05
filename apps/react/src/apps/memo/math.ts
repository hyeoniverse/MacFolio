// 메모 본문의 수식 (rehype 플러그인). 블록은 ```math 코드 블록(GitHub와 같은 표기), 인라인은 `식{:math}` 인라인 코드.
// 여기서는 수식 자리만 <memo-math>로 표시하고, KaTeX는 그 글을 열 때 MemoMath가 불러와 그린다 (첫 화면 번들에 넣지 않는다)
import type { Element, Root } from 'hast';
import { toText } from 'hast-util-to-text';
import { visit } from 'unist-util-visit';

/** 인라인 코드 끝의 수식 꼬리표: `\sigma_{A}(R){:math}` → 식 `\sigma_{A}(R)` */
const INLINE_MATH = /^([\s\S]*\S)\{:math\}$/;

const mathElement = (tex: string, display: boolean): Element => ({
	type: 'element',
	tagName: 'memo-math',
	// 그리기 전(또는 KaTeX를 못 불러왔을 때)에는 식을 글자로 보인다
	properties: { dataTex: tex, dataDisplay: display ? 'true' : 'false' },
	children: [{ type: 'text', value: tex }],
});

const isMathBlock = (node: Element) =>
	node.tagName === 'code' &&
	Array.isArray(node.properties.className) &&
	node.properties.className.map(String).includes('language-math');

/** ```math 블록과 `식{:math}` 인라인 코드를 수식 자리(<memo-math>)로 바꾼다 */
export function rehypeMath() {
	return (tree: Root) => {
		visit(tree, 'element', (node, index, parent) => {
			if (!parent || index === undefined) return;
			if (node.tagName === 'pre') {
				const code = node.children.find((child): child is Element => child.type === 'element');
				if (code && isMathBlock(code)) parent.children[index] = mathElement(toText(code).trim(), true);
				return;
			}
			if (node.tagName !== 'code') return;
			const match = INLINE_MATH.exec(toText(node, { whitespace: 'pre' }));
			if (match) parent.children[index] = mathElement(match[1], false);
		});
	};
}
