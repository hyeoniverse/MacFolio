import { embedOf, mediaKindOf, type Embed, type MediaKind } from '@macfolio/desktop-core/memo';
import type { Element, ElementContent } from 'hast';
import { ATTACHMENT_TITLE } from './writer/attachments';

/** 주소만 한 줄로 적은 문단의 링크와 그 임베드 (YouTube·SoundCloud 등, desktop-core memo/embeds.ts) */
export interface EmbedBlock {
	type: 'embed';
	href: string;
	embed: Embed;
}

/** 영상·음악 파일 링크와 그 재생기 종류 (desktop-core memo/media.ts) */
export interface MediaBlock {
	type: 'media';
	href: string;
	kind: MediaKind;
	/** 캡션에 보일 파일 이름 */
	name: string;
	/** 올린 파일이면 링크 제목('첨부 파일 · 3.2 MB'). 캡션 링크에 그대로 붙여 첨부 파일 모양으로 그린다 */
	title?: string;
}

/** 문단 하나를 통째로 재생기로 바꾸는 링크 */
export type LinkBlock = EmbedBlock | MediaBlock;

/** 바깥 주소의 마지막 경로 조각 (캡션의 파일 이름) */
function fileNameOf(href: string): string {
	const last = new URL(href).pathname.split('/').filter(Boolean).at(-1) ?? href;
	try {
		return decodeURIComponent(last);
	} catch {
		return last;
	}
}

/**
 * 링크 하나가 문단 전체일 때, 그 링크를 재생기로 그릴지 정한다.
 * - 링크 글자가 주소 그대로이면(`https://youtu.be/…`): 지원 사이트는 임베드, 경로가 영상·음악 확장자면 <video>·<audio>
 * - 올린 파일(링크 제목이 '첨부 파일 · …')이고 파일 이름이 영상·음악 확장자면 <video>·<audio>
 * 문장 속 링크나 `[발표 영상](https://youtu.be/…)`처럼 글자를 붙인 링크는 링크로 둔다
 */
export function linkBlockOf(href: string | undefined, text: string, title?: string | null): LinkBlock | null {
	if (!href) return null;
	const label = text.trim();
	if (label === href) {
		// Twitch 재생기는 삽입한 사이트의 도메인(parent)이 있어야 열린다
		const embed = embedOf(href, { parent: globalThis.location?.hostname });
		if (embed) return { type: 'embed', href, embed };
		const kind = href.startsWith('https://') ? mediaKindOf(new URL(href).pathname) : null;
		return kind ? { type: 'media', href, kind, name: fileNameOf(href) } : null;
	}
	if (title?.startsWith(ATTACHMENT_TITLE) && /^https?:\/\//.test(href)) {
		const kind = mediaKindOf(label);
		if (kind) return { type: 'media', href, kind, name: label, title };
	}
	return null;
}

function textOf(node: ElementContent): string {
	if (node.type === 'text') return node.value;
	return node.type === 'element' ? node.children.map(textOf).join('') : '';
}

/** 읽기 화면(react-markdown)의 문단 요소에서: 공백 글자를 빼고 자식이 `<a>` 하나뿐인지 */
export function linkBlockOfParagraph(paragraph: Element): LinkBlock | null {
	const children = paragraph.children.filter((child) => !(child.type === 'text' && !child.value.trim()));
	const [link] = children;
	if (children.length !== 1 || link.type !== 'element' || link.tagName !== 'a') return null;
	const { href, title } = link.properties;
	return linkBlockOf(
		typeof href === 'string' ? href : undefined,
		textOf(link),
		typeof title === 'string' ? title : null
	);
}
