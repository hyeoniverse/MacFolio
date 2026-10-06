import { test, expect, enterDesktop, appWindow, dockItem, desktopPoint } from './fixtures';
import type { Page } from '@playwright/test';

const bar = (page: Page) => page.getByRole('group', { name: '메뉴 막대' });
const title = (page: Page, name: string) => bar(page).getByRole('button', { name, exact: true });
const menu = (page: Page, name: string) => page.getByRole('menu', { name, exact: true });
const appName = (page: Page) => page.locator('.macos-statusbar .app-name');
const openMenu = async (page: Page, name: string) => {
	await title(page, name).click();
	await expect(menu(page, name)).toBeVisible();
	return menu(page, name);
};

test.describe('메뉴 막대의 메뉴 (#96)', () => {
	test('앱이 쓰지 않는 제목은 감춘다: 파일·보기·윈도우·도움말만', async ({ page }) => {
		await enterDesktop(page);
		await expect(bar(page).getByRole('button')).toHaveText(['파일', '보기', '윈도우', '도움말']);
	});

	test('윈도우 메뉴: 열린 창 목록에서 고르면 그 창이 앞으로, 최소화하면 다음 창', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'memo').click();
		await expect(appName(page)).toHaveText('메모');

		let windows = await openMenu(page, '윈도우');
		// 메뉴 제목을 눌러도 지금 쓰는 앱은 그대로다
		await expect(appName(page)).toHaveText('메모');
		await expect(windows.getByRole('menuitemcheckbox', { name: '메모' })).toHaveAttribute('aria-checked', 'true');
		await windows.getByRole('menuitemcheckbox', { name: 'Safari' }).click();
		await expect(appName(page)).toHaveText('Safari');

		windows = await openMenu(page, '윈도우');
		await windows.getByRole('menuitem', { name: '최소화' }).click();
		await expect(appWindow(page, 'safari')).toBeHidden();
		await expect(appName(page)).toHaveText('메모');
	});

	test('파일 → 윈도우 닫기는 창의 닫기와 같다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'memo').click();
		await (await openMenu(page, '파일')).getByRole('menuitem', { name: '윈도우 닫기' }).click();
		await expect(appWindow(page, 'memo')).toBeHidden();
		await expect(appName(page)).toHaveText('Safari');
	});

	test('보기 → 다크 모드를 켜고 끈다', async ({ page }) => {
		await enterDesktop(page);
		const html = page.locator('html');
		const dark = (await html.getAttribute('data-theme')) === 'dark';
		await (await openMenu(page, '보기')).getByRole('menuitemcheckbox', { name: '다크 모드' }).click();
		await expect(html).toHaveAttribute('data-theme', dark ? 'light' : 'dark');
		const item = (await openMenu(page, '보기')).getByRole('menuitemcheckbox', { name: '다크 모드' });
		await expect(item).toHaveAttribute('aria-checked', dark ? 'false' : 'true');
	});

	test('메뉴가 열린 채 다른 제목에 올리면 넘어가고, ←·→로도 옮긴다', async ({ page }) => {
		await enterDesktop(page);
		await openMenu(page, '파일');
		await title(page, '보기').hover();
		await expect(menu(page, '보기')).toBeVisible();
		await expect(menu(page, '파일')).toHaveCount(0);

		await page.keyboard.press('ArrowRight');
		await expect(menu(page, '윈도우')).toBeVisible();
		await page.keyboard.press('ArrowLeft');
		await page.keyboard.press('ArrowLeft');
		await expect(menu(page, '파일')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.getByRole('menu')).toHaveCount(0);
	});

	test('바탕화면을 눌러 Finder가 되면 창 항목이 없는 Finder의 메뉴', async ({ page }) => {
		await enterDesktop(page);
		const desktop = await desktopPoint(page);
		await page.mouse.click(desktop.x, desktop.y);
		await expect(appName(page)).toHaveText('Finder');
		// 창이 없으니 파일(윈도우 닫기)은 비고, 윈도우에는 열린 창 목록만
		await expect(bar(page).getByRole('button')).toHaveText(['보기', '윈도우', '도움말']);
		const windows = await openMenu(page, '윈도우');
		await expect(windows.getByRole('menuitem', { name: '최소화' })).toHaveCount(0);
		await expect(windows.getByRole('menuitemcheckbox', { name: 'Safari' })).toBeVisible();
	});

	test('주소가 있는 화면(메모의 글)이면 파일에 링크 복사, 도움말에서 API 문서', async ({ page }) => {
		await enterDesktop(page, '/memo/cra-to-vite');
		await expect(appName(page)).toHaveText('메모');
		await expect((await openMenu(page, '파일')).getByRole('menuitem', { name: '링크 복사' })).toBeVisible();
		await page.keyboard.press('Escape');

		await (await openMenu(page, '도움말')).getByRole('menuitem', { name: 'API 문서' }).click();
		await expect(appWindow(page, 'apidocs')).toBeVisible();
		await expect(appName(page)).toHaveText('API 문서');
	});
});
