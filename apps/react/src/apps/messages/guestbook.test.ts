import { describe, expect, it } from 'vitest';
import { groupByDay, LIMITS, sortEntries, validateInput, type GuestbookEntry } from './guestbook';

const entry = (id: string, createdAt: string): GuestbookEntry => ({ id, nickname: id, message: 'hi', createdAt });

describe('validateInput', () => {
	it('앞뒤 공백을 지우고 통과시킨다', () => {
		const { value, errors } = validateInput({ nickname: '  방문자 ', message: ' 안녕하세요 ', password: '1234' });
		expect(errors).toEqual({});
		expect(value).toEqual({ nickname: '방문자', message: '안녕하세요', password: '1234' });
	});

	it('비어 있으면 필드별로 알려준다', () => {
		const { errors } = validateInput({ nickname: ' ', message: '', password: '' });
		expect(Object.keys(errors).sort()).toEqual(['message', 'nickname', 'password']);
	});

	it('길이 제한을 넘으면 거부한다', () => {
		const { errors } = validateInput({
			nickname: 'a'.repeat(LIMITS.nickname.max + 1),
			message: 'a'.repeat(LIMITS.message.max + 1),
			password: 'a'.repeat(LIMITS.password.max + 1),
		});
		expect(errors.nickname).toContain('20자');
		expect(errors.message).toContain('500자');
		expect(errors.password).toBeDefined();
	});

	it('비밀번호는 공백을 지우지 않는다', () => {
		expect(validateInput({ nickname: 'a', message: 'b', password: ' 12 ' }).value.password).toBe(' 12 ');
	});
});

describe('sortEntries', () => {
	it('오래된 글부터 정렬하고 입력은 바꾸지 않는다', () => {
		const input = [entry('b', '2026-09-02T00:00:00Z'), entry('a', '2026-09-01T00:00:00Z')];
		expect(sortEntries(input).map((e) => e.id)).toEqual(['a', 'b']);
		expect(input[0].id).toBe('b');
	});
});

describe('groupByDay', () => {
	it('같은 날 쓴 글끼리 묶는다', () => {
		const groups = groupByDay(
			[entry('c', '2026-09-02T10:00:00Z'), entry('a', '2026-09-01T01:00:00Z'), entry('b', '2026-09-01T05:00:00Z')],
			'Asia/Seoul'
		);
		expect(groups.map((g) => [g.day, g.entries.map((e) => e.id)])).toEqual([
			['2026년 9월 1일', ['a', 'b']],
			['2026년 9월 2일', ['c']],
		]);
	});

	it('시간대에 따라 날짜가 달라진다 (UTC 자정 전후)', () => {
		const groups = groupByDay([entry('a', '2026-09-01T20:00:00Z')], 'Asia/Seoul');
		expect(groups[0].day).toBe('2026년 9월 2일');
	});
});
