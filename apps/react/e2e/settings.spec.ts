import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Page } from '@playwright/test';

const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);
const windowBackground = (page: Page, name: string) =>
	appWindow(page, name).evaluate((el) => getComputedStyle(el).backgroundColor);

async function openSettings(page: Page) {
	await enterDesktop(page);
	await dockItem(page, 'settings').click();
	return appWindow(page, 'settings');
}

test.describe('Settings', () => {
	test('다크 모드를 고르면 창이 어두워지고, 새로고침해도 유지된다', async ({ page }) => {
		const settings = await openSettings(page);
		expect(await theme(page)).toBe('light');

		await settings.getByRole('radio', { name: '다크' }).click();
		expect(await theme(page)).toBe('dark');
		expect(await windowBackground(page, 'settings')).toBe('rgb(30, 30, 30)');

		await page.reload();
		expect(await theme(page)).toBe('dark');
	});

	test('자동은 기기의 화면 모드를 따른다', async ({ page }) => {
		const settings = await openSettings(page);
		await settings.getByRole('radio', { name: '자동' }).click();

		await page.emulateMedia({ colorScheme: 'dark' });
		await expect.poll(() => theme(page)).toBe('dark');

		await page.emulateMedia({ colorScheme: 'light' });
		await expect.poll(() => theme(page)).toBe('light');
	});

	test('처음 방문하면 기기의 화면 모드를 따른다', async ({ browser }) => {
		const context = await browser.newContext({ colorScheme: 'dark' });
		const page = await context.newPage();
		await page.goto('/');
		expect(await theme(page)).toBe('dark');
		await context.close();
	});

	test('배경화면을 바꾸면 바로 적용되고 유지된다', async ({ page }) => {
		const settings = await openSettings(page);
		await settings.getByRole('button', { name: '배경화면' }).click();
		await settings.getByRole('radiogroup', { name: 'macOS 배경화면' }).getByRole('radio', { name: 'Sonoma' }).click();

		const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundImage);
		await expect.poll(background).toContain('sonoma-light.jpg');

		// 다크 모드에서는 어두운 버전
		await settings.getByRole('button', { name: '화면 모드' }).click();
		await settings.getByRole('radio', { name: '다크' }).click();
		await expect.poll(background).toContain('sonoma-dark.jpg');

		await page.reload();
		await expect.poll(background).toContain('sonoma-dark.jpg');
	});
});
