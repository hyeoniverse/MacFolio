import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import { fakeApi } from './fakeApi';
import { layoutPost } from './memoLayoutPost';

async function enterHome(page: Page, path: string) {
	await page.goto(path);
	const loading = page.locator('.loading-container');
	await expect(loading).toContainText('탭하여');
	await loading.tap();
	await expect(loading).toBeHidden({ timeout: 20_000 });
}

test.describe('휴대폰 메모: 목차와 이미지 배치', () => {
	test('목차는 접힌 채 시작하고, 탭하면 펼치고 다시 탭하면 접는다. 항목을 누르면 그 제목으로 간다. 떠 있는 목차 버튼은 없다', async ({
		page,
	}) => {
		await fakeApi(page, { signedIn: false });
		await enterHome(page, '/memo/merge-strategies');
		const toc = page.getByRole('navigation', { name: '목차' });
		const toggle = toc.getByRole('button', { name: '목차', exact: true });
		const list = toc.locator('.memo-toc-list');
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await expect(list).toBeHidden();
		await toggle.tap();
		await expect(list).toBeVisible();
		// 손가락으로 누르기 쉽게 목차 줄과 항목은 높이 44px 이상이다
		for (const row of [toggle, ...(await toc.locator('li button').all())])
			expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(44);

		const item = toc.locator('li button').nth(2);
		const name = (await item.textContent())!.trim();
		await item.tap();
		await expect(
			page.locator('.memo-reader-body .memo-markdown').getByRole('heading', { name }).first()
		).toBeInViewport();
		await expect(page.getByRole('button', { name: '목차 보기' })).toHaveCount(0);

		await toggle.scrollIntoViewIfNeeded();
		await toggle.tap();
		await expect(list).toBeHidden();
	});

	test('띄운 이미지는 휴대폰에서 띄우지 않고 본문 폭으로 보인다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: false });
		api.posts = [layoutPost()];
		await enterHome(page, '/memo/layout-test');
		const body = page.locator('.memo-reader-body .memo-markdown');
		const figure = body.locator('.memo-figure[data-layout="float-left"]');
		await expect(figure).toBeVisible();
		expect(await figure.evaluate((el) => getComputedStyle(el).float)).toBe('none');
		const [area, rect] = await Promise.all([body.boundingBox(), figure.boundingBox()]);
		expect(Math.abs(rect!.width - area!.width)).toBeLessThan(2);
	});
});
