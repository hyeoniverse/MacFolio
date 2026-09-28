import { test, expect, appWindow } from './fixtures';
import type { Page } from '@playwright/test';

/** 로딩 화면을 탭해 넘기고 홈 화면에 들어간다. */
async function enterHome(page: Page) {
	await page.goto('/');
	const loading = page.locator('.loading-container');
	await expect(loading).toContainText('탭하여');
	await loading.tap();
	await expect(loading).toBeHidden({ timeout: 10_000 });
}

const homeApp = (page: Page, label: string) =>
	page.locator('.mobile-home').getByRole('button', { name: label, exact: true });

test.describe('모바일', () => {
	test('데스크톱 대신 iOS 홈 화면이 보이고, 처음에는 열린 앱이 없다', async ({ page }) => {
		await enterHome(page);

		await expect(page.locator('.mobile-home')).toBeVisible();
		await expect(page.locator('.macos-statusbar')).toHaveCount(0);
		await expect(page.locator('.dock')).toHaveCount(0);
		await expect(page.locator('.container')).toHaveCount(0);
		await expect(page.locator('.music-player')).toHaveCount(0);

		await expect(page.getByRole('navigation', { name: 'Dock' }).getByRole('button')).toHaveCount(4);
		// 화면이 없는 앱(Finder, 사진, 휴지통)은 홈 화면에 두지 않는다
		await expect(homeApp(page, 'Finder')).toHaveCount(0);
		await expect(homeApp(page, '휴지통')).toHaveCount(0);
	});

	test('앱은 화면을 가득 채워 열리고, 홈 인디케이터로 돌아온다', async ({ page }) => {
		await enterHome(page);
		await homeApp(page, 'Safari').tap();

		const safari = appWindow(page, 'safari');
		await expect(safari).toBeVisible();
		const { width, height } = page.viewportSize()!;
		// 여는 애니메이션이 끝나면 화면과 같은 크기가 된다
		await expect.poll(() => safari.boundingBox()).toEqual({ x: 0, y: 0, width, height });
		// 신호등 버튼과 크기 조절 핸들이 없다
		await expect(safari.locator('.traffic-lights')).toHaveCount(0);
		await expect(safari.locator('.resize-handle')).toHaveCount(0);

		await safari.getByRole('button', { name: '홈 화면으로' }).tap();
		await expect(safari).toBeHidden();

		// 제목 막대의 홈 버튼으로도 돌아온다
		await homeApp(page, '메모').tap();
		const memo = appWindow(page, 'memo');
		await expect(memo).toBeVisible();
		await memo.getByRole('button', { name: '홈', exact: true }).tap();
		await expect(memo).toBeHidden();
	});

	test('가로로 넘치는 화면이 없다', async ({ page }) => {
		await enterHome(page);
		for (const label of ['Safari', 'GitHub', '메모', '메일', '메시지', '시스템 설정', '터미널', '음악']) {
			await homeApp(page, label).tap();
			const content = page.locator('.container.mobile .content');
			await expect(content).toBeVisible();
			const overflow = await content.evaluate((el) => el.scrollWidth - el.clientWidth);
			expect(overflow, `${label}이(가) 가로로 넘친다`).toBeLessThanOrEqual(1);
			await page.locator('.home-indicator').tap();
		}
	});

	test('메모는 목록 → 본문 → 목록 → 폴더 순서로 한 화면씩 넘어간다', async ({ page }) => {
		await enterHome(page);
		await homeApp(page, '메모').tap();
		const memo = appWindow(page, 'memo');

		await expect(memo.getByRole('region', { name: '글 목록' })).toBeVisible();
		await expect(memo.getByRole('article')).toBeHidden();

		await memo.locator('.memo-item', { hasText: 'CRA에서 Vite로 옮기기' }).tap();
		await expect(memo.getByRole('article', { name: 'CRA에서 Vite로 옮기기' })).toBeVisible();
		await expect(memo.getByRole('region', { name: '글 목록' })).toBeHidden();

		await memo.getByRole('article').getByRole('button', { name: '모든 글' }).tap();
		await memo.getByRole('region', { name: '글 목록' }).getByRole('button', { name: '폴더' }).tap();
		await expect(memo.getByRole('navigation', { name: '카테고리' })).toBeVisible();

		await memo.getByRole('button', { name: /^개발기/ }).tap();
		await expect(memo.getByRole('region', { name: '글 목록' })).toBeVisible();
	});

	test('메일은 목록과 읽기·쓰기를 한 화면씩 보여준다', async ({ page }) => {
		await enterHome(page);
		await homeApp(page, '메일').tap();
		const mail = appWindow(page, 'mail');
		const list = mail.getByRole('region', { name: '받은 편지함' });

		await expect(list).toBeVisible();
		await mail.getByRole('button', { name: '새로운 메시지' }).tap();
		await expect(list).toBeHidden();
		await expect(mail.getByRole('textbox', { name: '제목' })).toBeVisible();

		await mail.getByRole('button', { name: '받은 편지함' }).tap();
		await expect(list).toBeVisible();
	});

	test('음악은 지금 재생 중 화면으로 열린다', async ({ page }) => {
		await enterHome(page);
		await homeApp(page, '음악').tap();
		const music = appWindow(page, 'music');
		await expect(music.locator('.now-playing')).toBeVisible();
		await expect(music.getByRole('button', { name: '재생' })).toBeVisible();
		await expect(page.locator('.music-player')).toHaveCount(0);
	});

	test('터미널의 open 명령으로 연 앱도 화면을 가득 채운다', async ({ page }) => {
		await enterHome(page);
		await homeApp(page, '터미널').tap();
		const terminal = appWindow(page, 'terminal');
		await terminal.locator('input').fill('open settings');
		await terminal.locator('input').press('Enter');

		const settings = appWindow(page, 'settings');
		await expect(settings).toBeVisible();
		await settings.getByRole('button', { name: '홈 화면으로' }).tap();
		// 홈으로 가면 뒤에 있던 터미널도 함께 내려간다
		await expect(settings).toBeHidden();
		await expect(terminal).toBeHidden();
		await expect(page.locator('.mobile-home')).toBeVisible();
	});

	test('홈 화면의 음악 위젯을 누르면 음악 앱이 열린다', async ({ page }) => {
		await enterHome(page);
		const widget = page.locator('.mobile-home').getByRole('region', { name: '음악' });
		await expect(widget).toBeVisible();
		await expect(widget.getByRole('button', { name: '재생' })).toBeVisible();

		await widget.locator('.music-widget-title').tap();
		await expect(appWindow(page, 'music').locator('.now-playing')).toBeVisible();
	});

	test('상태 표시줄에 시간이 보이고, 앱 위에서도 남아 있다', async ({ page }) => {
		await enterHome(page);
		const statusBar = page.getByRole('button', { name: '제어 센터 열기' });
		await expect(statusBar.locator('time')).toHaveText(/^\d{1,2}:\d{2}$/);

		await homeApp(page, 'Safari').tap();
		await expect(appWindow(page, 'safari')).toBeVisible();
		await expect(statusBar).toBeVisible();
		// 앱 내용은 상태 표시줄 아래에서 시작한다
		const barBox = (await statusBar.boundingBox())!;
		const navBox = (await appWindow(page, 'safari').locator('.mobile-navbar').boundingBox())!;
		expect(navBox.y).toBeGreaterThanOrEqual(barBox.y + barBox.height - 1);
	});

	test('상태 표시줄을 누르면 제어 센터가 열리고, 빈 곳을 누르면 닫힌다', async ({ page }) => {
		await enterHome(page);
		await page.getByRole('button', { name: '제어 센터 열기' }).tap();
		const controlCenter = page.getByRole('dialog', { name: '제어 센터' });
		await expect(controlCenter).toBeVisible();

		const { height } = page.viewportSize()!;
		await page.touchscreen.tap(20, height - 20);
		await expect(controlCenter).toBeHidden();
	});

	test('상태 표시줄을 끌어내리면 제어 센터가 열린다', async ({ page }) => {
		await enterHome(page);
		const controlCenter = page.getByRole('dialog', { name: '제어 센터' });

		// 조금만 끌면 열리지 않는다
		await page.mouse.move(200, 20);
		await page.mouse.down();
		await page.mouse.move(200, 40, { steps: 3 });
		await page.mouse.up();
		await expect(controlCenter).toBeHidden();

		await page.mouse.move(200, 20);
		await page.mouse.down();
		await page.mouse.move(200, 250, { steps: 6 });
		await page.mouse.up();
		await expect(controlCenter).toBeVisible();
	});

	test('제어 센터에서 다크 모드를 바꾸고 앱을 연다', async ({ page }) => {
		await enterHome(page);
		await page.getByRole('button', { name: '제어 센터 열기' }).tap();
		const controlCenter = page.getByRole('dialog', { name: '제어 센터' });

		const darkMode = controlCenter.getByRole('button', { name: '다크 모드' });
		const before = await page.evaluate(() => document.documentElement.dataset.theme);
		await darkMode.tap();
		await expect
			.poll(() => page.evaluate(() => document.documentElement.dataset.theme))
			.toBe(before === 'dark' ? 'light' : 'dark');

		await controlCenter.getByRole('button', { name: /연락하기/ }).tap();
		await expect(controlCenter).toBeHidden();
		await expect(appWindow(page, 'mail')).toBeVisible();
	});
});
