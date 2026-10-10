import { describe, expect, it } from 'vitest';
import { buildEmail, buildReply, parseContact } from './rules.js';

const input = {
	name: ' 민수 ',
	email: 'minsu@example.com',
	subject: '포트폴리오 잘 봤습니다',
	body: '안녕하세요\r\n반갑습니다',
};

describe('연락 메일 검사', () => {
	it('contracts의 스키마로 검사한다 (규칙과 문구는 거기 시험에)', () => {
		expect(parseContact(null)).toMatchObject({ errors: expect.arrayContaining(['이름을 입력해주세요.']) });
		expect(parseContact(input)).toMatchObject({ value: { name: '민수', body: '안녕하세요\n반갑습니다' } });
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

describe('관리자 답장', () => {
	it('제목에 Re:, 본문 아래에 받은 메일을 인용한다', () => {
		const reply = buildReply(
			{ ...input, name: '민수', body: '첫 줄\n둘째 줄', createdAt: new Date('2026-10-07T00:00:00Z') },
			'연락 주셔서 감사합니다!'
		);
		expect(reply.subject).toBe('Re: [MacFolio] 포트폴리오 잘 봤습니다');
		expect(reply.text).toBe(
			'연락 주셔서 감사합니다!\n\n---\n2026-10-07, 민수 <minsu@example.com> 님이 쓴 메일:\n> 첫 줄\n> 둘째 줄'
		);
	});
});
