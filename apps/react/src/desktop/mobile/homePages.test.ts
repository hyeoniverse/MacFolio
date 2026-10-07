import { describe, expect, it } from 'vitest';
import { dragOffset, pageAfterSwipe, pageApps, rowsThatFit } from './homePages';

describe('홈 화면 페이지', () => {
	it('높이에 들어가는 줄 수 (줄 사이는 마지막 줄 뒤에 없다), 적어도 한 줄', () => {
		expect(rowsThatFit(400, 82, 22)).toBe(4); // 4줄 = 82*4 + 22*3 = 394
		expect(rowsThatFit(393, 82, 22)).toBe(3);
		expect(rowsThatFit(10, 82, 22)).toBe(1);
	});

	it('첫 페이지는 위젯 아래 칸만큼, 나머지는 한 페이지씩', () => {
		const apps = Array.from({ length: 23 }, (_, index) => index);
		const pages = pageApps(apps, 8, 20);
		expect(pages.map((page) => page.length)).toEqual([8, 15]);
		expect(pages.flat()).toEqual(apps);
		expect(pageApps(apps, 24, 24).map((page) => page.length)).toEqual([23]);
		expect(pageApps([1, 2, 3], 0, 0)).toEqual([[1], [2], [3]]);
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
