import { describe, expect, it } from 'vitest';
import { CoverInput, demoText, MAX_TRANSLATE_CHARS, SpeechInput, SummaryInput, TranslateInput } from './demos.js';
import { parse } from './parse.js';

const rules = { max: 10, empty: '비었습니다', refused: '안 됩니다' };
const check = (value: unknown, extra: Partial<typeof rules & { lines: boolean }> = {}) =>
	parse(demoText({ ...rules, ...extra }), value);

describe('데모 글 한 칸', () => {
	it('공백을 줄이고, 여러 줄을 받는 칸은 줄바꿈을 남긴다', () => {
		expect(check('  안녕\n 하세요 ')).toEqual({ value: '안녕 하세요' });
		expect(check(' 첫 줄 \r\n\n\n\n 둘째  줄 ', { lines: true })).toEqual({ value: '첫 줄\n\n둘째 줄' });
	});

	it('비었거나 길거나, 제어 문자·주소·욕설은 받지 않는다', () => {
		expect(check(undefined)).toEqual({ errors: ['비었습니다'] });
		expect(check(42)).toEqual({ errors: ['비었습니다'] });
		expect(check('가'.repeat(11))).toEqual({ errors: ['10자까지만 받습니다.'] });
		expect(check('a\u0007b')).toEqual({ errors: ['읽을 수 없는 글자가 있습니다.'] });
		expect(check('www.x.com')).toEqual({ errors: ['안 됩니다'] });
		expect(check('shit', { lines: true })).toEqual({ errors: ['안 됩니다'] });
	});
});

describe('데모 몸통', () => {
	it('몸통이 객체가 아니면 빈 글의 이유를 알린다', () => {
		expect(parse(SummaryInput, null)).toEqual({ errors: ['요약할 글을 써 주세요.'] });
		expect(parse(SpeechInput, 'text')).toEqual({ errors: ['읽을 글을 써 주세요.'] });
	});

	it('모르는 스타일·언어·공급자는 기본값으로', () => {
		expect(parse(CoverInput, { title: '바다', style: 'toString', skip: 'cloudflare' })).toEqual({
			value: { title: '바다', style: 'abstract', skip: [] },
		});
		expect(parse(SpeechInput, { text: '안녕', lang: 'fr', skip: ['edge', 'x'] })).toEqual({
			value: { text: '안녕', lang: 'ko', skip: ['edge'] },
		});
	});

	it('번역은 칸 수를 먼저 보고, 모두 합쳐 상한을 센다', () => {
		expect(parse(TranslateInput, { texts: ['', '', '', ''] })).toEqual({ errors: ['3칸까지만 번역합니다.'] });
		const half = '가'.repeat(MAX_TRANSLATE_CHARS / 2);
		expect(parse(TranslateInput, { texts: [half, `${half}가`] })).toEqual({
			errors: [`모두 합쳐 ${MAX_TRANSLATE_CHARS}자까지만 번역합니다.`],
		});
		expect(parse(TranslateInput, { text: 'Hi', from: 'en' })).toEqual({
			value: { texts: ['Hi'], from: 'en', to: 'ko', skip: [] },
		});
	});
});
