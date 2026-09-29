import { describe, expect, it } from 'vitest';
import { classifyMove, scrollWins } from './swipe';

describe('classifyMove', () => {
	it('조금 움직였으면 아직 모른다 (누르기일 수 있다)', () => {
		expect(classifyMove(3, 5, 'down')).toBe('undecided');
	});

	it('정한 방향으로 세로로 쓸면 swipe', () => {
		expect(classifyMove(4, 30, 'down')).toBe('swipe');
		expect(classifyMove(-4, -30, 'up')).toBe('swipe');
	});

	it('가로로 움직이거나 반대 방향이면 other', () => {
		expect(classifyMove(30, 10, 'down')).toBe('other');
		expect(classifyMove(0, -30, 'down')).toBe('other');
		expect(classifyMove(0, 30, 'up')).toBe('other');
	});
});

describe('scrollWins', () => {
	const box = (scrollTop: number, overflowY = 'auto') => ({
		scrollTop,
		scrollHeight: 1000,
		clientHeight: 500,
		overflowY,
	});

	it('맨 위에서 아래로 쓸면 제어 센터 (스크롤할 게 없다)', () => {
		expect(scrollWins([box(0)], 'down')).toBe(false);
	});

	it('내용을 내려 둔 상태에서 아래로 쓸면 스크롤이 먼저', () => {
		expect(scrollWins([box(0), box(120)], 'down')).toBe(true);
	});

	it('위로 쓸 때는 아래로 더 내려갈 내용이 있으면 스크롤이 먼저', () => {
		expect(scrollWins([box(0)], 'up')).toBe(true);
		expect(scrollWins([box(500)], 'up')).toBe(false);
	});

	it('스크롤되지 않는 상자는 상관없다', () => {
		expect(
			scrollWins(
				[box(120, 'visible'), { scrollTop: 0, scrollHeight: 400, clientHeight: 400, overflowY: 'auto' }],
				'down'
			)
		).toBe(false);
	});
});
