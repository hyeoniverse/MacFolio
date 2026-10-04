import { describe, expect, it } from 'vitest';
import { DemoInputError } from '../common/demo.js';
import { MAX_TRANSLATE_CHARS, parseTranslateRequest } from './rules.js';

describe('번역 요청', () => {
	it('한국어 → 영어가 기본, 영어면 한국어로, 모르는 공급자는 버린다', () => {
		expect(parseTranslateRequest({ text: ' 안녕\n하세요 ', skip: ['deepl', 'claude'] })).toEqual({
			texts: ['안녕 하세요'],
			from: 'ko',
			to: 'en',
			skip: ['deepl'],
		});
		expect(parseTranslateRequest({ text: 'Hello', from: 'en', to: 'en' })).toMatchObject({ from: 'en', to: 'ko' });
	});

	it('여러 칸은 차례 그대로, 3칸까지 모두 합쳐 200자까지', () => {
		expect(parseTranslateRequest({ texts: ['부제', ' 설명 '] }).texts).toEqual(['부제', '설명']);
		expect(() => parseTranslateRequest({ texts: ['가', '나', '다', '라'] })).toThrow('3칸');
		const half = '가'.repeat(MAX_TRANSLATE_CHARS / 2);
		expect(parseTranslateRequest({ texts: [half, half] }).texts).toHaveLength(2);
		expect(() => parseTranslateRequest({ texts: [half, `${half}가`] })).toThrow('모두 합쳐 200자');
		expect(() => parseTranslateRequest({ texts: ['부제', ''] })).toThrow(DemoInputError);
	});

	it('비었거나 200자를 넘거나, 주소·메일·욕설은 받지 않는다', () => {
		expect(() => parseTranslateRequest({ text: ' ' })).toThrow(DemoInputError);
		expect(() => parseTranslateRequest({ text: '가'.repeat(MAX_TRANSLATE_CHARS + 1) })).toThrow('200자');
		expect(parseTranslateRequest({ text: '가'.repeat(MAX_TRANSLATE_CHARS) }).texts[0]).toHaveLength(
			MAX_TRANSLATE_CHARS
		);
		expect(() => parseTranslateRequest({ text: 'http://a.b 번역' })).toThrow(DemoInputError);
		expect(() => parseTranslateRequest({ texts: [42] })).toThrow(DemoInputError);
		expect(() => parseTranslateRequest(null)).toThrow(DemoInputError);
	});
});
