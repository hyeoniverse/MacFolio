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
		await similar.getByRole('button', { name: /Flux의 Action·Dispatcher/ }).tap();
		await expect(memo.getByRole('article', { name: /^Flux의 Action·Dispatcher/ })).toBeVisible();
	});

	test('검색 결과는 날짜 묶음 없이 순위대로, 결과가 없어지면 목록에 이전 글이 남지 않는다', async ({ page }) => {
		const memo = await openMemoList(page);
		const list = memo.locator('.memo-list .memo-scroll > .memo-items');
		const search = memo.getByRole('searchbox', { name: '글 검색' });
		// 맞는 정도 순서는 날짜 순서와 다르다: 날짜 묶음으로 나누면 같은 묶음 제목이 여러 번 생겨 React key가 겹친다
		await search.fill('리액트');
		await expect(list.locator('.memo-item').first()).toContainText('React');
		await expect(memo.locator('.memo-list .memo-section-title')).toHaveCount(0);
		await search.fill('');
		await search.fill('리엑트');
		await expect(memo.getByRole('region', { name: '비슷한 검색 결과' })).toBeVisible();
		await expect(memo.locator('.memo-list .memo-scroll > .memo-items')).toHaveCount(0);
		await expect(memo.locator('.memo-phone-title p')).toHaveText('0개의 메모');
	});
});
