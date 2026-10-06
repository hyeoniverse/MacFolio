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

	test('단축키: 메뉴 옆에 보이고, 누르면 실행된다 (지금 쓰는 앱의 것만)', async ({ page }) => {
		await enterDesktop(page);
		const safari = appWindow(page, 'safari');
		const tabs = safari.getByRole('tab');

		// 메뉴 오른쪽에 단축키 (맥은 ⌥T, 그 밖은 Alt+T)
		const newTab = (await openMenu(page, '파일')).getByRole('menuitem', { name: /새로운 탭/ });
		await expect(newTab).toHaveAttribute('aria-keyshortcuts', 'Alt+T');
		await expect(newTab).toContainText(/⌥T|Alt\+T/);
		await page.keyboard.press('Escape');

		// ⌥T 새로운 탭, ⌥⇧] 다음 탭
		const before = await tabs.count();
		await page.keyboard.press('Alt+KeyT');
		await expect(tabs).toHaveCount(before + 1);
		await tabs.first().click();
		await page.keyboard.press('Alt+Shift+BracketRight');
		await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');

		// ⌥M 최소화 (공통)
		await page.keyboard.press('Alt+KeyM');
		await expect(safari).toBeHidden();
	});

	test('단축키: 메모의 ⌘F는 글 안에서 찾기, ⌥2는 갤러리. 입력 칸에서는 ⌥ 단축키를 듣지 않는다', async ({ page }) => {
		await enterDesktop(page, '/memo/cra-to-vite');
		const memo = appWindow(page, 'memo');
		await memo.getByRole('article').click();
		await page.keyboard.press('ControlOrMeta+KeyF');
		const find = memo.getByRole('search', { name: '메모에서 찾기' });
		await expect(find).toBeVisible();

		// 찾기 칸에 글자를 쓰는 중: ⌥2는 갤러리로 바꾸지 않는다 (맥에서 ⌥는 특수 문자를 쓴다)
		await find.getByRole('textbox', { name: '찾기' }).focus();
		await page.keyboard.press('Alt+Digit2');
		await expect(memo.getByRole('region', { name: '갤러리' })).toHaveCount(0);

		await memo.getByRole('article').click();
		await page.keyboard.press('Alt+Digit2');
		await expect(memo.getByRole('region', { name: '갤러리' })).toBeVisible();
	});

	test('단축키: Finder의 ⌥[ 뒤로, 다른 앱의 단축키는 듣지 않는다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'finder').click();
		const finder = appWindow(page, 'finder');
		await (await openMenu(page, '이동')).getByRole('menuitemcheckbox', { name: '블로그' }).click();
		await expect(finder.getByRole('heading', { level: 1 })).toHaveText('블로그');
		await page.keyboard.press('Alt+BracketLeft');
		await expect(finder.getByRole('heading', { level: 1 })).toHaveText('문서');
		// Finder가 앞이면 Safari의 ⌥T(새로운 탭)는 듣지 않는다
		const tabs = appWindow(page, 'safari').getByRole('tab');
		const before = await tabs.count();
		await page.keyboard.press('Alt+KeyT');
		await expect(tabs).toHaveCount(before);
	});

	test('메일·터미널·시스템 설정의 메뉴', async ({ page }) => {
		await enterDesktop(page);
		// 메일: ⌥N 새로운 메시지
		await dockItem(page, 'mail').click();
		const mail = appWindow(page, 'mail');
		await expect(appName(page)).toHaveText('메일');
		await page.keyboard.press('Alt+KeyN');
		await expect(mail.getByRole('form', { name: '새로운 메시지' })).toBeVisible();

		// 터미널: 편집 → 화면 지우기
		await dockItem(page, 'terminal').click();
		const terminal = appWindow(page, 'terminal');
		const output = terminal.getByRole('log', { name: '터미널 출력' });
		await expect(output.locator('.terminal-line').first()).toBeVisible();
		await (await openMenu(page, '편집')).getByRole('menuitem', { name: '화면 지우기' }).click();
		await expect(output.locator('.terminal-line')).toHaveCount(0);

		// 시스템 설정: 보기에서 항목 고르기
		await dockItem(page, 'settings').click();
		const settings = appWindow(page, 'settings');
		await (await openMenu(page, '보기')).getByRole('menuitemcheckbox', { name: '배경화면' }).click();
		await expect(settings.getByRole('button', { name: '배경화면' })).toHaveAttribute('aria-current', 'page');
		await expect((await openMenu(page, '보기')).getByRole('menuitemcheckbox', { name: '배경화면' })).toHaveAttribute(
			'aria-checked',
			'true'
		);
	});

	test('API 문서·프로젝트 앱(iframe 창): 새로 고침과 새 탭에서 열기', async ({ page }) => {
		await enterDesktop(page);
		await (await openMenu(page, '도움말')).getByRole('menuitem', { name: 'API 문서' }).click();
		const docs = appWindow(page, 'apidocs');
		await expect(docs.frameLocator('iframe').getByRole('heading', { name: 'MacFolio API' })).toBeVisible({
			timeout: 15_000,
		});
		await expect(bar(page).getByRole('button')).toHaveText(['파일', '보기', '윈도우', '도움말']);

		const popup = page.waitForEvent('popup');
		await (await openMenu(page, '파일')).getByRole('menuitem', { name: '새 탭에서 열기' }).click();
		expect((await popup).url()).toContain('/api-docs');

		await page.keyboard.press('Alt+KeyR');
		await expect(docs.frameLocator('iframe').getByRole('heading', { name: 'MacFolio API' })).toBeVisible({
			timeout: 15_000,
		});
	});

	test('도움말 → 키보드 단축키: 지금 앱에서 쓸 수 있는 단축키 목록', async ({ page }) => {
		await enterDesktop(page);
		await (await openMenu(page, '도움말')).getByRole('menuitem', { name: '키보드 단축키…' }).click();
		const dialog = page.getByRole('dialog', { name: '키보드 단축키' });
		await expect(dialog).toContainText('Safari에서 쓸 수 있는 단축키');
		await expect(dialog.getByRole('region', { name: '파일' })).toContainText('새로운 탭');
		await expect(dialog.getByRole('region', { name: '파일' })).toContainText(/⌥T|Alt\+T/);
		// 안을 눌러도 지금 앱(Safari)이 그대로라 목록이 바뀌지 않는다
		await dialog.getByRole('heading', { name: '키보드 단축키' }).click();
		await expect(appName(page)).toHaveText('Safari');
		await page.keyboard.press('Escape');
		await expect(dialog).toHaveCount(0);
	});
});
