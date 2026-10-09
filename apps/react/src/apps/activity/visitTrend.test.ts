import { describe, expect, it } from 'vitest';
import type { Summary } from './data';
import { trendOf, visitBattery, type VisitTrend } from './visitTrend';

const trend = (visits: number, previous: number): VisitTrend => ({
	visits,
	previous,
	today: 0,
	change: previous ? { text: '', direction: 'same' } : null,
});

describe('메뉴 막대의 배터리 (방문 추이)', () => {
	it('최근 7일과 앞 7일, 오늘 방문', () => {
		const summary = {
			to: '2026-10-07',
			days: [
				{ day: '2026-10-06', visits: 170, visitors: 100 },
				{ day: '2026-10-07', visits: 224, visitors: 150 },
			],
			totals: { visits: 1284 },
			previous: { visits: 1146 },
		} as unknown as Summary;
		expect(trendOf(summary)).toEqual({
			visits: 1284,
			previous: 1146,
			today: 224,
			change: { text: '+12%', direction: 'up' },
		});
	});

	it('앞 7일과 같으면 절반, 두 배 이상이면 가득, 줄면 그만큼 빈다', () => {
		expect(visitBattery(trend(100, 100)).fill).toBe(50);
		expect(visitBattery(trend(150, 100)).fill).toBe(75);
		expect(visitBattery(trend(200, 100)).fill).toBe(100);
		expect(visitBattery(trend(500, 100)).fill).toBe(100);
		expect(visitBattery(trend(50, 100)).fill).toBe(25);
		expect(visitBattery(trend(0, 100)).fill).toBe(5);
	});

	it('앞 7일이 0이면 이번에 방문이 있을 때 가득, 없으면 절반', () => {
		expect(visitBattery(trend(3, 0)).fill).toBe(100);
		expect(visitBattery(trend(0, 0)).fill).toBe(50);
	});

	it('한 줄 요약에 방문 수와 비교, 색은 칠하지 않는다', () => {
		const battery = visitBattery({ ...trend(1284, 1146), change: { text: '+12%', direction: 'up' } });
		expect(battery).toEqual({ fill: 56, tone: null, summary: '최근 7일 1,284회 (앞 7일보다 +12%)' });
		expect(visitBattery(null).summary).toBe('불러오는 중');
	});
});
