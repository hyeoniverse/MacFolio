import { describe, expect, it } from 'vitest';
import {
	activeBarItem,
	activeHeading,
	showsToc,
	tocBarItems,
	tocChildren,
	tocPosition,
	tocSiblings,
	type TocEntry,
} from './toc';

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
		const h = (level: 2 | 3 | 4): TocEntry => ({ level, text: `${level}` });
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

	it('목차 막대: 지금 읽는 절과 그 안의 하위 제목 경로, 이전·다음 절', () => {
		const h = (level: 2 | 3 | 4): TocEntry => ({ level, text: `${level}` });
		const entries = [h(2), h(3), h(3), h(2), h(2), h(3)];
		const items = tocBarItems(entries);
		// 첫 절보다 위: 현재 절은 없고 다음은 첫 절
		expect(tocPosition(entries, items, -1)).toEqual({ section: -1, trail: [], prev: -1, next: 0 });
		// 첫 절 머리
		expect(tocPosition(entries, items, 0)).toEqual({ section: 0, trail: [], prev: -1, next: 3 });
		// 첫 절의 둘째 소제목: 앞의 소제목은 경로에 넣지 않는다 (같은 단계)
		expect(tocPosition(entries, items, 2)).toEqual({ section: 0, trail: [2], prev: -1, next: 3 });
		// 소제목 없는 가운데 절
		expect(tocPosition(entries, items, 3)).toEqual({ section: 3, trail: [], prev: 0, next: 4 });
		// 마지막 절의 소제목: 다음 절은 없다
		expect(tocPosition(entries, items, 5)).toEqual({ section: 4, trail: [5], prev: 3, next: -1 });
		// ## 제목이 둘 미만이면 모든 제목이 절이라 하위 제목 경로는 없다
		const flat = [h(2), h(3), h(3)];
		expect(tocPosition(flat, tocBarItems(flat), 1)).toEqual({ section: 1, trail: [], prev: 0, next: 2 });
	});

	it('하위 제목 경로는 #### 까지: ## › ### › ####, ### 없이 바로 ####, 다음 ### 뒤의 ####', () => {
		const h = (level: 2 | 3 | 4): TocEntry => ({ level, text: `${level}` });
		//               0     1     2     3     4     5     6     7
		const entries = [h(2), h(3), h(4), h(4), h(3), h(4), h(2), h(4)];
		const items = tocBarItems(entries);
		expect(tocPosition(entries, items, 3).trail).toEqual([1, 3]);
		expect(tocPosition(entries, items, 4).trail).toEqual([4]);
		expect(tocPosition(entries, items, 5).trail).toEqual([4, 5]);
		expect(tocPosition(entries, items, 7).trail).toEqual([7]);
	});

	it('하위 제목 목록은 바로 아래 단계만: ## 아래 ###들, ### 아래 ####들, ### 없이 ####만 있으면 ####들', () => {
		const h = (level: 2 | 3 | 4): TocEntry => ({ level, text: `${level}` });
		//               0     1     2     3     4     5     6     7
		const entries = [h(2), h(3), h(4), h(4), h(3), h(2), h(4), h(2)];
		expect(tocChildren(entries, 0)).toEqual([1, 4]);
		expect(tocChildren(entries, 1)).toEqual([2, 3]);
		expect(tocChildren(entries, 4)).toEqual([]);
		expect(tocChildren(entries, 5)).toEqual([6]);
		expect(tocChildren(entries, 7)).toEqual([]);
		expect(tocChildren(entries, -1)).toEqual([]);
	});

	it('같은 계층의 제목: 같은 부모 아래 바로 아래 단계, 맨 위 단계는 모든 절', () => {
		const h = (level: 2 | 3 | 4): TocEntry => ({ level, text: `${level}` });
		//               0     1     2     3     4     5     6     7
		const entries = [h(2), h(3), h(4), h(4), h(3), h(2), h(4), h(2)];
		expect(tocSiblings(entries, 0)).toEqual([0, 5, 7]);
		expect(tocSiblings(entries, 4)).toEqual([1, 4]);
		expect(tocSiblings(entries, 3)).toEqual([2, 3]);
		expect(tocSiblings(entries, 6)).toEqual([6]);
		// 첫 ## 앞의 ### (부모 없음): 부모 없는 ###들
		const lead = [h(3), h(3), h(2), h(3)];
		expect(tocSiblings(lead, 1)).toEqual([0, 1]);
	});
});
