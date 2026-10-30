import { test as base, expect, type Page } from '@playwright/test';

/** 페이지에서 처리되지 않은 에러가 나면 테스트를 실패시킨다. */
export const test = base.extend<{ pageErrors: Error[]; noApi: void; cspViolations: string[] }>({
	// 관리자 API가 없는 상태로 시작한다 (로컬 .env.local의 VITE_API_URL과 상관없이). 가짜 API는 테스트에서 따로 넣는다.
	// 메시지는 브라우저 저장소를 쓴다 (VITE_MESSAGES_STORE=local). 서버 저장은 fakeApi나 storeMessagesOnServer로 켠다
	noApi: [
		async ({ page }, use) => {
			await page.addInitScript(() => {
				window.__MACFOLIO_API_URL__ = '';
				window.__MACFOLIO_MESSAGES_STORE__ = 'local';
				// 처음 방문 둘러보기는 본 것으로 둔다 (화면을 덮지 않게). 둘러보기 테스트는 firstVisit()으로 지운다.
				// 이 스크립트는 모든 프레임에서 돈다: 저장소를 쓸 수 없는 sandbox iframe(Safari의 첨부 HTML 탭)에서는 건너뛴다
				if (window === window.top) localStorage.setItem('macfolio:tour', 'done');
			});
			// 기술 칸의 npm 검색은 바깥으로 나가지 않게 빈 결과 (시험에서 결과가 필요하면 다시 route한다)
			await page.route('https://registry.npmjs.org/**', (route) => route.fulfill({ json: { objects: [] } }));
			// 바탕화면·홈 화면의 날씨 위젯도 바깥으로 나가지 않게 (날씨가 필요한 시험은 fakeWeather로 덮는다: 나중에 건 route가 먼저다)
			await page.route('https://api.open-meteo.com/**', (route) => route.fulfill({ status: 503, body: '' }));
			await use();
		},
		{ auto: true },
	],
	// 미리보기는 배포와 같은 CSP를 붙인다 (vite.config.ts). 막힌 요청·스크립트가 있으면 테스트를 실패시킨다
	cspViolations: [
		async ({ page }, use) => {
			const violations: string[] = [];
			page.on('console', (message) => {
				if (message.type() === 'error' && message.text().includes('Content Security Policy')) {
					violations.push(message.text());
				}
			});
			await use(violations);
			expect(violations, 'CSP에 막힌 요청이 있습니다').toEqual([]);
		},
		{ auto: true },
	],
	pageErrors: [
		async ({ page }, use) => {
			const errors: Error[] = [];
			page.on('pageerror', (error) => errors.push(error));
			await use(errors);
			expect(errors, '페이지에서 처리되지 않은 에러가 발생했습니다').toEqual([]);
		},
		{ auto: true },
	],
});

export { expect };

/** 메시지를 서버에 저장하게 한다 (배포 기본값). 서버 주소가 없으면 메시지 앱이 열리지 않는다 */
export async function storeMessagesOnServer(page: Page) {
	await page.addInitScript(() => {
		window.__MACFOLIO_MESSAGES_STORE__ = 'server';
	});
}

/** 처음 온 사람으로 시작한다 (둘러보기가 뜬다) */
export async function firstVisit(page: Page) {
	await page.addInitScript(() => window === window.top && localStorage.removeItem('macfolio:tour'));
}

/** 로딩 화면을 클릭해 넘기고 데스크톱에 들어간다. path로 앱 항목 주소(/memo/<글> 등)를 열 수 있다 */
export async function enterDesktop(page: Page, path = '/') {
	await page.goto(path);
	const loading = page.locator('.loading-container');
	await loading.click();
	// 로딩은 약 3초(진행 막대 + 걷히기). 전체 테스트를 병렬로 돌려 CPU가 바쁘면 더 걸리므로 넉넉히 기다린다
	await expect(loading).toBeHidden({ timeout: 20_000 });
}

export const dockItem = (page: Page, name: string) => page.locator('.dock').getByRole('button', { name, exact: true });

/** Dock에서 앱을 연다. 화면 폭에 다 들어가지 않아 Launchpad로 간 앱이면 Launchpad에서 */
export async function openFromDock(page: Page, name: string) {
	if (await dockItem(page, name).count()) return dockItem(page, name).click();
	await dockItem(page, 'launchpad').click();
	await page.locator('.launchpad-modal').getByRole('button', { name, exact: true }).click();
}

/** 창·Dock·메뉴 막대가 없는 바탕화면의 한 점 (누르면 Finder가 된다) */
export async function desktopPoint(page: Page) {
	const point = await page.evaluate(() => {
		for (let x = window.innerWidth - 20; x > 0; x -= 40)
			for (let y = 60; y < window.innerHeight - 160; y += 40) {
				const hit = document.elementFromPoint(x, y);
				if (hit && !hit.closest('[data-app], .dock, .macos-statusbar')) return { x, y };
			}
		return null;
	});
	expect(point).not.toBeNull();
	return point!;
}

export const appWindow = (page: Page, name: string) => page.locator(`[data-app="${name}"]`);

export async function zIndexOf(page: Page, name: string) {
	return appWindow(page, name).evaluate((el) => Number(getComputedStyle(el).zIndex));
}
