import { describe, expect, it } from 'vitest';
import { buildEmail, LIMITS, parseContact } from './rules.js';

const input = {
	name: ' 민수 ',
	email: 'minsu@example.com',
	subject: '포트폴리오 잘 봤습니다',
	body: '안녕하세요\r\n반갑습니다',
};

describe('연락 메일 검사', () => {
	it('다듬어서 받는다 (앞뒤 공백, 줄바꿈 통일). Turnstile 토큰은 따로', () => {
		expect(parseContact({ ...input, turnstileToken: 'abc' })).toEqual({
			value: {
				name: '민수',
				email: 'minsu@example.com',
				subject: '포트폴리오 잘 봤습니다',
				body: '안녕하세요\n반갑습니다',
			},
			token: 'abc',
		});
	});

	it('사이트와 같은 규칙으로 거절한다', () => {
		const wrong = (patch: Record<string, unknown>) => 'errors' in parseContact({ ...input, ...patch });
		expect('errors' in parseContact(null)).toBe(true);
		expect(wrong({ name: '' })).toBe(true);
		expect(wrong({ name: 'x'.repeat(LIMITS.name + 1) })).toBe(true);
		expect(wrong({ email: 'minsu@example' })).toBe(true);
		expect(wrong({ subject: 'x'.repeat(LIMITS.subject + 1) })).toBe(true);
		expect(wrong({ body: 'x'.repeat(LIMITS.body + 1) })).toBe(true);
		expect(wrong({ body: 123 })).toBe(true);
	});

	it('이름·제목은 한 줄, 제어 문자는 받지 않는다 (메일 머리에 끼워 넣기 막기)', () => {
		const wrong = (patch: Record<string, unknown>) => 'errors' in parseContact({ ...input, ...patch });
		expect(wrong({ subject: '안녕\nBcc: someone@example.com' })).toBe(true);
		expect(wrong({ name: '민수\n' + 'x' })).toBe(true);
		expect(wrong({ body: '안녕\u0000하세요' })).toBe(true);
		expect(wrong({ body: '여러\n줄은\n괜찮다' })).toBe(false);
	});
});

describe('보낼 메일', () => {
	it('제목 앞에 [MacFolio], 본문 끝에 보낸 사람', () => {
		const parsed = parseContact(input);
		if ('errors' in parsed) throw new Error('검사 실패');
		const email = buildEmail(parsed.value);
		expect(email.subject).toBe('[MacFolio] 포트폴리오 잘 봤습니다');
		expect(email.text).toMatch(/^안녕하세요\n반갑습니다\n\n---\n보낸 사람: 민수 <minsu@example\.com>/);
	});
});
