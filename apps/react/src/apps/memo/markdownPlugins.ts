import type { Options } from 'react-markdown';
import remarkCjkFriendly from 'remark-cjk-friendly';
import remarkGfm from 'remark-gfm';
import { tagsInText } from '@macfolio/desktop-core/memo';

/** 취소선은 `~~`만 쓴다. `~` 하나도 받으면 220~440px, 380~640px처럼 범위를 적은 글이 취소선이 된다 */
export const GFM_OPTIONS = { singleTilde: false } as const;

/**
 * 글을 읽을 때 쓰는 Markdown 규칙: 표 · 취소선 · 체크 목록(GFM), 그리고 한국어 사이의 굵게·기울임.
 * CommonMark 규칙만으로는 `**취소(cancelled)**가`처럼 문장부호 뒤의 `**`에 조사가 바로 붙으면 굵게가 끝나지 않는다.
 * 편집기(writer/InlineEditor.tsx)에도 같은 규칙을 건다.
 */
export const REMARK_PLUGINS: Options['remarkPlugins'] = [
	[remarkGfm, GFM_OPTIONS],
	remarkCjkFriendly,
	remarkDetails,
	remarkTags,
	remarkHighlight,
	remarkHeadingIds,
	remarkCallouts,
];

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

/** 형광펜으로 바꾸지 않는 곳: 코드와 HTML (안의 `==`는 글자 그대로) */
const NO_HIGHLIGHT = new Set(['code', 'inlineCode', 'html', 'image', 'imageReference']);
const HIGHLIGHT_MARK = '==';
const isSpace = (text: string) => /^\s/.test(text);

/**
 * 형광펜(`==강조==`)을 `<mark class="memo-highlight">`로. Obsidian·Typora와 같은 표기다.
 * 한 문단(글줄을 담은 노드) 안에서 `==`를 짝지으며, 사이에 굵게·링크 같은 다른 서식이 있어도 된다.
 * `a == b`처럼 여는 `==` 뒤나 닫는 `==` 앞이 공백이면 형광펜이 아니라 글자 그대로 둔다.
 * 편집기(writer/highlightMark.ts)도 이 함수로 읽는다
 */
/**
 * 제목의 글 안 주소 이름 (GitHub와 같은 규칙): 소문자로 바꾸고, 글자·숫자·공백·`-`·`_`만 남긴 뒤 공백을 `-`로.
 * `## 데이터와 정보` → `데이터와-정보`, `### 1단계: 정규 개체 타입` → `1단계-정규-개체-타입`
 */
export const headingSlug = (text: string) =>
	text
		.trim()
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
		.replace(/\s/g, '-');

const textOf = (node: MdNode): string =>
	node.type === 'text' || node.type === 'inlineCode' ? (node.value ?? '') : (node.children ?? []).map(textOf).join('');

/**
 * 제목에 id를 붙여 `[데이터와 정보](#데이터와-정보)`처럼 글 안의 절로 이동하게 한다.
 * 같은 이름이 또 나오면 GitHub처럼 `-1`, `-2`를 붙인다. 사이트의 다른 id와 겹치지 않게 각주·접기 블록처럼
 * `user-content-`를 앞에 붙인다 (MarkdownLink가 짧은 이름으로도 찾는다)
 */
export function remarkHeadingIds() {
	return (tree: MdNode) => {
		const used = new Map<string, number>();
		const walk = (node: MdNode) => {
			if (node.type === 'heading') {
				const base = headingSlug(textOf(node));
				if (!base) return;
				const count = used.get(base) ?? 0;
				used.set(base, count + 1);
				const slug = count ? `${base}-${count}` : base;
				node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id: `user-content-${slug}` } };
				return;
			}
			node.children?.forEach(walk);
		};
		walk(tree);
	};
}

/** 콜아웃 종류 → 제목·아이콘 (GitHub 경고 표기 `> [!NOTE]`와 같은 다섯 종류) */
export const CALLOUTS = {
	note: { title: '참고', icon: 'fa-solid fa-circle-info' },
	tip: { title: '팁', icon: 'fa-solid fa-lightbulb' },
	important: { title: '중요', icon: 'fa-solid fa-star' },
	warning: { title: '주의', icon: 'fa-solid fa-triangle-exclamation' },
	caution: { title: '경고', icon: 'fa-solid fa-circle-exclamation' },
} as const;
export type CalloutKind = keyof typeof CALLOUTS;

/** 인용 블록 첫 줄의 콜아웃 표시: `[!NOTE]` 뒤에 같은 줄로 적은 글자는 제목이 된다 */
export const CALLOUT_MARK = /^\[!(note|tip|important|warning|caution)\][ \t]*([^\n]*)\n?/i;

