import { describe, expect, it } from 'vitest';
import { pageApps, rowsThatFit } from './homePages';

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
