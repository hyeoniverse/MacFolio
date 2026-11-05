import { describe, expect, it } from 'vitest';
import { activeBarItem, activeHeading, showsToc, tocBarItems, type TocEntry } from './toc';

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

	it('목차 막대에는 ## 제목만 놓고, ## 제목이 둘 미만이면 모든 제목을 놓는다', () => {
		const h = (level: 2 | 3): TocEntry => ({ level, text: `${level}` });
		expect(tocBarItems([h(2), h(3), h(3), h(2), h(3)])).toEqual([0, 3]);
		expect(tocBarItems([h(2), h(3), h(3), h(3)])).toEqual([0, 1, 2, 3]);
		expect(tocBarItems([h(3), h(3), h(3)])).toEqual([0, 1, 2]);
	});

	it('지금 읽는 제목이 속한 막대 항목은 그 제목이거나 그보다 앞선 마지막 항목', () => {
		const items = [0, 3, 5];
		expect(activeBarItem(items, -1)).toBe(-1);
		expect(activeBarItem(items, 0)).toBe(0);
		expect(activeBarItem(items, 2)).toBe(0);
		expect(activeBarItem(items, 3)).toBe(1);
		expect(activeBarItem(items, 7)).toBe(2);
		// 첫 항목이 첫 제목이 아니면(### 뒤에 ##) 첫 항목 전까지는 없다
		expect(activeBarItem([1, 2], 0)).toBe(-1);
	});
});
