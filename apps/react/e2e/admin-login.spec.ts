import { test, expect, enterDesktop, appWindow } from './fixtures';
import type { Page } from '@playwright/test';

const API = 'http://api.test';

/**
 * 가짜 API. 실제 서버처럼 /auth/github는 로그인을 마친 뒤 사이트로 돌려보내고(?admin=signed-in),
 * 그 뒤로 /auth/me는 관리자를 알려 준다. 쿠키 대신 테스트 안의 변수로 로그인 상태를 기억한다.
 */
async function fakeApi(page: Page) {
	const state = { signedIn: false };
	const cors = (origin: string) => ({
		'Access-Control-Allow-Origin': origin,
		'Access-Control-Allow-Credentials': 'true',
	});
	await page.addInitScript((url) => {
		window.__MACFOLIO_API_URL__ = url;
	}, API);
	await page.route('https://github.com/*.png*', (route) => route.fulfill({ status: 404 }));
	await page.route(`${API}/auth/**`, async (route) => {
		const request = route.request();
		const origin = (await request.headerValue('origin')) ?? 'http://localhost:4173';
		const path = new URL(request.url()).pathname;
		if (path === '/auth/me') {
			return route.fulfill(
				state.signedIn
					? { status: 200, headers: cors(origin), json: { login: 'hyeoniverse' } }
					: { status: 401, headers: cors(origin), json: { statusCode: 401 } }
			);
		}
		if (path === '/auth/github') {
			state.signedIn = true;
			return route.fulfill({ status: 302, headers: { Location: 'http://localhost:4173/?admin=signed-in' } });
		}
		if (path === '/auth/logout') {
			state.signedIn = false;
			return route.fulfill({ status: 204, headers: cors(origin) });
		}
		return route.fulfill({ status: 404 });
	});
	return state;
}

/** 로딩 화면을 넘긴다 (GitHub에서 돌아오면 사이트를 새로 불러오므로 다시 나온다) */
async function passLoading(page: Page) {
	const loading = page.locator('.loading-container');
	await loading.click();
	await expect(loading).toBeHidden({ timeout: 20_000 });
}

const appleMenu = (page: Page) => page.getByRole('menu', { name: 'Apple 메뉴' });

test.describe('관리자 로그인', () => {
	test('Apple 메뉴에서 GitHub로 로그인하고, 설정에서 계정을 보고, 로그아웃한다', async ({ page }) => {
		await fakeApi(page);
		await enterDesktop(page);

		await page.getByRole('button', { name: 'Apple 메뉴' }).click();
		await appleMenu(page).getByRole('menuitem', { name: '관리자 로그인…' }).click();

		// GitHub에 다녀와 사이트로 돌아온다. 결과는 알림으로 알리고 주소에서는 지운다
		await page.waitForURL(/admin=signed-in/);
		await passLoading(page);
		await expect(page.getByRole('status').filter({ hasText: '관리자로 로그인함' })).toBeVisible();
		await expect(page).toHaveURL('http://localhost:4173/');

		await page.getByRole('button', { name: 'Apple 메뉴' }).click();
		await expect(appleMenu(page)).toContainText('hyeoniverse(으)로 로그인됨');

		// 시스템 설정 → 계정
		await appleMenu(page).getByRole('menuitem', { name: '시스템 설정…' }).click();
		const settings = appWindow(page, 'settings');
		await settings.getByRole('button', { name: '계정' }).click();
		const account = settings.getByRole('region', { name: '관리자 계정' });
		await expect(account).toContainText('hyeoniverse');
		await expect(account).toContainText('GitHub로 로그인됨');

		await account.getByRole('button', { name: '로그아웃' }).click();
		await expect(account).toContainText('로그인하지 않음');
		await expect(account.getByRole('button', { name: /GitHub로 로그인/ })).toBeEnabled();
	});

	test('관리자 서버가 없으면 로그인 단추가 꺼져 있다', async ({ page }) => {
		await enterDesktop(page);
		await page.getByRole('button', { name: 'Apple 메뉴' }).click();
		await expect(appleMenu(page).getByRole('menuitem', { name: '관리자 로그인…' })).toBeDisabled();
		// 바깥을 누르면 닫힌다
		await page.mouse.click(800, 500);
		await expect(appleMenu(page)).toBeHidden();

		await page.getByRole('button', { name: 'Apple 메뉴' }).click();
		await appleMenu(page).getByRole('menuitem', { name: '시스템 설정…' }).click();
		const settings = appWindow(page, 'settings');
		await settings.getByRole('button', { name: '계정' }).click();
		const account = settings.getByRole('region', { name: '관리자 계정' });
		await expect(account).toContainText('관리자 서버가 아직 연결되지 않았습니다');
		await expect(account.getByRole('button', { name: /GitHub로 로그인/ })).toBeDisabled();
	});
});
