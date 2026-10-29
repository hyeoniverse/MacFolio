import { describe, expect, it } from 'vitest';
import type { Element } from 'hast';
import { embedBlockOf, embedBlockOfParagraph } from './embedBlock';

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

describe('embedBlockOf', () => {
	it('링크 글자가 주소 그대로이고 임베드할 수 있는 사이트면 임베드', () => {
		expect(embedBlockOf(VIDEO, VIDEO)?.embed.src).toBe('https://www.youtube-nocookie.com/embed/nYkdrAPrdcw');
	});

	it('글자를 붙인 링크, 지원하지 않는 사이트는 null', () => {
		expect(embedBlockOf(VIDEO, '발표 영상')).toBeNull();
		expect(embedBlockOf('https://github.com/a/b', 'https://github.com/a/b')).toBeNull();
		expect(embedBlockOf(undefined, '')).toBeNull();
	});
});

describe('embedBlockOfParagraph', () => {
	it('문단의 자식이 주소 링크 하나뿐일 때만 (앞뒤 공백 글자는 무시)', () => {
		expect(embedBlockOfParagraph(paragraph(link(VIDEO, VIDEO)))?.href).toBe(VIDEO);
		expect(embedBlockOfParagraph(paragraph({ type: 'text', value: '\n' }, link(VIDEO, VIDEO)))?.href).toBe(VIDEO);
	});

	it('문장 속 링크는 임베드하지 않는다', () => {
		expect(embedBlockOfParagraph(paragraph({ type: 'text', value: '영상: ' }, link(VIDEO, VIDEO)))).toBeNull();
		expect(embedBlockOfParagraph(paragraph(link(VIDEO, VIDEO), link(VIDEO, VIDEO)))).toBeNull();
	});
});
