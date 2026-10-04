import { describe, expect, it } from 'vitest';
import { DemoInputError } from '../common/demo.js';
import { coverPrompt, MAX_COVER_CHARS, parseCoverRequest } from './rules.js';

describe('커버 요청', () => {
	it('모르는 스타일은 abstract, 모르는 공급자는 버린다', () => {
		expect(
			parseCoverRequest({ title: ' 혼자 만드는\n포트폴리오 ', style: 'nope', skip: ['huggingface', 'x'] })
		).toEqual({
			title: '혼자 만드는 포트폴리오',
			style: 'abstract',
			skip: ['huggingface'],
		});
		expect(parseCoverRequest({ title: '바다', style: 'watercolor' }).style).toBe('watercolor');
		// 객체의 기본 속성 이름은 스타일이 아니다
		expect(parseCoverRequest({ title: '바다', style: 'toString' }).style).toBe('abstract');
	});

	it('비었거나 60자를 넘거나, 주소·욕설은 받지 않는다', () => {
		expect(() => parseCoverRequest({ title: '' })).toThrow(DemoInputError);
		expect(() => parseCoverRequest({ title: '가'.repeat(MAX_COVER_CHARS + 1) })).toThrow('60자');
		expect(() => parseCoverRequest({ title: 'fuck' })).toThrow(DemoInputError);
	});

	it('HYEONIVERSE와 같은 프롬프트: 넓은 가로, 글자 없이', () => {
		expect(coverPrompt({ title: '바다', style: 'minimal' })).toBe(
			'Blog cover image: 바다. Style: minimalist design, clean lines, simple composition. Wide landscape format, no text.'
		);
	});
});
