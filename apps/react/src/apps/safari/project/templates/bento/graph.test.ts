import { describe, expect, it } from 'vitest';
import { graphOf, parseDate } from './graph';

describe('parseDate', () => {
	it('점·줄표·빗금으로 나눈 날짜를 읽고, 일이 없으면 1일', () => {
		expect(parseDate('2025.03.04')?.getDate()).toBe(4);
		expect(parseDate('2025-06-27')?.getMonth()).toBe(5);
		expect(parseDate('2025/05')?.getDate()).toBe(1);
		expect(parseDate('봄')).toBeNull();
	});
});

describe('graphOf', () => {
	it('첫 날짜의 주부터 마지막 날짜의 주까지, 기록한 날은 2, 그 사이는 1', () => {
		const graph = graphOf(['2025.03.04', '2025.03.18'])!;
		// 2025-03-04는 화요일, 2025-03-18도 화요일: 3주
		expect(graph.weeks).toHaveLength(3);
		expect(graph.weeks.every((week) => week.length === 7)).toBe(true);
		expect(graph.weeks[0][2]).toBe(2);
		expect(graph.weeks[2][2]).toBe(2);
		expect(graph.weeks[1][0]).toBe(1);
		expect(graph.weeks[0][0]).toBe(0);
		expect(graph.marks).toBe(2);
	});

	it('읽을 날짜가 없거나 너무 길면 그리지 않는다', () => {
		expect(graphOf(['처음', '끝'])).toBeNull();
		expect(graphOf(['2020.01.01', '2025.01.01'])).toBeNull();
	});
});
