import { describe, expect, it } from 'vitest';
import { hashIp, maskIp, parseBody } from './rules.js';

describe('parseBody', () => {
	it('앞뒤 공백을 다듬고, 이름·비밀번호는 받지 않는다', () => {
		expect(parseBody({ name: '누구', password: '1234', body: ' 잘 봤어요 ' })).toEqual({
			value: { body: '잘 봤어요' },
		});
	});

	it('비었거나 500자를 넘으면 이유를 알린다', () => {
		expect(parseBody({ body: ' ' })).toEqual({ errors: ['내용을 입력해주세요.'] });
		expect(parseBody({ body: '가'.repeat(501) })).toEqual({ errors: ['내용은 500자까지 입력할 수 있습니다.'] });
		expect(parseBody(null)).toEqual({ errors: ['내용을 입력해주세요.'] });
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
