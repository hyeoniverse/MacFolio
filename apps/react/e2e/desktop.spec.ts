import { test, expect, enterDesktop, dockItem, appWindow, zIndexOf } from './fixtures';

test.describe('데스크톱', () => {
	test('로딩 화면을 넘기면 Dock과 시작 앱이 보인다', async ({ page }) => {
		await enterDesktop(page);

		await expect(page.locator('.dock-left .dock-item')).toHaveCount(11);
		await expect(dockItem(page, 'launchpad')).toBeVisible();
		await expect(dockItem(page, 'bin')).toBeVisible();
		await expect(appWindow(page, 'safari')).toBeVisible();
		await expect(appWindow(page, 'music')).toBeVisible();
	});

	test('Dock에서 앱을 열고 닫고 다시 열 수 있다', async ({ page }) => {
		await enterDesktop(page);
		const memo = appWindow(page, 'memo');

		await dockItem(page, 'memo').click();
		await expect(memo).toBeVisible();

		await memo.getByRole('button', { name: '닫기' }).click();
		await expect(memo).toBeHidden();

		await dockItem(page, 'memo').click();
		await expect(memo).toBeVisible();
	});

	test('최소화한 앱을 Dock에서 다시 띄울 수 있다', async ({ page }) => {
		await enterDesktop(page);
		const github = appWindow(page, 'github');

		await dockItem(page, 'github').click();
		await expect(github).toBeVisible();

		await github.getByRole('button', { name: '최소화' }).click();
		await expect(github).toBeHidden();

		await dockItem(page, 'github').click();
		await expect(github).toBeVisible();
	});

	test('클릭한 창이 맨 앞으로 온다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'github').click();
		await dockItem(page, 'mail').click();
		expect(await zIndexOf(page, 'mail')).toBeGreaterThan(await zIndexOf(page, 'github'));

		// 두 창이 같은 위치에 열리므로 위에 있는 Mail을 옆으로 옮긴 뒤 GitHub을 클릭한다
		const mailBar = (await appWindow(page, 'mail').locator('.macos-titlebar').boundingBox())!;
		await page.mouse.move(mailBar.x + 100, mailBar.y + mailBar.height / 2);
		await page.mouse.down();
		await page.mouse.move(mailBar.x + 900, mailBar.y + mailBar.height / 2 + 300, { steps: 10 });
		await page.mouse.up();

		await appWindow(page, 'github')
			.locator('.content')
			.click({ position: { x: 20, y: 20 } });
		expect(await zIndexOf(page, 'github')).toBeGreaterThan(await zIndexOf(page, 'mail'));
	});

	test('제목 표시줄을 끌어 창을 옮길 수 있다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'mail').click();
		const titleBar = appWindow(page, 'mail').locator('.macos-titlebar');
		const before = (await titleBar.boundingBox())!;

		await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
		await page.mouse.down();
		await page.mouse.move(before.x + before.width / 2 + 120, before.y + before.height / 2 + 60, { steps: 10 });
		await page.mouse.up();

		const after = (await titleBar.boundingBox())!;
		expect(after.x - before.x).toBeCloseTo(120, -1);
		expect(after.y - before.y).toBeCloseTo(60, -1);
	});

	test('Music 창을 닫아도 앱이 멈추지 않고 다시 열 수 있다', async ({ page }) => {
		await enterDesktop(page);
		const music = appWindow(page, 'music');
		await expect(music).toBeVisible();

		await music.getByRole('button', { name: '닫기' }).click();
		await expect(music).toBeHidden();
		await expect(page.locator('.dock')).toBeVisible();

		await dockItem(page, 'music').click();
		await expect(music).toBeVisible();
	});

	test('Notion은 새 탭으로 외부 페이지를 연다', async ({ page, context }) => {
		// 외부 사이트에 실제로 접속하지 않는다
		await context.route(/notion\.site/, (route) => route.fulfill({ status: 200, body: 'notion' }));
		await enterDesktop(page);

		const popupPromise = page.waitForEvent('popup');
		await dockItem(page, 'notion').click();
		const popup = await popupPromise;
		await popup.waitForURL(/notion\.site/);
	});

	test('Share는 현재 주소를 복사하고 알림을 띄운다', async ({ page, context }) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await enterDesktop(page);

		await dockItem(page, 'share').click();
		await expect(page.getByText('링크가 복사되었습니다!')).toBeVisible();
		expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
	});
});

test.describe('좁은 화면', () => {
	test.use({ viewport: { width: 900, height: 800 } });

	test('Dock에 다 들어가지 않는 앱은 Launchpad에 모인다', async ({ page }) => {
		await enterDesktop(page);
		// (900 - 300) / 100 = 6개만 Dock에 표시
		await expect(page.locator('.dock-left .dock-item')).toHaveCount(6);

		await dockItem(page, 'launchpad').click();
		const launchpad = page.locator('.launchpad-modal');
		await expect(launchpad.locator('.dock-item')).toHaveCount(5);

		// 뒤쪽 5개(github부터)가 Launchpad로 간다
		await launchpad.getByRole('button', { name: 'github', exact: true }).click();
		await expect(appWindow(page, 'github')).toBeVisible();
	});
});
