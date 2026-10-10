import { describe, expect, it } from 'vitest';
import { redact, redactValue } from './redact.js';

describe('로그의 비밀 값 가리기', () => {
	it('DB 주소의 비밀번호', () => {
		expect(redact('connect to postgresql://macfolio:s3cret@db:5432/macfolio failed')).toBe(
			'connect to postgresql://macfolio:***@db:5432/macfolio failed'
		);
		// 비밀번호가 없는 주소와 보통 주소는 그대로
		expect(redact('https://api.resend.com/emails')).toBe('https://api.resend.com/emails');
	});

	it('Authorization 헤더와 알려진 키 모양', () => {
		expect(redact('Authorization: Bearer re_AbCdEf123456')).toBe('Authorization: Bearer ***');
		expect(redact('resend key re_123456789abc rejected')).toBe('resend key *** rejected');
		expect(redact('groq gsk_abcdefghijkl, github ghp_abcdefghijklmnop, google AIzaSyAbcdefghijklmnopqrstu')).toBe(
			'groq ***, github ***, google ***'
		);
		expect(redact('openai sk-abcdefghijklmnop')).toBe('openai ***');
	});

	it('쿠키·쿼리 값과 JSON 항목', () => {
		expect(redact('cookie: macfolio_session=abc.def; macfolio_visitor=xyz')).toBe(
			'cookie: macfolio_session=***; macfolio_visitor=***'
		);
		expect(redact('/auth/github/callback?code=abc123&state=xyz')).toBe('/auth/github/callback?code=***&state=***');
		expect(redact('{"cookie":"macfolio_session=abc","Authorization":"Bearer x","name":"민수"}')).toBe(
			'{"cookie":"***","Authorization":"***","name":"민수"}'
		);
		// statusCode=500 같은 다른 단어의 일부는 건드리지 않는다
		expect(redact('statusCode=500 mode=fast')).toBe('statusCode=500 mode=fast');
	});

	it('메일 주소는 첫 글자와 도메인만', () => {
		expect(redact('from minsu@example.com to owner@hyeoniverse.dev')).toBe(
			'from m***@example.com to o***@hyeoniverse.dev'
		);
	});

	it('Error는 메시지와 스택을, 객체는 JSON으로 바꿔 가린다. 나머지는 그대로', () => {
		const error = new Error('password authentication failed: postgresql://u:p@h/db');
		const redacted = redactValue(error) as Error;
		expect(redacted).toBeInstanceOf(Error);
		expect(redacted.message).toBe('password authentication failed: postgresql://u:***@h/db');
		expect(redacted.stack).not.toContain(':p@');
		expect(redacted.name).toBe('Error');
		expect(redactValue({ to: 'minsu@example.com', n: 1 })).toEqual({ to: 'm***@example.com', n: 1 });
		expect(redactValue(42)).toBe(42);
		expect(redactValue(undefined)).toBeUndefined();
	});
});
