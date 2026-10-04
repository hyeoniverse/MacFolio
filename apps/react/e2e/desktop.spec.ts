import { test, expect, enterDesktop, dockItem, appWindow, zIndexOf } from './fixtures';

test.describe('데스크톱', () => {
	test('메뉴 막대의 시간이 바뀌어도 옆의 아이콘은 움직이지 않는다', async ({ page }) => {
		// 가장 짧은 시간(1:11 AM)과 가장 긴 시간(12:00 PM). 시계는 1초마다 Date를 다시 읽는다
		await page.clock.setFixedTime(new Date(2026, 9, 3, 1, 11));
		await enterDesktop(page);
		const bar = page.locator('.macos-statusbar');
		const clock = bar.locator('.time-display-now');
		const wifi = bar.locator('.fa-wifi');
		await expect(clock).toHaveText('1:11 AM');
		const before = (await wifi.boundingBox())!;

		await page.clock.setFixedTime(new Date(2026, 9, 3, 12, 0));
		await expect(clock).toHaveText('12:00 PM');
		const after = (await wifi.boundingBox())!;
		expect(after.x).toBe(before.x);
	});

	test('스크립트를 받는 동안 배경화면 대신 검은 화면이 보인다', async ({ page }) => {
		// 스크립트를 늦게 받게 해서 로딩 화면이 뜨기 전의 모습을 본다
		let release = () => {};
		const held = new Promise<void>((resolve) => (release = resolve));
		await page.route(/\.js$/, async (route) => {
			await held;
			await route.continue();
		});
		// 모듈 스크립트는 DOMContentLoaded를 막으므로 HTML을 다 읽은 시점까지만 기다린다
		await page.goto('/', { waitUntil: 'commit' });
		await page.waitForFunction(() => document.readyState !== 'loading');
		const body = await page.evaluate(() => {
			const style = getComputedStyle(document.body);
			return { image: style.backgroundImage, color: style.backgroundColor };
		});
		expect(body).toEqual({ image: 'none', color: 'rgb(0, 0, 0)' });

		release();
		await expect(page.locator('.loading-container')).toBeVisible();
		await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('booting'))).toBe(false);
	});

	test('로딩 화면을 넘기면 Dock과 시작 앱이 보인다', async ({ page }) => {
		await enterDesktop(page);

		await expect(page.locator('.dock-left .dock-item')).toHaveCount(12);
		await expect(dockItem(page, 'launchpad')).toBeVisible();
		await expect(dockItem(page, 'bin')).toBeVisible();
		await expect(appWindow(page, 'safari')).toBeVisible();
	});

	test('Dock에서 앱을 열고 닫고 다시 열 수 있다', async ({ page }) => {
		await enterDesktop(page);
		const memo = appWindow(page, 'memo');

		await dockItem(page, 'memo').click();
		await expect(memo).toBeVisible();

		await memo.getByRole('button', { name: '닫기', exact: true }).click();
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
		await dockItem(page, 'music').click();
		await expect(music).toBeVisible();

		await music.getByRole('button', { name: '닫기', exact: true }).click();
		await expect(music).toBeHidden();
		await expect(page.locator('.dock')).toBeVisible();

		await dockItem(page, 'music').click();
		await expect(music).toBeVisible();
	});

	test('Share는 현재 주소를 복사하고 알림을 띄운다', async ({ page, context }) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await enterDesktop(page);

		await dockItem(page, 'share').click();
		const notice = page.getByRole('status').filter({ hasText: '링크가 복사되었습니다!' });
		await expect(notice).toBeVisible();
		expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());

		// macOS 알림처럼 마우스를 올리면 닫기 단추가 보인다
		await notice.hover();
		await notice.getByRole('button', { name: '알림 닫기' }).click();
		await expect(notice).toBeHidden();
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
		// 들어가지 않은 6개 + Dock에 고정하지 않은 프로젝트 앱 4개 (HYEONIVERSE, NewPick, QRU, WTD)
		await expect(launchpad.locator('.dock-item')).toHaveCount(10);

		// 뒤쪽 6개(github부터)가 Launchpad로 간다
		await launchpad.getByRole('button', { name: 'github', exact: true }).click();
		await expect(appWindow(page, 'github')).toBeVisible();
	});
});
