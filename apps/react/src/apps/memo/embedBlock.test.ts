import { describe, expect, it } from 'vitest';
import type { Element } from 'hast';
import { linkBlockOf, linkBlockOfParagraph } from './embedBlock';

const link = (href: string, text: string): Element => ({
	type: 'element',
	tagName: 'a',
	properties: { href },
	children: [{ type: 'text', value: text }],
});
const paragraph = (...children: Element['children']): Element => ({
	type: 'element',
	tagName: 'p',
	properties: {},
	children,
});
const VIDEO = 'https://www.youtube.com/watch?v=nYkdrAPrdcw';

describe('linkBlockOf', () => {
	it('링크 글자가 주소 그대로이고 임베드할 수 있는 사이트면 임베드', () => {
		expect((linkBlockOf(VIDEO, VIDEO) as { embed: { src: string } } | null)?.embed.src).toBe(
			'https://www.youtube-nocookie.com/embed/nYkdrAPrdcw'
		);
	});

	it('글자를 붙인 링크, 지원하지 않는 사이트는 null', () => {
		expect(linkBlockOf(VIDEO, '발표 영상')).toBeNull();
		expect(linkBlockOf('https://github.com/a/b', 'https://github.com/a/b')).toBeNull();
		expect(linkBlockOf(undefined, '')).toBeNull();
	});
});

describe('linkBlockOfParagraph', () => {
	it('문단의 자식이 주소 링크 하나뿐일 때만 (앞뒤 공백 글자는 무시)', () => {
		expect(linkBlockOfParagraph(paragraph(link(VIDEO, VIDEO)))?.href).toBe(VIDEO);
		expect(linkBlockOfParagraph(paragraph({ type: 'text', value: '\n' }, link(VIDEO, VIDEO)))?.href).toBe(VIDEO);
	});

	it('문장 속 링크는 임베드하지 않는다', () => {
		expect(linkBlockOfParagraph(paragraph({ type: 'text', value: '영상: ' }, link(VIDEO, VIDEO)))).toBeNull();
		expect(linkBlockOfParagraph(paragraph(link(VIDEO, VIDEO), link(VIDEO, VIDEO)))).toBeNull();
	});
});

describe('영상·음악 파일', () => {
	it('주소만 적은 영상·음악 파일 주소는 재생기 (https만)', () => {
		expect(
			linkBlockOf(
				'https://example.com/media/%EB%85%B9%ED%99%94.mp4',
				'https://example.com/media/%EB%85%B9%ED%99%94.mp4'
			)
		).toEqual({
			type: 'media',
			href: 'https://example.com/media/%EB%85%B9%ED%99%94.mp4',
			kind: 'video',
			name: '녹화.mp4',
		});
		expect(linkBlockOf('http://example.com/a.mp3', 'http://example.com/a.mp3')).toBeNull();
	});

	it('올린 파일(첨부 파일 제목)은 파일 이름의 확장자로, 아니면 링크', () => {
		const href = 'https://api.example.com/files/abc123';
		expect(linkBlockOf(href, '노래.mp3', '첨부 파일 · 3.2 MB')).toEqual({
			type: 'media',
			href,
			kind: 'audio',
			name: '노래.mp3',
			title: '첨부 파일 · 3.2 MB',
		});
		expect(linkBlockOf(href, '문서.pdf', '첨부 파일 · 1 MB')).toBeNull();
		expect(linkBlockOf(href, '노래.mp3', null)).toBeNull();
	});
});
