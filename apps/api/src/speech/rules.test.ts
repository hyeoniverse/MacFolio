import { describe, expect, it } from 'vitest';
import { DailyQuota, MAX_SPEECH_CHARS, parseSpeechRequest, SpeechInputError, speechOrder } from './rules.js';

describe('음성 만들기 요청', () => {
	it('공백을 정리하고, 언어는 ko가 기본, 모르는 공급자는 버린다', () => {
		expect(parseSpeechRequest({ text: '  안녕하세요\n반갑습니다 ', skip: ['fish', 'nope'] })).toEqual({
			text: '안녕하세요 반갑습니다',
			lang: 'ko',
			skip: ['fish'],
		});
		expect(parseSpeechRequest({ text: 'Hello', lang: 'en' }).lang).toBe('en');
	});

	it('비었거나 너무 길거나, 주소·메일·욕설은 받지 않는다', () => {
		expect(() => parseSpeechRequest({ text: '   ' })).toThrow(SpeechInputError);
		expect(() => parseSpeechRequest({ text: '가'.repeat(MAX_SPEECH_CHARS + 1) })).toThrow('80자');
		expect(parseSpeechRequest({ text: '가'.repeat(MAX_SPEECH_CHARS) }).text).toHaveLength(MAX_SPEECH_CHARS);
		expect(() => parseSpeechRequest({ text: 'https://example.com 읽어 줘' })).toThrow(SpeechInputError);
		expect(() => parseSpeechRequest({ text: 'me@example.com' })).toThrow(SpeechInputError);
		expect(() => parseSpeechRequest({ text: 'what the fuck' })).toThrow(SpeechInputError);
		expect(() => parseSpeechRequest(null)).toThrow(SpeechInputError);
	});

	it('차례는 Fish → Google → Edge이고, 막은 공급자는 건너뛴다고 표시한다', () => {
		expect(speechOrder(['google'])).toEqual([
			{ provider: 'fish', skipped: false },
			{ provider: 'google', skipped: true },
			{ provider: 'edge', skipped: false },
		]);
	});
});

describe('하루 상한', () => {
	it('IP마다 3번, 전체 상한을 넘지 않고, 날짜가 바뀌면 새로 센다', () => {
		let day = '2026-10-04';
		const quota = new DailyQuota(3, 4, () => day);
		expect(quota.remaining('a')).toBe(3);
		expect([quota.take('a'), quota.take('a'), quota.take('a'), quota.take('a')]).toEqual([true, true, true, false]);
		expect(quota.remaining('b')).toBe(1);
		expect(quota.take('b')).toBe(true);
		expect(quota.take('c')).toBe(false);
		expect(quota.remaining('c')).toBe(0);
		day = '2026-10-05';
		expect(quota.remaining('a')).toBe(3);
	});

	it('만들지 못한 요청은 돌려준다', () => {
		const quota = new DailyQuota(3, 50, () => '2026-10-04');
		quota.take('a');
		quota.refund('a');
		expect(quota.remaining('a')).toBe(3);
		quota.refund('a');
		expect(quota.remaining('a')).toBe(3);
	});
});
