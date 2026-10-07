import { describe, expect, it } from 'vitest';
import { CAPTION_MAX, parseCaptionInput } from './rules.js';

describe('parseCaptionInput', () => {
	it('사진 주소와 다듬은 캡션', () => {
		expect(parseCaptionInput({ src: '/imgs/projects/qru/a.jpg', caption: '  첫 화면\n ' })).toEqual({
			src: '/imgs/projects/qru/a.jpg',
			caption: '첫 화면',
		});
		expect(parseCaptionInput({ src: 'https://cdn.example.com/a.png', caption: '설명' })).toEqual({
			src: 'https://cdn.example.com/a.png',
			caption: '설명',
		});
	});

	it('비운 캡션은 null (원래 캡션으로 돌아간다)', () => {
		expect(parseCaptionInput({ src: '/a.jpg', caption: '   ' })).toEqual({ src: '/a.jpg', caption: null });
	});

	it('200자를 넘으면 거절 (한글도 글자 수로)', () => {
		expect(parseCaptionInput({ src: '/a.jpg', caption: '가'.repeat(CAPTION_MAX) })).toEqual({
			src: '/a.jpg',
			caption: '가'.repeat(CAPTION_MAX),
		});
		expect(typeof parseCaptionInput({ src: '/a.jpg', caption: '가'.repeat(CAPTION_MAX + 1) })).toBe('string');
	});

	it('주소가 잘못되었거나 값이 글자가 아니면 거절', () => {
		for (const body of [
			null,
			{ caption: '설명' },
			{ src: 'a.jpg', caption: '설명' },
			{ src: '//evil.com/a.jpg', caption: '설명' },
			{ src: 'http://example.com/a.jpg', caption: '설명' },
			{ src: '/a\n.jpg', caption: '설명' },
			{ src: `/${'a'.repeat(600)}`, caption: '설명' },
			{ src: '/a.jpg', caption: 3 },
		])
			expect(typeof parseCaptionInput(body)).toBe('string');
	});
});
