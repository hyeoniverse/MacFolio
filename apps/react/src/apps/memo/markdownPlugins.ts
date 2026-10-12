import type { Options } from 'react-markdown';
import remarkCjkFriendly from 'remark-cjk-friendly';
import remarkGfm from 'remark-gfm';
import { tagsInText } from '@macfolio/desktop-core/memo';

/**
 * 글을 읽을 때 쓰는 Markdown 규칙: 표 · 취소선 · 체크 목록(GFM), 그리고 한국어 사이의 굵게·기울임.
 * CommonMark 규칙만으로는 `**취소(cancelled)**가`처럼 문장부호 뒤의 `**`에 조사가 바로 붙으면 굵게가 끝나지 않는다.
 * 편집기(writer/InlineEditor.tsx)에도 같은 규칙을 건다.
 */
export const REMARK_PLUGINS: Options['remarkPlugins'] = [remarkGfm, remarkCjkFriendly, remarkDetails, remarkTags];

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

const DETAILS_OPEN = /^<details(?:\s+id="([a-z0-9-]+)")?(\s+open)?\s*>\s*(?:<summary>([^<]*)<\/summary>)?\s*$/i;
const DETAILS_CLOSE = /^<\/details>\s*$/i;

/** 엔티티 몇 개만 글자로 (요약은 글자로만 그린다: HTML로 넣지 않는다) */
const decodeText = (text: string) =>
	text
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&')
		.trim();

/**
 * 접기(토글) 블록: GitHub와 같은 표기를 `<details>`로 그린다.
 *
 * ```md
 * <details>
 * <summary>제목</summary>
 *
 * 접힌 내용 (Markdown)
 *
 * </details>
 * ```
 *
 * 본문의 HTML은 그리지 않는다(안전). 이 플러그인은 위 모양의 여는·닫는 줄만 알아보고 그 사이의 Markdown 노드를 감싼다.
 * 요약은 글자로만 넣는다. `<details open>`이면 펼친 채로 시작한다. 짝이 없는 줄은 지금처럼 그리지 않는다.
 * `<details id="terms">`이면 `[링크](#terms)`로 찾아갈 수 있다. 사이트의 다른 id와 겹치지 않게 각주처럼
 * `user-content-`를 앞에 붙인다 (MarkdownLink가 둘 다 찾는다)
 */
export function remarkDetails() {
	const group = (parent: MdNode) => {
		if (!parent.children) return;
		const out: MdNode[] = [];
		const stack: { node: MdNode; from: MdNode[] }[] = [];
		let target = out;
		for (const child of parent.children) {
			group(child);
			const html = child.type === 'html' ? (child.value ?? '').trim() : '';
			const open = html.match(DETAILS_OPEN);
			if (open) {
				const [, id, isOpen, summaryText] = open;
				const summary = decodeText(summaryText ?? '') || '자세히';
				const node: MdNode = {
					type: 'memoDetails',
					data: {
						hName: 'details',
						hProperties: {
							className: ['memo-details'],
							open: Boolean(isOpen),
							...(id ? { id: `user-content-${id.toLowerCase()}` } : {}),
						},
					},
					children: [{ type: 'memoSummary', data: { hName: 'summary' }, children: [{ type: 'text', value: summary }] }],
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
		// 닫히지 않은 블록은 글 끝까지를 감싼다
		while (stack.length) {
			const { node, from } = stack.pop()!;
			from.push(node);
		}
		parent.children = out;
	};
	return (tree: MdNode) => group(tree);
}
