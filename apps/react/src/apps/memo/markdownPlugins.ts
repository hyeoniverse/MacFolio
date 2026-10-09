import type { Options } from 'react-markdown';
import remarkCjkFriendly from 'remark-cjk-friendly';
import remarkGfm from 'remark-gfm';
import { tagsInText } from '@macfolio/desktop-core/memo';

/**
 * 글을 읽을 때 쓰는 Markdown 규칙: 표 · 취소선 · 체크 목록(GFM), 그리고 한국어 사이의 굵게·기울임.
 * CommonMark 규칙만으로는 `**취소(cancelled)**가`처럼 문장부호 뒤의 `**`에 조사가 바로 붙으면 굵게가 끝나지 않는다.
 * 편집기(writer/InlineEditor.tsx)에도 같은 규칙을 건다.
 */
export const REMARK_PLUGINS: Options['remarkPlugins'] = [remarkGfm, remarkCjkFriendly, remarkTags];

interface MdNode {
	type: string;
	value?: string;
	children?: MdNode[];
	data?: { hName?: string; hProperties?: Record<string, unknown> };
}

/** 태그로 바꾸지 않는 곳: 코드, 링크(글자도 링크의 일부), HTML */
const NO_TAGS = new Set(['code', 'inlineCode', 'link', 'linkReference', 'html', 'image', 'imageReference']);

/**
 * 본문의 #태그를 `<span class="memo-tag" data-tag="이름">`으로 (tags.ts의 규칙).
 * 누르면 그 태그의 글만 본다 (Memo.tsx가 클릭을 받는다)
 */
export function remarkTags() {
	const walk = (node: MdNode) => {
		if (!node.children || NO_TAGS.has(node.type)) return;
		node.children = node.children.flatMap((child): MdNode[] => {
			if (child.type !== 'text' || !child.value) {
				walk(child);
				return [child];
			}
			const tags = tagsInText(child.value);
			if (!tags.length) return [child];
			const parts: MdNode[] = [];
			let last = 0;
			for (const { name, start, end } of tags) {
				if (start > last) parts.push({ type: 'text', value: child.value.slice(last, start) });
				parts.push({
					type: 'memoTag',
					data: { hName: 'span', hProperties: { className: ['memo-tag'], dataTag: name } },
					children: [{ type: 'text', value: `#${name}` }],
				});
				last = end;
			}
			if (last < child.value.length) parts.push({ type: 'text', value: child.value.slice(last) });
			return parts;
		});
	};
	return (tree: MdNode) => walk(tree);
}
