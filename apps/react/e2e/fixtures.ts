import { test as base, expect, type Page } from '@playwright/test';

/** 페이지에서 처리되지 않은 에러가 나면 테스트를 실패시킨다. */
export const test = base.extend<{ pageErrors: Error[]; noApi: void }>({
	// 관리자 API가 없는 상태로 시작한다 (로컬 .env.local의 VITE_API_URL과 상관없이). 가짜 API는 테스트에서 따로 넣는다.
	// 메시지는 브라우저 저장소를 쓴다 (VITE_MESSAGES_STORE=local). 서버 저장은 fakeApi나 storeMessagesOnServer로 켠다
	noApi: [
		async ({ page }, use) => {
			await page.addInitScript(() => {
				window.__MACFOLIO_API_URL__ = '';
				window.__MACFOLIO_MESSAGES_STORE__ = 'local';
			});
			await use();
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

export const appWindow = (page: Page, name: string) => page.locator(`[data-app="${name}"]`);

export async function zIndexOf(page: Page, name: string) {
	return appWindow(page, name).evaluate((el) => Number(getComputedStyle(el).zIndex));
}
