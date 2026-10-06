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
	test('앱이 쓰지 않는 제목은 감춘다: 처음 앞에 있는 Safari는 편집이 없다', async ({ page }) => {
		await enterDesktop(page);
		await expect(bar(page).getByRole('button')).toHaveText(['파일', '보기', '이동', '윈도우', '도움말']);
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
		await expect(menu(page, '이동')).toBeVisible();
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

	test('메모: 편집·보기 메뉴가 생기고, 갤러리로 보기·찾기를 고른다. 방문자에게는 새로운 메모가 없다', async ({
		page,
	}) => {
		await enterDesktop(page, '/memo/cra-to-vite');
		const memo = appWindow(page, 'memo');
		await expect(bar(page).getByRole('button')).toHaveText(['파일', '편집', '보기', '윈도우', '도움말']);
		await expect((await openMenu(page, '파일')).getByRole('menuitem', { name: '새로운 메모' })).toHaveCount(0);
		await page.keyboard.press('Escape');

		await (await openMenu(page, '편집')).getByRole('menuitem', { name: '찾기…' }).click();
		await expect(memo.getByRole('search', { name: '메모에서 찾기' })).toBeVisible();

		await (await openMenu(page, '보기')).getByRole('menuitemcheckbox', { name: '갤러리로 보기' }).click();
		await expect(memo.getByRole('region', { name: '갤러리' })).toBeVisible();
		const view = await openMenu(page, '보기');
		await expect(view.getByRole('menuitemcheckbox', { name: '갤러리로 보기' })).toHaveAttribute('aria-checked', 'true');
		await expect(view.getByRole('menuitemcheckbox', { name: '목록으로 보기' })).toHaveAttribute(
			'aria-checked',
			'false'
		);
	});

	test('Safari: 이동 메뉴로 다음·이전 탭, 파일 메뉴로 새로운 탭', async ({ page }) => {
		await enterDesktop(page);
		const safari = appWindow(page, 'safari');
		const tabs = safari.getByRole('tab');
		await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
		await expect((await openMenu(page, '이동')).getByRole('menuitem', { name: '이전 탭' })).toBeDisabled();
		await menu(page, '이동').getByRole('menuitem', { name: '다음 탭' }).click();
		await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
		await (await openMenu(page, '이동')).getByRole('menuitem', { name: '이전 탭' }).click();
		await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');

		const before = await tabs.count();
		await (await openMenu(page, '파일')).getByRole('menuitem', { name: '새로운 탭' }).click();
		await expect(tabs).toHaveCount(before + 1);
	});

	test('Finder: 이동 메뉴의 즐겨찾기로 폴더를 열고, 뒤로. 바탕화면에서 골라도 Finder 창이 열린다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'finder').click();
		const finder = appWindow(page, 'finder');
		await expect(finder.getByRole('heading', { level: 1 })).toHaveText('문서');
		await (await openMenu(page, '이동')).getByRole('menuitemcheckbox', { name: '블로그' }).click();
		await expect(finder.getByRole('heading', { level: 1 })).toHaveText('블로그');
		await (await openMenu(page, '이동')).getByRole('menuitem', { name: '뒤로' }).click();
		await expect(finder.getByRole('heading', { level: 1 })).toHaveText('문서');

		// Finder 창을 닫고 바탕화면에서 이동 → 블로그를 고르면 창이 다시 열린다
		await finder.getByRole('button', { name: '닫기', exact: true }).click();
		await expect(finder).toBeHidden();
		const desktop = await desktopPoint(page);
		await page.mouse.click(desktop.x, desktop.y);
		await expect(appName(page)).toHaveText('Finder');
		await (await openMenu(page, '이동')).getByRole('menuitemcheckbox', { name: '블로그' }).click();
		await expect(finder).toBeVisible();
		await expect(finder.getByRole('heading', { level: 1 })).toHaveText('블로그');
	});

	test('음악: 앱만의 제어 메뉴로 셔플과 반복을 바꾼다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'music').click();
		await expect(bar(page).getByRole('button')).toHaveText(['파일', '보기', '제어', '윈도우', '도움말']);
		await (await openMenu(page, '제어')).getByRole('menuitemcheckbox', { name: '셔플' }).click();
		const playbar = appWindow(page, 'music').getByRole('contentinfo', { name: '재생 막대' });
		await expect(playbar.getByRole('button', { name: '셔플' })).toHaveAttribute('aria-pressed', 'true');
		const controls = await openMenu(page, '제어');
		await expect(controls.getByRole('menuitemcheckbox', { name: '셔플' })).toHaveAttribute('aria-checked', 'true');
		await expect(controls.getByRole('menuitem', { name: '반복: 전체' })).toBeVisible();
		await controls.getByRole('menuitem', { name: '반복: 전체' }).click();
		await expect(playbar.getByRole('button', { name: '한 곡 반복' })).toBeVisible();
	});
});
