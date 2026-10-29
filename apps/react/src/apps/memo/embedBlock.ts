import { embedOf, type Embed } from '@macfolio/desktop-core/memo';
import type { Element, ElementContent } from 'hast';

/** 주소만 한 줄로 적은 문단의 링크와 그 임베드 */
export interface EmbedBlock {
	href: string;
	embed: Embed;
}

/**
 * 링크 하나가 문단 전체이고, 링크 글자가 주소 그대로일 때만 임베드한다 (`https://youtu.be/…`, `<https://youtu.be/…>`).
 * 문장 속 링크나 `[발표 영상](https://youtu.be/…)`처럼 글자를 붙인 링크는 링크로 둔다
 */
export function embedBlockOf(href: string | undefined, text: string): EmbedBlock | null {
	if (!href || text.trim() !== href) return null;
	const embed = embedOf(href);
	return embed ? { href, embed } : null;
}

function textOf(node: ElementContent): string {
	if (node.type === 'text') return node.value;
	return node.type === 'element' ? node.children.map(textOf).join('') : '';
}

/** 읽기 화면(react-markdown)의 문단 요소에서: 공백 글자를 빼고 자식이 `<a>` 하나뿐인지 */
export function embedBlockOfParagraph(paragraph: Element): EmbedBlock | null {
	const children = paragraph.children.filter((child) => !(child.type === 'text' && !child.value.trim()));
	const [link] = children;
	if (children.length !== 1 || link.type !== 'element' || link.tagName !== 'a') return null;
	const { href } = link.properties;
	return embedBlockOf(typeof href === 'string' ? href : undefined, textOf(link));
}
