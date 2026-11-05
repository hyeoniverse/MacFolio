import { describe, expect, it } from 'vitest';
import { activeBarItem, activeHeading, showsToc, tocBarItems, tocPosition, type TocEntry } from './toc';

describe('목차', () => {
	it('제목이 셋 이상일 때만 보인다', () => {
		const entry = { level: 2 as const, text: '제목' };
		expect(showsToc([entry, entry])).toBe(false);
		expect(showsToc([entry, entry, entry])).toBe(true);
	});

	it('지금 읽는 절은 기준선을 지난 마지막 제목, 첫 제목 위면 -1', () => {
		expect(activeHeading([200, 600, 1200], 96)).toBe(-1);
		expect(activeHeading([80, 600, 1200], 96)).toBe(0);
		expect(activeHeading([-900, -300, 40], 96)).toBe(2);
		expect(activeHeading([-900, 96, 400], 96)).toBe(1);
	});

	it('목차 막대가 오가는 절은 ## 제목이고, ## 제목이 둘 미만이면 모든 제목이다', () => {
		const h = (level: 2 | 3): TocEntry => ({ level, text: `${level}` });
		expect(tocBarItems([h(2), h(3), h(3), h(2), h(3)])).toEqual([0, 3]);
		expect(tocBarItems([h(2), h(3), h(3), h(3)])).toEqual([0, 1, 2, 3]);
		expect(tocBarItems([h(3), h(3), h(3)])).toEqual([0, 1, 2]);
	});

	it('지금 읽는 제목이 속한 절은 그 제목이거나 그보다 앞선 마지막 항목', () => {
		const items = [0, 3, 5];
		expect(activeBarItem(items, -1)).toBe(-1);
		expect(activeBarItem(items, 0)).toBe(0);
		expect(activeBarItem(items, 2)).toBe(0);
		expect(activeBarItem(items, 3)).toBe(1);
		expect(activeBarItem(items, 7)).toBe(2);
		// 첫 항목이 첫 제목이 아니면(### 뒤에 ##) 첫 항목 전까지는 없다
		expect(activeBarItem([1, 2], 0)).toBe(-1);
	});

	it('목차 막대: 지금 읽는 절과 그 안의 ### 소제목, 이전·다음 절', () => {
		const h = (level: 2 | 3): TocEntry => ({ level, text: `${level}` });
		const entries = [h(2), h(3), h(3), h(2), h(2), h(3)];
		const items = tocBarItems(entries);
		// 첫 절보다 위: 현재 절은 없고 다음은 첫 절
		expect(tocPosition(entries, items, -1)).toEqual({ section: -1, sub: -1, prev: -1, next: 0 });
		// 첫 절 머리
		expect(tocPosition(entries, items, 0)).toEqual({ section: 0, sub: -1, prev: -1, next: 3 });
		// 첫 절의 둘째 소제목
		expect(tocPosition(entries, items, 2)).toEqual({ section: 0, sub: 2, prev: -1, next: 3 });
		// 소제목 없는 가운데 절
		expect(tocPosition(entries, items, 3)).toEqual({ section: 3, sub: -1, prev: 0, next: 4 });
		// 마지막 절의 소제목: 다음 절은 없다
		expect(tocPosition(entries, items, 5)).toEqual({ section: 4, sub: 5, prev: 3, next: -1 });
		// ## 제목이 둘 미만이면 모든 제목이 절이라 소제목은 없다
		const flat = [h(2), h(3), h(3)];
		expect(tocPosition(flat, tocBarItems(flat), 1)).toEqual({ section: 1, sub: -1, prev: 0, next: 2 });
	});
});
