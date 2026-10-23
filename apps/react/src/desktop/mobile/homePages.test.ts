import { describe, expect, it } from 'vitest';
import { dragOffset, iconRowsBelow, pageAfterSwipe, pageApps, rowsThatFit, widgetRowHeight } from './homePages';

describe('홈 화면 페이지', () => {
	it('높이에 들어가는 줄 수 (줄 사이는 마지막 줄 뒤에 없다), 적어도 한 줄', () => {
		expect(rowsThatFit(400, 82, 22)).toBe(4); // 4줄 = 82*4 + 22*3 = 394
		expect(rowsThatFit(393, 82, 22)).toBe(3);
		expect(rowsThatFit(10, 82, 22)).toBe(1);
	});

	it('위젯이 있는 페이지는 위젯 아래 칸만큼, 나머지는 한 페이지씩', () => {
		const apps = Array.from({ length: 23 }, (_, index) => index);
		const pages = pageApps(apps, [8, 4], 20);
		expect(pages.map((page) => page.length)).toEqual([8, 4, 11]);
		expect(pages.flat()).toEqual(apps);
		expect(pageApps(apps, [24], 24).map((page) => page.length)).toEqual([23]);
		// 위젯이 다 차지한 페이지(0칸)는 앱 없이 두고 다음 페이지부터 놓는다
		expect(pageApps([1, 2, 3], [0], 0)).toEqual([[], [1], [2], [3]]);
		expect(pageApps([1, 2, 3], [2, 0, 4], 8)).toEqual([[1, 2], [], [3]]);
	});

	it('위젯 페이지는 앱이 모자라도 만든다', () => {
		expect(pageApps([1, 2], [8, 8, 8], 20)).toEqual([[1, 2], [], []]);
		expect(pageApps([], [], 20)).toEqual([[]]);
	});
});

describe('widgetRowHeight', () => {
	const gaps = { widget: 16, top: 24, icon: 22 };
	it('자리가 넉넉하면 정사각형, 모자라면 위젯 두 줄 아래 아이콘 두 줄과 위젯 세 줄이 들어가게 줄인다', () => {
		// 아이콘 두 줄 = 82×2 + 22 = 186, 위젯 두 줄 사이 16, 위와 사이 24
		expect(widgetRowHeight(800, 155, 82, gaps)).toBe(155);
		expect(widgetRowHeight(460, 155, 82, gaps)).toBe(117);
		expect(widgetRowHeight(300, 155, 82, gaps)).toBe(112);
		// 위젯 세 줄 (사이 16×2)이 들어가야 한다: (400 - 32) / 3 = 122
		expect(widgetRowHeight(400, 200, 20, gaps)).toBe(122);
	});

	it('위젯 줄 수를 받지 않는다: 한 페이지가 세 줄이 되어도 다른 페이지의 위젯 크기는 그대로다', () => {
		expect(widgetRowHeight.length).toBe(4);
	});
});

describe('iconRowsBelow', () => {
	it('위젯이 페이지를 다 차지하면 0줄 (rowsThatFit은 적어도 한 줄)', () => {
		expect(iconRowsBelow(40, 82, 22)).toBe(0);
		expect(rowsThatFit(40, 82, 22)).toBe(1);
		expect(iconRowsBelow(186, 82, 22)).toBe(2);
	});
});

describe('pageAfterSwipe', () => {
	it('폭의 20%를 넘게 왼쪽으로 끌면 다음, 오른쪽이면 이전 페이지', () => {
		expect(pageAfterSwipe(0, 3, -100, 375, 1000)).toBe(1);
		expect(pageAfterSwipe(2, 3, 100, 375, 1000)).toBe(1);
	});

	it('조금만 천천히 끌면 제자리로 돌아온다', () => {
		expect(pageAfterSwipe(1, 3, -60, 375, 1000)).toBe(1);
	});

	it('빠르게 튕기면 짧게 끌어도 넘기지만, 살짝 미끄러진 것은 넘기지 않는다', () => {
		expect(pageAfterSwipe(0, 3, -40, 375, 50)).toBe(1);
		expect(pageAfterSwipe(0, 3, -10, 375, 5)).toBe(0);
	});

	it('첫·마지막 페이지 바깥으로는 넘어가지 않는다', () => {
		expect(pageAfterSwipe(0, 3, 200, 375, 100)).toBe(0);
		expect(pageAfterSwipe(2, 3, -200, 375, 100)).toBe(2);
	});
});

describe('dragOffset', () => {
	it('페이지 사이에서는 손가락을 그대로 따라온다', () => {
		expect(dragOffset(1, 3, -90)).toBe(-90);
		expect(dragOffset(0, 3, -90)).toBe(-90);
	});

	it('첫·마지막 페이지 바깥으로는 1/3만 따라온다', () => {
		expect(dragOffset(0, 3, 90)).toBe(30);
		expect(dragOffset(2, 3, -90)).toBe(-30);
	});
});
