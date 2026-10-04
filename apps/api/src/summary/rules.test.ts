import { describe, expect, it } from 'vitest';
import { DemoInputError, ProviderFailure } from '../common/demo.js';
import { MAX_SUMMARY_CHARS, parseSummaryRequest, readSummary, summaryPrompt } from './rules.js';

describe('요약 요청', () => {
	it('줄바꿈은 남기고 800자까지 받는다', () => {
		expect(parseSummaryRequest({ text: ' 첫 문단\n\n\n둘째 문단 ' })).toEqual({ text: '첫 문단\n\n둘째 문단' });
		expect(parseSummaryRequest({ text: '가'.repeat(MAX_SUMMARY_CHARS) }).text).toHaveLength(MAX_SUMMARY_CHARS);
		expect(() => parseSummaryRequest({ text: '가'.repeat(MAX_SUMMARY_CHARS + 1) })).toThrow('800자');
		expect(() => parseSummaryRequest({})).toThrow(DemoInputError);
	});

	it('글을 프롬프트 끝에 붙이고, 답은 두 언어가 다 있어야 한다', () => {
		expect(summaryPrompt('본문')).toMatch(/keys "ko" and "en"[\s\S]*Text:\n본문$/);
		expect(readSummary('{"ko":" 요약 ","en":"Summary"}')).toEqual({ ko: '요약', en: 'Summary' });
		expect(() => readSummary('{"ko":"요약"}')).toThrow(ProviderFailure);
		expect(() => readSummary('not json')).toThrow('알아볼 수 없는 응답');
		expect(() => readSummary(undefined)).toThrow(ProviderFailure);
	});
});
