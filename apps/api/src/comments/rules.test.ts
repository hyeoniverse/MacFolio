import { describe, expect, it } from 'vitest';
import { hashIp, hashPassword, maskIp, parseAdminComment, parseVisitorComment, verifyPassword } from './rules.js';

describe('parseVisitorComment', () => {
	it('앞뒤 공백을 다듬는다', () => {
		expect(parseVisitorComment({ name: ' 민수 ', password: '1234', body: ' 잘 봤어요 ', extra: 1 })).toEqual({
			value: { name: '민수', password: '1234', body: '잘 봤어요' },
		});
	});

	it('메시지 앱과 같은 규칙. 이유를 모두 모은다', () => {
		expect(parseVisitorComment({ name: '', password: '12', body: '' })).toEqual({
			errors: ['이름을 입력해주세요.', '비밀번호는 4~20자로 입력해주세요.', '내용을 입력해주세요.'],
		});
		expect(parseVisitorComment({ name: '가'.repeat(21), password: '1234', body: '가'.repeat(501) })).toEqual({
			errors: ['이름은 20자까지 입력할 수 있습니다.', '내용은 500자까지 입력할 수 있습니다.'],
		});
		expect(parseVisitorComment(null)).toMatchObject({ errors: expect.any(Array) });
	});

	it('방문자는 관리자 이름을 쓸 수 없다', () => {
		expect(parseVisitorComment({ name: '김정현', password: '1234', body: '안녕' })).toEqual({
			errors: ['다른 이름을 입력해주세요.'],
		});
	});
});

describe('parseAdminComment', () => {
	it('관리자는 내용만', () => {
		expect(parseAdminComment({ body: ' 감사합니다 ', name: '누구' })).toEqual({ value: { body: '감사합니다' } });
		expect(parseAdminComment({ body: ' ' })).toEqual({ errors: ['내용을 입력해주세요.'] });
	});
});

describe('IP', () => {
	it('앞 두 자리만 보인다', () => {
		expect(maskIp('211.234.10.20')).toBe('211.234');
		expect(maskIp('::ffff:127.0.0.1')).toBe('127.0');
		expect(maskIp('2001:db8::1')).toBe('2001:db8');
	});

	it('해시는 키마다 다르고 IP를 드러내지 않는다', () => {
		expect(hashIp('1.2.3.4', 'a')).toBe(hashIp('1.2.3.4', 'a'));
		expect(hashIp('1.2.3.4', 'a')).not.toBe(hashIp('1.2.3.4', 'b'));
		expect(hashIp('1.2.3.4', 'a')).not.toContain('1.2.3.4');
	});
});

describe('비밀번호', () => {
	it('맞는 비밀번호만 통과하고, 같은 비밀번호도 해시는 매번 다르다', async () => {
		const stored = await hashPassword('1234');
		expect(stored).toMatch(/^scrypt\$/);
		expect(stored).not.toContain('1234');
		expect(await hashPassword('1234')).not.toBe(stored);
		await expect(verifyPassword('1234', stored)).resolves.toBe(true);
		await expect(verifyPassword('4321', stored)).resolves.toBe(false);
		await expect(verifyPassword('1234', null)).resolves.toBe(false);
		await expect(verifyPassword('1234', 'garbage')).resolves.toBe(false);
	});
});
