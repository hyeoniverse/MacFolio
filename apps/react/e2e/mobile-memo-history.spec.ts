import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

async function enterHome(page: Page, path: string) {
	await page.goto(path);
	const loading = page.locator('.loading-container');
	await expect(loading).toContainText('탭하여');
	await loading.tap();
	await expect(loading).toBeHidden({ timeout: 20_000 });
}

test('휴대폰 메모에는 뒤로·앞으로 버튼이 없다 (iOS 메모처럼 화면마다 떠 있는 뒤로 가기를 쓴다)', async ({ page }) => {
	await enterHome(page, '/memo/merge-strategies');
	const memo = page.locator('[data-app="memo"]');
	await expect(memo.locator('.memo-reader')).toBeVisible();
	await expect(memo.locator('.memo-history')).toHaveCount(0);
});
