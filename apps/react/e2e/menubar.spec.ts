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
	test('맨 앞은 굵은 앱 이름 메뉴, 그 뒤로 앱이 쓰는 제목만: 처음 앞에 있는 Safari', async ({ page }) => {
		await enterDesktop(page);
		await expect(bar(page).getByRole('button')).toHaveText(['Safari', '파일', '책갈피', '윈도우', '도움말']);
	});

	test('윈도우 메뉴에는 이 앱의 창만: 다른 앱이 없다. 최소화하면 다음 창, 앱 이름 메뉴로 종료', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'memo').click();
		await expect(appName(page)).toHaveText('메모');

		const windows = await openMenu(page, '윈도우');
		// 메뉴 제목을 눌러도 지금 쓰는 앱은 그대로다
		await expect(appName(page)).toHaveText('메모');
		await expect(windows.getByRole('menuitem')).toHaveText([/^최소화/, /^확대\/축소/, /^윈도우 닫기/]);
		await expect(windows.getByText('Safari')).toHaveCount(0);
		await windows.getByRole('menuitem', { name: '최소화' }).click();
		await expect(appWindow(page, 'memo')).toBeHidden();
		await expect(appName(page)).toHaveText('Safari');

		const app = await openMenu(page, 'Safari');
		await expect(app.getByRole('menuitem')).toHaveText([/Safari 가리기/, /Safari 종료/]);
		await app.getByRole('menuitem', { name: /Safari 종료/ }).click();
		await expect(appWindow(page, 'safari')).toBeHidden();
		await expect(appName(page)).toHaveText('Finder');
	});

	test('윈도우 → 윈도우 닫기는 창의 닫기와 같다 (파일이 아니라 윈도우 메뉴에)', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'memo').click();
		await (await openMenu(page, '윈도우')).getByRole('menuitem', { name: /윈도우 닫기/ }).click();
		await expect(appWindow(page, 'memo')).toBeHidden();
		await expect(appName(page)).toHaveText('Safari');
	});

	test('다크 모드는 앱의 보기가 아니라 Apple 메뉴에', async ({ page }) => {
		await enterDesktop(page);
		const html = page.locator('html');
		const dark = (await html.getAttribute('data-theme')) === 'dark';
		const apple = page.getByRole('button', { name: 'Apple 메뉴', exact: true });
		await apple.click();
		await page.getByRole('menu', { name: 'Apple 메뉴' }).getByRole('menuitemcheckbox', { name: '다크 모드' }).click();
		await expect(html).toHaveAttribute('data-theme', dark ? 'light' : 'dark');
		await apple.click();
		await expect(
			page.getByRole('menu', { name: 'Apple 메뉴' }).getByRole('menuitemcheckbox', { name: '다크 모드' })
		).toHaveAttribute('aria-checked', dark ? 'false' : 'true');
	});

	test('메뉴가 열린 채 다른 제목에 올리면 넘어가고, ←·→로도 옮긴다', async ({ page }) => {
		await enterDesktop(page);
		await openMenu(page, '파일');
		await title(page, '책갈피').hover();
		await expect(menu(page, '책갈피')).toBeVisible();
		await expect(menu(page, '파일')).toHaveCount(0);

		await page.keyboard.press('ArrowRight');
		await expect(menu(page, '윈도우')).toBeVisible();
		await page.keyboard.press('ArrowLeft');
		await page.keyboard.press('ArrowLeft');
		await expect(menu(page, '파일')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.getByRole('menu')).toHaveCount(0);
	});

	test('바탕화면을 눌러 Finder가 되면 창 항목이 없는 Finder의 메뉴 (Finder는 종료할 수 없다)', async ({ page }) => {
		await enterDesktop(page);
		const desktop = await desktopPoint(page);
		await page.mouse.click(desktop.x, desktop.y);
		await expect(appName(page)).toHaveText('Finder');
		// 창이 없으니 앱 메뉴(가리기)·윈도우도 없다. 앱 이름은 눌러도 열 것이 없는 글자로 남는다
		await expect(bar(page).getByRole('button')).toHaveText(['도움말']);
		await expect(bar(page).getByRole('button', { name: 'Finder' })).toHaveCount(0);
	});

	test('주소가 있는 화면(메모의 글)이면 파일에 링크 복사, 도움말에서 API 문서', async ({ page }) => {
		await enterDesktop(page, '/memo/cra-to-vite');
		await expect(appName(page)).toHaveText('메모');
		await expect((await openMenu(page, '파일')).getByRole('menuitem', { name: '링크 복사' })).toBeVisible();
		await page.keyboard.press('Escape');

		// 사이트 바로가기(API 문서·GitHub 저장소)는 도움말이 아니라 Apple 메뉴에
		await page.getByRole('button', { name: 'Apple 메뉴', exact: true }).click();
		await page.getByRole('menu', { name: 'Apple 메뉴' }).getByRole('menuitem', { name: 'API 문서' }).click();
		await expect(appWindow(page, 'apidocs')).toBeVisible();
		await expect(appName(page)).toHaveText('API 문서');
	});

	test('메모: 편집·보기 메뉴가 생기고, 갤러리로 보기·찾기를 고른다. 방문자에게는 새로운 메모가 없다', async ({
		page,
	}) => {
		await enterDesktop(page, '/memo/cra-to-vite');
		const memo = appWindow(page, 'memo');
		await expect(bar(page).getByRole('button')).toHaveText(['메모', '파일', '편집', '보기', '윈도우', '도움말']);
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

	test('Safari: 윈도우 메뉴로 다음·이전 탭, 책갈피로 프로젝트, 파일 메뉴로 새로운 탭', async ({ page }) => {
		await enterDesktop(page);
		const safari = appWindow(page, 'safari');
		const tabs = safari.getByRole('tab');
		await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
		await expect((await openMenu(page, '윈도우')).getByRole('menuitem', { name: /이전 탭 보기/ })).toBeDisabled();
		await menu(page, '윈도우')
			.getByRole('menuitem', { name: /다음 탭 보기/ })
			.click();
		await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
		await (await openMenu(page, '윈도우')).getByRole('menuitem', { name: /이전 탭 보기/ }).click();
		await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');

		// 책갈피: 프로젝트를 고르면 그 탭 (지금 탭에 체크)
		const bookmarks = await openMenu(page, '책갈피');
		await expect(bookmarks.getByRole('menuitemcheckbox').first()).toHaveAttribute('aria-checked', 'true');
		await bookmarks.getByRole('menuitemcheckbox', { name: /NewPick/ }).click();
		await expect(safari.getByRole('tab', { name: /NewPick/ })).toHaveAttribute('aria-selected', 'true');

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
		await expect(bar(page).getByRole('button')).toHaveText(['음악', '제어', '윈도우', '도움말']);
		await (await openMenu(page, '제어')).getByRole('menuitemcheckbox', { name: '셔플' }).click();
		const playbar = appWindow(page, 'music').getByRole('contentinfo', { name: '재생 막대' });
		await expect(playbar.getByRole('button', { name: '셔플' })).toHaveAttribute('aria-pressed', 'true');
		const controls = await openMenu(page, '제어');
		await expect(controls.getByRole('menuitemcheckbox', { name: '셔플' })).toHaveAttribute('aria-checked', 'true');
		// 반복은 셋 중 하나를 고른다 (macOS 음악처럼)
		await expect(controls.getByRole('menuitemcheckbox', { name: '전체 반복' })).toHaveAttribute('aria-checked', 'true');
		await controls.getByRole('menuitemcheckbox', { name: '한 곡 반복' }).click();
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
		await page.getByRole('button', { name: 'Apple 메뉴', exact: true }).click();
		await page.getByRole('menu', { name: 'Apple 메뉴' }).getByRole('menuitem', { name: 'API 문서' }).click();
		const docs = appWindow(page, 'apidocs');
		await expect(docs.frameLocator('iframe').getByRole('heading', { name: 'MacFolio API' })).toBeVisible({
			timeout: 15_000,
		});
		await expect(bar(page).getByRole('button')).toHaveText(['API 문서', '파일', '보기', '윈도우', '도움말']);

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