/**
 * `> [!NOTE]`로 시작하는 인용 블록을 콜아웃 상자(`<aside class="memo-callout memo-callout-note">`)로 그린다.
 * 제목은 종류 이름(참고·팁·중요·주의·경고)이고, `> [!NOTE] Heath의 정리`처럼 같은 줄에 적으면 그 글자가 제목이 된다.
 * 표시가 없는 인용 블록은 그대로다
 */
export function remarkCallouts() {
	const walk = (node: MdNode) => {
		node.children?.forEach(walk);
		if (node.type !== 'blockquote') return;
		const first = node.children?.[0];
		const text = first?.type === 'paragraph' ? first.children?.[0] : undefined;
		const match = text?.type === 'text' ? CALLOUT_MARK.exec(text.value ?? '') : null;
		if (!first || !text || !match) return;
		const kind = match[1].toLowerCase() as CalloutKind;
		text.value = (text.value ?? '').slice(match[0].length);
		// 표시 뒤에 줄바꿈만 남았으면 그 줄바꿈과 빈 문단을 걷어 낸다
		if (!text.value) first.children = first.children?.slice(1);
		if (first.children?.[0]?.type === 'break') first.children = first.children.slice(1);
		if (!first.children?.length) node.children = node.children?.slice(1);
		const title: MdNode = {
			type: 'calloutTitle',
			data: { hName: 'p', hProperties: { className: ['memo-callout-title'] } },
			children: [
				{
					type: 'calloutIcon',
					data: { hName: 'i', hProperties: { className: [CALLOUTS[kind].icon], ariaHidden: 'true' } },
				},
				{ type: 'text', value: match[2].trim() || CALLOUTS[kind].title },
			],
		};
		node.children = [title, ...(node.children ?? [])];
		node.data = { hName: 'aside', hProperties: { className: ['memo-callout', `memo-callout-${kind}`] } };
	};
	return (tree: MdNode) => walk(tree);
}

export function remarkHighlight() {
	const walk = (node: MdNode) => {
		if (!node.children || NO_HIGHLIGHT.has(node.type)) return;
		node.children.forEach(walk);
		if (!node.children.some((child) => child.type === 'text' && child.value?.includes(HIGHLIGHT_MARK))) return;

		// 글자 노드를 `==` 앞뒤로 나눈다. null이 `==` 자리
		const items: (MdNode | null)[] = [];
		for (const child of node.children) {
			if (child.type !== 'text' || !child.value?.includes(HIGHLIGHT_MARK)) {
				items.push(child);
				continue;
			}
			child.value.split(HIGHLIGHT_MARK).forEach((part, index) => {
				if (index > 0) items.push(null);
				if (part) items.push({ type: 'text', value: part });
			});
		}

		const out: MdNode[] = [];
		let open = -1; // 여는 `==`를 넣어 둔 out의 자리
		for (const [index, item] of items.entries()) {
			if (item) {
				out.push(item);
				continue;
			}
			const before = out.at(-1);
			const closes = open >= 0 && out.length > open + 1 && !(before?.type === 'text' && /\s$/.test(before.value ?? ''));
			if (closes) {
				const children = out.splice(open + 1);
				out[open] = {
					type: 'highlight',
					data: { hName: 'mark', hProperties: { className: ['memo-highlight'] } },
					children,
				};
				open = -1;
				continue;
			}
			const next = items[index + 1];
			out.push({ type: 'text', value: HIGHLIGHT_MARK });
			if (next && !(next.type === 'text' && isSpace(next.value ?? ''))) open = out.length - 1;
		}

		// 짝이 없는 `==`는 글자로 남았다. 이웃한 글자 노드를 합친다
		node.children = out.reduce<MdNode[]>((merged, child) => {
			const last = merged.at(-1);
			if (child.type === 'text' && last?.type === 'text') last.value = `${last.value ?? ''}${child.value ?? ''}`;
			else merged.push(child);
			return merged;
		}, []);
	};
	return (tree: MdNode) => walk(tree);
}

export const DETAILS_OPEN = /^<details(?:\s+id="([a-z0-9-]+)")?(\s+open)?\s*>\s*(?:<summary>([^<]*)<\/summary>)?\s*$/i;
export const DETAILS_CLOSE = /^<\/details>\s*$/i;

/** 접기 블록의 여는 줄 (편집기가 저장할 때). 요약의 <, >, &는 엔티티로 바꿔 글자로만 남긴다 */
export function detailsOpenHtml({ summary, open, id }: { summary: string; open: boolean; id: string }) {
	const text = summary.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	return `<details${id ? ` id="${id}"` : ''}${open ? ' open' : ''}>\n<summary>${text}</summary>`;
}

/** 엔티티 몇 개만 글자로 (요약은 글자로만 그린다: HTML로 넣지 않는다) */
export const decodeText = (text: string) =>
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
