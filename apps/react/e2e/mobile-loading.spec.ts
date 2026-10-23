import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

/** 화면 가장자리와 아래쪽(홈 인디케이터·도구 막대 자리)의 점에서 맨 위에 있는 요소가 로딩 화면 안인지 */
async function coveredPoints(page: Page) {
	return page.evaluate(() => {
		const w = window.innerWidth;
		const h = window.innerHeight;
		const points = [
			[1, 1],
			[w - 1, 1],
			[w / 2, h / 2],
			[1, h - 1],
			[w / 2, h - 1],
			[w - 1, h - 1],
			[w / 2, h - 30],
		];
		return points.map(([x, y]) => {
			const hit = document.elementFromPoint(x, y);
			return { x, y, covered: Boolean(hit?.closest('.loading-container')), hit: hit?.className ?? null };
		});
	});
}

test.describe('휴대폰 로딩 화면', () => {
	for (const size of [
		{ width: 390, height: 844 },
		{ width: 430, height: 932 },
		{ width: 375, height: 667 },
	]) {
		test(`${size.width}×${size.height}: 로딩 화면이 화면 전체를 덮고, 누른 뒤 렌더링하는 홈 화면이 아래로 비치지 않는다`, async ({
			page,
		}) => {
			await page.setViewportSize(size);
			await page.goto('/');
			const loading = page.locator('.loading-container');
			await expect(loading).toContainText('탭하여');

			expect(await loading.boundingBox()).toEqual({ x: 0, y: 0, ...size });
			for (const point of await coveredPoints(page)) expect(point).toMatchObject({ covered: true });
			// 로딩 화면 밖이 보여도 배경화면이 아니라 검은색 (index.html의 booting)
			expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe(
				'rgb(0, 0, 0)'
			);

			// 누르면 진행 막대가 차는 동안 홈 화면을 아래에 렌더링한다. 그동안에도 로딩 화면이 전부 덮는다
			await loading.tap();
			await expect(page.locator('.mobile-home')).toBeAttached();
			for (const point of await coveredPoints(page)) expect(point).toMatchObject({ covered: true });

			await expect(loading).toBeHidden({ timeout: 20_000 });
			await expect(page.locator('.mobile-home')).toBeVisible();
		});
	}

	test('HTML의 첫 렌더링(#boot-splash)과 로딩 화면은 같은 상자와 같은 시작 안내 영역이다 (LCP가 다시 집계되지 않는다)', async ({
		page,
	}) => {
		await page.goto('/');
		await expect(page.locator('.loading-container')).toContainText('탭하여');
		// 누르기 전까지는 #boot-splash를 삭제하지 않는다 (로딩 화면이 그 위를 덮는다)
		const boxes = await page.evaluate(() => {
			const textRect = (selector: string) => {
				const range = document.createRange();
				range.selectNodeContents(document.querySelector(selector)!);
				const { x, y, width, height } = range.getBoundingClientRect();
				return { x, y, width, height };
			};
			const box = (selector: string) => {
				const { x, y, width, height } = document.querySelector(selector)!.getBoundingClientRect();
				return { x, y, width, height };
			};
			return {
				splash: box('#boot-splash'),
				loading: box('.loading-container'),
				splashText: textRect('#boot-splash p'),
				loadingText: textRect('.loading-text'),
			};
		});
		expect(boxes.loading).toEqual(boxes.splash);
		// 글자 영역이 HTML의 시작 안내보다 크면 LCP 후보로 다시 집계된다. HTML은 탭·클릭을 span으로 나눠 소수점 아래 폭이 조금 다르다
		expect(boxes.loadingText.height).toBe(boxes.splashText.height);
		expect(Math.abs(boxes.loadingText.width - boxes.splashText.width)).toBeLessThan(0.5);
		expect(Math.abs(boxes.loadingText.x - boxes.splashText.x)).toBeLessThan(0.5);
		expect(boxes.loadingText.y).toBe(boxes.splashText.y);

		await page.locator('.loading-container').tap();
		await expect(page.locator('#boot-splash')).toHaveCount(0);
	});
});
