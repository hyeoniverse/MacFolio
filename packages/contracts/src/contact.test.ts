import { describe, expect, it } from 'vitest';
import { CONTACT_LIMITS, ContactInput, ContactStatus, REPLY_LIMIT, ReplyInput } from './contact.js';
import { parse } from './parse.js';

const input = {
	name: ' 민수 ',
	email: 'minsu@example.com',
	subject: '포트폴리오 잘 봤습니다',
	body: '안녕하세요\r\n반갑습니다',
};

describe('ContactInput', () => {
	it('다듬어서 받는다 (앞뒤 공백, 줄바꿈 통일). 사람 확인 토큰은 있으면 그대로', () => {
		expect(parse(ContactInput, { ...input, turnstileToken: 'abc' })).toEqual({
			value: {
				name: '민수',
				email: 'minsu@example.com',
				subject: '포트폴리오 잘 봤습니다',
				body: '안녕하세요\n반갑습니다',
				turnstileToken: 'abc',
			},
		});
		expect(parse(ContactInput, { ...input, turnstileToken: 'x'.repeat(2049) })).toEqual({
			value: { ...input, name: '민수', body: '안녕하세요\n반갑습니다' },
		});
	});

	it('칸마다 처음 어긋난 규칙 하나를, 칸 순서대로 알린다', () => {
		expect(parse(ContactInput, null)).toEqual({
			errors: [
				'이름을 입력해주세요.',
				'답장받을 이메일을 입력해주세요.',
				'제목을 입력해주세요.',
				'내용을 입력해주세요.',
			],
		});
		const wrong = (patch: Record<string, unknown>) => parse(ContactInput, { ...input, ...patch });
		expect(wrong({ name: 'x'.repeat(CONTACT_LIMITS.name + 1) })).toEqual({
			errors: ['이름은 30자까지 입력할 수 있습니다.'],
		});
		for (const email of ['minsu', 'minsu@', 'minsu@example', 'min su@example.com', '@example.com'])
			expect(wrong({ email }), email).toEqual({ errors: ['이메일 형식을 확인해주세요.'] });
		expect(wrong({ subject: 'x'.repeat(CONTACT_LIMITS.subject + 1) })).toEqual({
			errors: ['제목은 100자까지 입력할 수 있습니다.'],
		});
		expect(wrong({ body: 'x'.repeat(CONTACT_LIMITS.body + 1) })).toEqual({
			errors: ['내용은 2000자까지 입력할 수 있습니다.'],
		});
		expect(wrong({ body: 123 })).toEqual({ errors: ['내용을 입력해주세요.'] });
	});

	it('이름·제목은 한 줄, 제어 문자는 받지 않는다 (메일 머리에 끼워 넣기 막기). 같은 문구는 한 번만', () => {
		const wrong = (patch: Record<string, unknown>) => parse(ContactInput, { ...input, ...patch });
		expect(wrong({ subject: '안녕\nBcc: someone@example.com' })).toEqual({
			errors: ['이름과 제목은 한 줄로 써 주세요.'],
		});
		expect(wrong({ name: '민수\nx', subject: 'a\nb' })).toEqual({ errors: ['이름과 제목은 한 줄로 써 주세요.'] });
		expect(wrong({ body: '안녕\u0000하세요' })).toEqual({ errors: ['읽을 수 없는 글자가 있습니다.'] });
		expect('errors' in wrong({ body: '여러\n줄은\n괜찮다' })).toBe(false);
	});
});

describe('ReplyInput', () => {
	it('비었거나 너무 길거나 제어 문자가 있으면 거절한다', () => {
		expect(parse(ReplyInput, { body: '  감사합니다\r\n  ' })).toEqual({ value: { body: '감사합니다' } });
		expect(parse(ReplyInput, { body: ' ' })).toEqual({ errors: ['답장 내용을 입력해주세요.'] });
		expect(parse(ReplyInput, { body: 'x'.repeat(REPLY_LIMIT + 1) })).toEqual({ errors: ['답장은 5000자까지입니다.'] });
		expect(parse(ReplyInput, { body: '안녕\u0007' })).toEqual({ errors: ['읽을 수 없는 글자가 있습니다.'] });
		expect(parse(ReplyInput, null)).toEqual({ errors: ['답장 내용을 입력해주세요.'] });
	});
});

describe('ContactStatus', () => {
	it('보낼 수 있는지와 사이트 키', () => {
		expect(parse(ContactStatus, { enabled: false, turnstileSiteKey: null })).toEqual({
			value: { enabled: false, turnstileSiteKey: null },
		});
	});
});
