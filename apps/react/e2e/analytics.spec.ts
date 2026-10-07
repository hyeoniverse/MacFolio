import { test, expect, enterDesktop, appWindow, dockItem } from './fixtures';
import type { Page } from '@playwright/test';
import { fakeApi } from './fakeApi';

/** 탭을 숨긴 것처럼: 사이트가 머문 시간을 남기고 모은 것을 바로 보낸다 */
const hideTab = (page: Page) =>
	page.evaluate(() => {
		Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
		document.dispatchEvent(new Event('visibilitychange'));
	});

/** 로컬 주소에서도 수집을 켠다 (기본은 로컬에서 보내지 않는다) */
const enableAnalytics = (page: Page) =>
	page.addInitScript(() => {
		window.__MACFOLIO_ANALYTICS__ = true;
	});

test.describe('트래픽 분석 수집 (#102)', () => {
	test('페이지 열기(들어온 곳·utm·기기), 앱 열기, 글 보기, 바깥 링크, 머문 시간을 한 방문으로 묶어 보낸다', async ({
		page,
		context,
	}) => {
		const api = await fakeApi(page);
		await enableAnalytics(page);
		await context.route('https://github.com/**', (route) => route.fulfill({ status: 200, body: 'github' }));
		await enterDesktop(page, '/?utm_source=resume&utm_campaign=kakao-2026');

		await dockItem(page, 'memo').click();
		const memo = appWindow(page, 'memo');
		await memo.locator('.memo-item', { hasText: 'CRA에서 Vite로 옮기기' }).click();
		await expect(memo.getByRole('article').getByRole('heading', { level: 1 })).toHaveText('CRA에서 Vite로 옮기기');

		const popup = page.waitForEvent('popup');
		await page.getByRole('button', { name: 'Apple 메뉴', exact: true }).click();
		await page
			.getByRole('menu', { name: 'Apple 메뉴', exact: true })
			.getByRole('menuitem', { name: 'GitHub 저장소' })
			.click();
		await (await popup).close();

		await hideTab(page);
		await expect.poll(() => api.analytics.flatMap((batch) => batch.events).length).toBeGreaterThanOrEqual(5);

		// 한 페이지의 이벤트는 같은 visitId
		const visitIds = new Set(api.analytics.map((batch) => batch.visitId));
		expect(visitIds.size).toBe(1);
		expect([...visitIds][0]).toMatch(/^v-[\w-]{8,}$/);
		const events = api.analytics.flatMap((batch) => batch.events);
		expect(events[0]).toMatchObject({
			type: 'visit',
			path: '/',
			utmSource: 'resume',
			utmCampaign: 'kakao-2026',
			device: 'desktop',
		});
		// 처음부터 떠 있던 Safari 창은 연 것으로 치지 않는다
		expect(events.filter((event) => event.type === 'app')).toEqual([{ type: 'app', app: 'memo' }]);
		expect(events).toContainEqual({ type: 'item', app: 'memo', item: 'cra-to-vite' });
		expect(events).toContainEqual({ type: 'link', item: 'github.com/hyeoniverse/MacFolio' });
		expect(events.at(-1)).toMatchObject({ type: 'leave', duration: expect.any(Number) });
		// 쿠키·IP·User-Agent 같은 값은 보내지 않는다 (서버가 붙인다)
		expect(JSON.stringify(api.analytics)).not.toMatch(/cookie|userAgent|ip"/i);
	});

	test('로컬 주소(개발·화면 테스트)와 Global Privacy Control에서는 보내지 않는다', async ({ page }) => {
		const api = await fakeApi(page);
		await enterDesktop(page);
		await dockItem(page, 'memo').click();
		await hideTab(page);

		const gpc = await page.context().newPage();
		await fakeApi(gpc).then((other) => (other.analytics = api.analytics));
		await gpc.addInitScript(() => {
			window.__MACFOLIO_ANALYTICS__ = true;
			Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true });
		});
		await enterDesktop(gpc);
		await dockItem(gpc, 'memo').click();
		await hideTab(gpc);

		await page.waitForTimeout(500);
		expect(api.analytics).toEqual([]);
	});

	test("Apple 메뉴에 오늘 방문자 수와 '개인정보 처리 방침'(Finder에서 연다)", async ({ page }) => {
		const api = await fakeApi(page);
		api.todayVisitors = 1234;
		await enterDesktop(page);
		await page.getByRole('button', { name: 'Apple 메뉴', exact: true }).click();
		const menu = page.getByRole('menu', { name: 'Apple 메뉴', exact: true });
		await expect(menu).toContainText('오늘 방문자 1,234명');

		await menu.getByRole('menuitem', { name: '개인정보 처리 방침' }).click();
		const finder = appWindow(page, 'finder');
		await expect(finder.getByRole('article', { name: 'privacy.md' }).getByRole('heading', { level: 1 })).toHaveText(
			'개인정보: 무엇을 모으고 얼마나 두나'
		);
	});
});
