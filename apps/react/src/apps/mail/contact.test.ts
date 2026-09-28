import { describe, expect, it } from 'vitest';
import { buildMailto, LIMITS, validateContact } from './contact';

const valid = {
	name: ' 민수 ',
	email: ' minsu@example.com ',
	subject: ' 채용 문의 ',
	body: ' 안녕하세요.\n연락 드립니다. ',
};

describe('validateContact', () => {
	it('앞뒤 공백을 지우고 통과시킨다', () => {
		const { value, errors } = validateContact(valid);
		expect(errors).toEqual({});
		expect(value).toEqual({
			name: '민수',
			email: 'minsu@example.com',
			subject: '채용 문의',
			body: '안녕하세요.\n연락 드립니다.',
		});
	});

	it('비어 있으면 필드별로 알려준다', () => {
		const { errors } = validateContact({ name: '', email: '', subject: ' ', body: '' });
		expect(Object.keys(errors).sort()).toEqual(['body', 'email', 'name', 'subject']);
	});

	it('이메일 형식이 틀리면 거부한다', () => {
		for (const email of ['minsu', 'minsu@', 'minsu@example', 'min su@example.com', '@example.com']) {
			expect(validateContact({ ...valid, email }).errors.email, email).toBe('이메일 형식을 확인해주세요.');
		}
	});

	it('길이 제한을 넘으면 거부한다', () => {
		const { errors } = validateContact({
			...valid,
			name: 'a'.repeat(LIMITS.name + 1),
			subject: 'a'.repeat(LIMITS.subject + 1),
			body: 'a'.repeat(LIMITS.body + 1),
		});
		expect(errors.name).toContain('30자');
		expect(errors.subject).toContain('100자');
		expect(errors.body).toContain('2000자');
	});
});

describe('buildMailto', () => {
	const url = buildMailto('owner@example.com', validateContact(valid).value);
	const params = new URLSearchParams(url.split('?')[1]);

	it('받는 사람, 제목을 담는다', () => {
		expect(url.startsWith('mailto:owner@example.com?')).toBe(true);
		expect(params.get('subject')).toBe('채용 문의');
	});

	it('본문 끝에 답장받을 주소를 붙이고, 줄바꿈은 CRLF로 인코딩한다', () => {
		expect(url).toContain('%0D%0A');
		expect(params.get('body')).toContain('보낸 사람: 민수 <minsu@example.com>');
	});

	it('특수문자(&, ?, #)가 주소를 깨지 않는다', () => {
		const tricky = buildMailto('o@e.com', { ...validateContact(valid).value, subject: 'A&B?C#D' });
		expect(new URLSearchParams(tricky.split('?').slice(1).join('?')).get('subject')).toBe('A&B?C#D');
	});
});
