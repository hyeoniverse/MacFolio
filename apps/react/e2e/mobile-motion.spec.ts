import { test, expect, appWindow } from './fixtures';

test.use({ reducedMotion: 'no-preference' });

test('모바일: 앱은 아이콘에서 커지고, 홈으로 가면 아이콘으로 줄어든 뒤 사라진다', async ({ page }) => {
	await page.goto('/');
	const loading = page.locator('.loading-container');
	await loading.tap();
	await expect(loading).toBeHidden({ timeout: 10_000 });

	await page.locator('.mobile-home').getByRole('button', { name: '메모', exact: true }).tap();
	const memo = appWindow(page, 'memo');
	await expect(memo).toBeVisible();
	// 홈 화면은 뒤로 물러난다
	await expect
		.poll(() => page.locator('.mobile-home').evaluate((el) => getComputedStyle(el).transform))
		.not.toBe('none');

	await memo.getByRole('button', { name: '홈 화면으로' }).tap();
	await expect(memo).toHaveClass(/closing/);
	await expect(memo).toBeHidden();
	await expect
		.poll(() => page.locator('.mobile-home').evaluate((el) => getComputedStyle(el).transform))
		.toMatch(/none|matrix\(1, 0, 0, 1, 0, 0\)/);
});
