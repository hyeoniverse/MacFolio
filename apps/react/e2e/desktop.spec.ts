import type { Page } from '@playwright/test';
import { test, expect, enterDesktop, dockItem, appWindow, zIndexOf, desktopPoint } from './fixtures';

test.describe('데스크톱', () => {
	test('로딩 화면을 누르기 전에는 바탕화면을 그리지 않는다 (가려진 화면을 미리 그리지 않는다)', async ({ page }) => {
		await page.goto('/');
		const loading = page.locator('.loading-container');
		await expect(loading).toContainText('클릭하여');
		await expect(page.locator('.dock')).toHaveCount(0);
		await loading.click();
		await expect(page.locator('.dock')).toBeVisible();
		await expect(loading).toBeHidden({ timeout: 20_000 });
	});

	test('미리 받은 첫 화면 CSS를 다시 요청하지 않는다 (preload와 stylesheet의 CORS 모드가 같다)', async ({ page }) => {
		const css: string[] = [];
		page.on('request', (request) => {
			if (new URL(request.url()).pathname.endsWith('.css')) css.push(new URL(request.url()).pathname);
		});
		await page.goto('/');
		const preloaded = await page
			.locator('link[rel="preload"][as="style"]')
			.evaluateAll((links) =>
				links.map((link) => [new URL((link as HTMLLinkElement).href).pathname, link.getAttribute('crossorigin')])
			);
		expect(preloaded.length).toBeGreaterThan(0);
		// Vite가 붙이는 <link rel="stylesheet">는 crossOrigin=''로 요청한다. preload도 같아야 응답을 재사용한다
		for (const [, crossorigin] of preloaded) expect(crossorigin).toBe('');
		await page.locator('.loading-container').click();
		await expect(page.locator('.dock')).toBeVisible();
		for (const [path] of preloaded) {
			await expect.poll(() => css.filter((item) => item === path).length).toBe(1);
		}
	});

	test('스크립트를 받는 동안 첫 그림을 눌러도, 로딩 화면이 뜨자마자 시작한다 (두 번 누르지 않는다)', async ({
		page,
	}) => {
		await page.route('**/assets/main-*.js', async (route) => {
			await new Promise((resolve) => setTimeout(resolve, 1500));
			await route.continue();
		});
		await page.goto('/', { waitUntil: 'commit' });
		const splash = page.locator('#boot-splash');
		await expect(splash).toContainText('클릭하여 로딩을 시작하세요');
		await splash.click();
		// 다시 누르지 않아도 진행 막대가 차고 바탕화면이 뜬다
		await expect(page.locator('.loading-container')).toBeHidden({ timeout: 20_000 });
		await expect(page.locator('.dock')).toBeVisible();
	});

	test('메뉴 막대의 시간이 바뀌어도 옆의 아이콘은 움직이지 않는다', async ({ page }) => {
		// 가장 짧은 시간(1:11 AM)과 가장 긴 시간(12:00 PM). 시계는 1초마다 Date를 다시 읽는다
		await page.clock.setFixedTime(new Date(2026, 9, 3, 1, 11));
		await enterDesktop(page);
		const bar = page.locator('.macos-statusbar');
		const clock = bar.locator('.time-display-now');
		// 시계 바로 옆(배터리 왼쪽)의 Wi-Fi 자리: 서버 상태 버튼
		const wifi = bar.getByRole('button', { name: /^서버 상태/ });
		await expect(clock).toHaveText('1:11 AM');
		const before = (await wifi.boundingBox())!;

		await page.clock.setFixedTime(new Date(2026, 9, 3, 12, 0));
		await expect(clock).toHaveText('12:00 PM');
		const after = (await wifi.boundingBox())!;
		expect(after.x).toBe(before.x);
	});

	test('메뉴 막대의 음량 버튼을 누르면 음량 창이 그 바로 아래 가운데에 열리고, 바깥을 누르거나 Esc로 닫힌다', async ({
		page,
	}) => {
		await enterDesktop(page);
		const button = page.locator('.macos-statusbar').getByRole('button', { name: /^음량 \d+%$/ });
		const buttonBox = (await button.boundingBox())!;
		await button.click();
		await expect(button).toHaveAttribute('aria-expanded', 'true');
		const popup = page.getByRole('dialog', { name: '음량' });
		await expect(popup.getByRole('slider', { name: '음량' })).toBeAttached();
		const box = (await popup.boundingBox())!;
		expect(Math.abs(box.x + box.width / 2 - (buttonBox.x + buttonBox.width / 2))).toBeLessThan(2);
		expect(box.y).toBeGreaterThan(buttonBox.y + buttonBox.height);
		expect(box.y - (buttonBox.y + buttonBox.height)).toBeLessThan(12);

		// 음량을 바꾸면 버튼 이름도 바뀐다
		await popup.getByRole('slider', { name: '음량' }).fill('0.3');
		await expect(page.locator('.macos-statusbar').getByRole('button', { name: '음량 30%' })).toBeVisible();

		// 칸을 누른 높이 그대로: 맨 위 근처는 거의 100%, 아래 근처는 거의 0%, 가운데는 50% (손잡이 자리와 상관없이)
		const volumeName = async () => Number((await button.getAttribute('aria-label'))!.match(/\d+/)![0]);
		await page.mouse.click(box.x + box.width / 2, box.y + 2);
		expect(await volumeName()).toBeGreaterThanOrEqual(95);
		await page.mouse.click(box.x + box.width / 2, box.y + box.height - 2);
		expect(await volumeName()).toBeLessThanOrEqual(5);
		await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
		expect(Math.abs((await volumeName()) - 50)).toBeLessThanOrEqual(3);
		// 끌면 따라간다
		await page.mouse.move(box.x + box.width / 2, box.y + box.height - 4);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 4, { steps: 5 });
		await page.mouse.up();
		expect(Math.abs((await volumeName()) - 75)).toBeLessThanOrEqual(4);

		await page.keyboard.press('Escape');
		await expect(popup).toBeHidden();
		await button.click();
		await page.mouse.click(800, 500);
		await expect(popup).toBeHidden();
	});

	test('Finder는 끌 수 없는 앱이라 Dock의 켜짐 표시가 늘 있다 (창을 열고 닫아도)', async ({ page }) => {
		await enterDesktop(page);
		const finder = dockItem(page, 'finder');
		const dot = finder.locator('.active-indicator');
		await expect(dot).toHaveCount(1);
		await finder.click();
		const window = appWindow(page, 'finder');
		await expect(window).toBeVisible();
		await window.locator('.traffic-lights').getByRole('button', { name: '닫기' }).click();
		await expect(window).toBeHidden();
		await expect(dot).toHaveCount(1);
		// 다른 앱은 닫으면 표시가 사라진다
		const memo = dockItem(page, 'memo');
		await memo.click();
		await appWindow(page, 'memo').locator('.traffic-lights').getByRole('button', { name: '닫기' }).click();
		await expect(memo.locator('.active-indicator')).toHaveCount(0);
	});

	test('메뉴 막대의 이전·재생·다음·음량 버튼은 같은 크기로 한 줄에 나란히 선다', async ({ page }) => {
		await enterDesktop(page);
		const player = page.locator('.macos-statusbar').getByRole('group', { name: '음악' });
		const buttons = player.getByRole('button');
		await expect(buttons).toHaveCount(4);
		await expect(player.getByRole('button', { name: '이전 곡' })).toBeVisible();
		await expect(player.getByRole('button', { name: /^(재생|일시정지)$/ })).toBeVisible();
		await expect(player.getByRole('button', { name: '다음 곡' })).toBeVisible();
		// 아이콘의 위·높이가 모두 같다
		const icons = await player.locator('i').evaluateAll((list) =>
			list.map((icon) => {
				const rect = icon.getBoundingClientRect();
				return `${rect.top.toFixed(1)}/${rect.height.toFixed(1)}`;
			})
		);
		expect(new Set(icons).size).toBe(1);
	});

	test('메뉴 막대 오른쪽 항목(음악·서버 상태·배터리·시계) 사이 간격이 모두 같다', async ({ page }) => {
		await enterDesktop(page);
		const gaps = await page.locator('.macos-statusbar .right-section').evaluate((section) => {
			const items = [...section.children].map((child) => child.getBoundingClientRect());
			return items.slice(1).map((rect, index) => Math.round(rect.left - items[index].right));
		});
		expect(gaps.length).toBeGreaterThanOrEqual(3);
		expect(new Set(gaps).size).toBe(1);
	});

	test('메뉴 막대 글자는 보통 굵기이고, 맨 앞 앱 이름만 굵다', async ({ page }) => {
		await enterDesktop(page);
		const bar = page.locator('.macos-statusbar');
		const weight = (text: string) =>
			bar.getByText(text, { exact: true }).evaluate((el) => getComputedStyle(el).fontWeight);
		// 처음에는 Safari 창이 맨 앞이다
		expect(await weight('Safari')).toBe('700');
		expect(
			await bar.getByRole('button', { name: '파일', exact: true }).evaluate((el) => getComputedStyle(el).fontWeight)
		).toBe('400');
		expect(await bar.locator('.time-display-now').evaluate((el) => getComputedStyle(el).fontWeight)).toBe('400');
	});

	test('메뉴 막대의 앱 이름은 맨 앞 창의 앱이고, 보이는 창이 없으면 Finder', async ({ page }) => {
		await enterDesktop(page);
		const appName = page.locator('.macos-statusbar .app-name');
		// 처음에는 Safari 창이 떠 있다
		await expect(appName).toHaveText('Safari');

		await dockItem(page, 'memo').click();
		await expect(appName).toHaveText('메모');
		// 창이 띄운 메뉴(화면 맨 위에 따로 그려진다)를 눌러도 그 앱으로 남는다
		await appWindow(page, 'memo').getByRole('button', { name: '정렬과 그룹화' }).click();
		await page
			.getByRole('menu', { name: '정렬과 그룹화' })
			.getByRole('menuitemcheckbox', { name: '제목', exact: true })
			.click();
		await expect(appName).toHaveText('메모');

		// 뒤에 있던 앱을 Dock에서 누르면 그 앱이 맨 앞
		await dockItem(page, 'safari').click();
		await expect(appName).toHaveText('Safari');

		// 메뉴 막대(빈 곳, Apple 메뉴와 그 메뉴, 음량)를 눌러도 지금 앱은 그대로다
		await page.locator('.macos-statusbar .time-display').click();
		await expect(appName).toHaveText('Safari');
		await page.getByRole('button', { name: 'Apple 메뉴', exact: true }).click();
		await expect(page.getByRole('menu', { name: 'Apple 메뉴' })).toBeVisible();
		await expect(appName).toHaveText('Safari');
		await page.keyboard.press('Escape');
		await page.locator('.macos-statusbar').getByRole('button', { name: /^음량/ }).click();
		await page.locator('.volume-container').click();
		await expect(appName).toHaveText('Safari');

		// 바탕화면을 누르면 Finder, 창을 다시 누르면 그 앱. 창 순서는 그대로
		const desktop = await desktopPoint(page);
		await page.mouse.click(desktop.x, desktop.y);
		await expect(appName).toHaveText('Finder');
		await appWindow(page, 'safari').click({ position: { x: 200, y: 20 } });
		await expect(appName).toHaveText('Safari');

		// 맨 앞 창을 최소화하면 그다음 창, 모두 닫으면 Finder
		await appWindow(page, 'safari').getByRole('button', { name: '최소화', exact: true }).click();
		await expect(appName).toHaveText('메모');
		await appWindow(page, 'memo').getByRole('button', { name: '닫기', exact: true }).click();
		await expect(appName).toHaveText('Finder');
	});

	test('스크립트를 받는 동안과 로딩 화면을 누르기 전까지 배경화면 대신 검은 화면이 보인다', async ({ page }) => {
		// 앱 스크립트(빌드한 /assets/*.js)를 늦게 받게 해서 로딩 화면이 뜨기 전의 모습을 본다.
		let release = () => {};
		const held = new Promise<void>((resolve) => (release = resolve));
		await page.route(/\/assets\/.*\.js$/, async (route) => {
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
		const loading = page.locator('.loading-container');
		await expect(loading).toBeVisible();
		// 로딩 화면 밖(휴대폰 도구 막대 뒤 등)이 보여도 배경화면이 비치지 않게, 누르기 전까지 검은색을 유지한다
		const isBooting = () => page.evaluate(() => document.documentElement.classList.contains('booting'));
		expect(await isBooting()).toBe(true);
		// 누르면 진행 막대가 차는 동안 배경화면을 수신해, 로딩 화면이 걷힐 때 바로 보인다
		await loading.click();
		await expect.poll(isBooting).toBe(false);
		await expect(loading).toBeHidden({ timeout: 20_000 });
	});

	test('<head>의 인라인 스크립트가 앱 스크립트보다 먼저 저장한 테마를 적용하고, 그동안 누른 것을 적어 둔다', async ({
		page,
	}) => {
		// 첫 화면의 스크립트는 파일이 아니라 HTML 안에 있다 (worker/themeBoot.ts, CSP는 그 해시만 허용)
		await page.addInitScript(() => localStorage.setItem('macfolio:settings', JSON.stringify({ theme: 'dark' })));
		let release = () => {};
		const held = new Promise<void>((resolve) => (release = resolve));
		await page.route(/\/assets\/.*\.js$/, async (route) => {
			await held;
			await route.continue();
		});
		await page.goto('/', { waitUntil: 'commit' });
		await page.waitForFunction(() => document.readyState !== 'loading');
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
		await page.locator('#boot-splash').click();
		expect(await page.evaluate(() => (window as { __macfolioTapped?: boolean }).__macfolioTapped)).toBe(true);
		release();
		// 앱이 뜨면 누른 것을 보고 바로 시작한다 (다시 누르지 않아도 된다)
		await expect(page.locator('.loading-container')).toBeHidden({ timeout: 20_000 });
	});

	test('로딩 화면을 넘기면 Dock과 시작 앱이 보인다', async ({ page }) => {
		await enterDesktop(page);

		// 1600px 창에는 고정한 앱 16개(내장 앱 11개 + 프로젝트 앱 다섯)가 다 들어간다. 그 뒤에 Launchpad와 휴지통
		await expect(page.locator('.dock .dock-item')).toHaveCount(18);
		await expect(dockItem(page, 'sproutfarm')).toBeVisible();
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

		// macOS 알림처럼 마우스를 올리면 닫기 버튼이 보인다
		await notice.hover();
		await notice.getByRole('button', { name: '알림 닫기' }).click();
		await expect(notice).toBeHidden();
	});
});

/** Dock이 화면 안에 있고, 칸(앱·Launchpad·구분선·휴지통)이 서로 겹치지 않는다 */
async function expectDockFits(page: Page) {
	const viewport = page.viewportSize()!;
	const boxes = await page
		.locator('.dock > *')
		.evaluateAll((items) =>
			items.map((item) => item.getBoundingClientRect()).map(({ left, right }) => ({ left, right }))
		);
	expect(boxes[0].left).toBeGreaterThanOrEqual(0);
	expect(boxes.at(-1)!.right).toBeLessThanOrEqual(viewport.width);
	for (let i = 1; i < boxes.length; i++) expect(boxes[i].left).toBeGreaterThanOrEqual(boxes[i - 1].right);
}

test.describe('좁은 화면', () => {
	test.use({ viewport: { width: 900, height: 800 } });

	test('Dock에 다 들어가지 않는 앱은 Launchpad에 모인다', async ({ page }) => {
		await enterDesktop(page);
		// 900px 창에는 앱 8칸 (Launchpad·휴지통 칸은 따로): 고정한 16개 가운데 앞의 8개
		await expect(page.locator('.dock .dock-item')).toHaveCount(10);
		await expectDockFits(page);

		await dockItem(page, 'launchpad').click();
		const launchpad = page.locator('.launchpad-modal');
		// 들어가지 않은 뒤쪽 8개 (share부터, 프로젝트 앱 다섯 개 포함) + Launchpad에만 있는 'API 문서'·'활동 상태 보기'·'날씨'·'미리보기'·'텍스트 편집기'·'팁'·'QuickTime Player'
		await expect(launchpad.locator('.dock-item')).toHaveCount(15);

		// Launchpad의 앱을 열면 Dock 끝에 나타나고, 그 칸만큼 고정 앱 하나가 Launchpad로 간다 (Launchpad 칸과 겹치지 않는다)
		await launchpad.getByRole('button', { name: 'terminal', exact: true }).click();
		await expect(appWindow(page, 'terminal')).toBeVisible();
		await expect(dockItem(page, 'terminal')).toBeVisible();
		await expect(dockItem(page, 'mail')).toHaveCount(0);
		await expect(page.locator('.dock .dock-item')).toHaveCount(10);
		await expectDockFits(page);
	});
});
