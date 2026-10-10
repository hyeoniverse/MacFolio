import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Page } from '@playwright/test';
import { fakeApi } from './fakeApi';

const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);
const windowBackground = (page: Page, name: string) =>
	appWindow(page, name).evaluate((el) => getComputedStyle(el).backgroundColor);

/** 설정을 열고 화면 모드로 간다 (처음에는 계정이 열린다) */
async function openSettings(page: Page) {
	await enterDesktop(page);
	await dockItem(page, 'settings').click();
	const settings = appWindow(page, 'settings');
	await settings.getByRole('button', { name: '화면 모드' }).click();
	return settings;
}

test.describe('Settings', () => {
	test('사이드바 항목의 ›는 줄 오른쪽 끝에 붙는다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'settings').click();
		const items = appWindow(page, 'settings').locator('.settings-nav-item');
		await expect(items).toHaveCount(6);
		const gaps = await items.evaluateAll((rows) =>
			rows.map((row) => {
				const chevron = row.querySelector('.settings-nav-chevron')!.getBoundingClientRect();
				const right = row.getBoundingClientRect().right - parseFloat(getComputedStyle(row).paddingRight);
				return Math.abs(Math.round(right - chevron.right));
			})
		);
		expect(gaps).toEqual([0, 0, 0, 0, 0, 0]);
	});

	test('처음 열면 계정이 보인다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'settings').click();
		const settings = appWindow(page, 'settings');
		await expect(settings.getByRole('region', { name: '관리자 계정' })).toBeVisible();
	});

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

test.describe('시스템 설정 스크롤', () => {
	for (const viewport of [
		{ width: 1280, height: 800 },
		{ width: 1600, height: 1000 },
	]) {
		test(`스크롤은 패널(과 넘치면 사이드바)만 하고, 창 전체는 스크롤되지 않는다 (${viewport.width}px)`, async ({
			page,
		}) => {
			await page.setViewportSize(viewport);
			// 관리자: 항목이 가장 많다
			await fakeApi(page, { signedIn: true });
			await enterDesktop(page);
			await dockItem(page, 'settings').click();
			const settings = appWindow(page, 'settings');
			const content = settings.locator('.content');
			for (const item of ['정보', '개인정보 보호 및 보안', '프로젝트', '배경화면']) {
				const button = settings.getByRole('button', { name: item, exact: true });
				if ((await button.count()) === 0) continue;
				await button.click();
				// 창의 콘텐츠 칸은 넘치지 않는다 (넘치면 패널 끝에서 한 번 더 스크롤된다)
				await expect
					.poll(() => content.evaluate((element) => element.scrollHeight - element.clientHeight))
					.toBeLessThanOrEqual(1);
				// 패널은 창 안에 들어온다 (위쪽 탭에 밀려 몇십 px로 눌리지 않는다)
				const panel = (await settings.locator('.settings-panel').boundingBox())!;
				expect(panel.height).toBeGreaterThan(200);
			}
		});
	}
});
