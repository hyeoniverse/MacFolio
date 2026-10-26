import { test, expect, appWindow } from './fixtures';
import type { Page } from '@playwright/test';

async function openMemoList(page: Page) {
	await page.goto('/');
	const loading = page.locator('.loading-container');
	await expect(loading).toContainText('탭하여');
	await loading.tap();
	await expect(loading).toBeHidden({ timeout: 20_000 });
	const home = page.locator('.mobile-home');
	const pages = home.locator('.mobile-page');
	const count = await pages.count();
	for (let index = 0; index < count; index++) {
		if ((await pages.nth(index).locator('.mobile-app[aria-label="메모"]').count()) === 0) continue;
		if (count > 1) await home.getByRole('tab', { name: `${index + 1}쪽` }).click();
		await pages.nth(index).locator('.mobile-app[aria-label="메모"]').tap();
		break;
	}
	const memo = appWindow(page, 'memo');
	await expect(memo.getByRole('region', { name: '글 목록' })).toBeVisible();
	return memo;
}

test.describe('휴대폰 메모 검색', () => {
	test('오타로 찾으면 비슷한 글이 보이고, 누르면 그 글을 연다', async ({ page }) => {
		const memo = await openMemoList(page);
		await memo.getByRole('searchbox', { name: '글 검색' }).fill('dispetcher');
		const similar = memo.getByRole('region', { name: '비슷한 검색 결과' });
		await expect(similar.getByRole('button', { name: 'dispatcher', exact: true })).toBeVisible();
		await similar.getByRole('button', { name: /Flux 패턴/ }).tap();
		await expect(memo.getByRole('article', { name: /^Flux 패턴/ })).toBeVisible();
	});
});
