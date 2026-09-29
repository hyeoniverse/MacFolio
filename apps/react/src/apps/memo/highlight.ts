// 메모 본문 코드 블록의 문법 강조 (rehype 플러그인).
// highlight.js 전체(약 190개 언어)나 흔한 언어 묶음 대신 블로그에 쓰는 언어만 등록해 번들을 줄인다.
import type { Element, Root } from 'hast';
import { toText } from 'hast-util-to-text';
import { createLowlight } from 'lowlight';
import { visit } from 'unist-util-visit';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

const lowlight = createLowlight({ bash, css, javascript, json, markdown, typescript, xml, yaml });
// 코드 블록에 흔히 적는 다른 이름 (```tsx, ```sh 등)
lowlight.registerAlias({
	typescript: ['ts', 'tsx'],
	javascript: ['js', 'jsx'],
	bash: ['sh', 'shell', 'zsh'],
	xml: ['html'],
	markdown: ['md'],
	yaml: ['yml'],
});

/** 코드 블록의 언어 (class="language-tsx" → tsx) */
const languageOf = (node: Element) =>
	(Array.isArray(node.properties.className) ? node.properties.className : [])
		.map(String)
		.find((name) => name.startsWith('language-'))
		?.slice('language-'.length);

/** ```언어 로 적은 코드 블록을 강조한다. 언어를 적지 않았거나 모르는 언어면 그대로 둔다 */
export function rehypeHighlightCode() {
	return (tree: Root) => {
		visit(tree, 'element', (node, _index, parent) => {
			if (node.tagName !== 'code' || (parent as Element | undefined)?.tagName !== 'pre') return;
			const language = languageOf(node);
			if (!language || !lowlight.registered(language)) return;
			const result = lowlight.highlight(language, toText(node, { whitespace: 'pre' }));
			node.children = result.children as Element['children'];
			node.properties.className = [...(node.properties.className as string[]), 'hljs'];
		});
	};
}

/** 편집기용: 코드를 강조한 트리. 모르는 언어면 null */
export function highlightTree(language: string | undefined, code: string) {
	if (!language || !lowlight.registered(language)) return null;
	return lowlight.highlight(language, code);
}
