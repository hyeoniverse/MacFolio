import { test, expect, appWindow } from './fixtures';

test.use({ reducedMotion: 'no-preference' });

test('모바일: 앱은 아이콘에서 커지고, 홈으로 가면 아이콘으로 줄어든 뒤 사라진다', async ({ page }) => {
	await page.goto('/');
	const loading = page.locator('.loading-container');
	await loading.tap();
	await expect(loading).toBeHidden({ timeout: 20_000 });

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

test('모바일: 아래에서 올라온 시트는 닫으면 덮개가 걷히며 내려가고, 움직임이 끝나면 남지 않는다', async ({ page }) => {
	await page.goto('/');
	const loading = page.locator('.loading-container');
	await loading.tap();
	await expect(loading).toBeHidden({ timeout: 20_000 });

	await page.locator('.mobile-home').getByRole('button', { name: '메일', exact: true }).tap();
	const mail = appWindow(page, 'mail');
	await mail.getByRole('button', { name: '새로운 메시지' }).tap();
	const sheet = mail.getByRole('dialog', { name: '새로운 메시지' });
	await expect(sheet).toBeVisible();

	// 닫으면 시트는 바로 빠지고(시험·화면 읽기 프로그램은 닫힌 뒤를 본다), 겉모습만 남은 복사본이 내려간다
	await sheet.getByRole('button', { name: '취소' }).tap();
	await expect(sheet).toHaveCount(0);
	await expect(mail.locator('[data-exiting="dim-out"] .ui-sheet')).toHaveCount(1);
	await expect(mail.locator('[data-exiting]')).toHaveCount(0);
});
