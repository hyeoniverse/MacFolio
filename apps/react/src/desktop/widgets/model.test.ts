import { describe, expect, it } from 'vitest';
import { handAngles, monthGrid, seoulDate, shortDate } from './model';

describe('위젯 값', () => {
	it('서울 기준 날짜와 시각 (UTC 자정 넘어도 서울 날짜)', () => {
		expect(seoulDate(new Date('2026-10-21T15:30:05Z'))).toEqual({
			year: 2026,
			month: 10,
			day: 22,
			weekday: 4,
			hour: 0,
			minute: 30,
			second: 5,
		});
	});

	it('달력: 일요일부터 7칸씩, 이달 밖은 빈 칸', () => {
		const october = monthGrid(2026, 10);
		expect(october[0]).toEqual([null, null, null, null, 1, 2, 3]);
		expect(october.at(-1)).toEqual([25, 26, 27, 28, 29, 30, 31]);
		expect(monthGrid(2026, 2)).toHaveLength(4);
		expect(monthGrid(2026, 8)).toHaveLength(6);
	});

	it('시계 바늘 각도', () => {
		expect(handAngles({ hour: 15, minute: 30, second: 0 })).toEqual({ hour: 105, minute: 180, second: 0 });
		expect(handAngles({ hour: 0, minute: 0, second: 45 })).toEqual({ hour: 0, minute: 4.5, second: 270 });
	});

	it('글 날짜를 짧게', () => {
		const today = { year: 2026, month: 10, day: 21 };
		expect(shortDate('2026-10-21', today)).toBe('오늘');
		expect(shortDate('2026-10-20', today)).toBe('어제');
		expect(shortDate('2026-10-03', today)).toBe('10월 3일');
		expect(shortDate('2025-12-31', today)).toBe('2025. 12. 31.');
	});
});
