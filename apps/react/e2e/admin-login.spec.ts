import { test, expect, enterDesktop, appWindow, dockItem } from './fixtures';
import type { Page } from '@playwright/test';
import { FAKE_SIGNED_IN_AT, fakeApi } from './fakeApi';

const appleMenu = (page: Page) => page.getByRole('menu', { name: 'Apple 메뉴', exact: true });

test.describe('관리자 로그인', () => {
	test('Apple 메뉴에서 GitHub로 로그인하고, 설정에서 계정을 보고, 로그아웃한다', async ({ page }) => {
		await fakeApi(page);
		await enterDesktop(page);
		// 켜 둔 앱은 로그인하고 돌아와도 그대로 있다
		await dockItem(page, 'memo').click();
		await expect(appWindow(page, 'memo')).toBeVisible();

		await page.getByRole('button', { name: 'Apple 메뉴', exact: true }).click();
		await appleMenu(page).getByRole('menuitem', { name: '관리자 로그인…' }).click();
		// 떠나기 전에 GitHub로 간다고 알린다
		await expect(page.getByRole('status', { name: 'GitHub로 이동하는 중' })).toBeVisible();

		// GitHub에 다녀오면 로딩 화면 없이 바로 결과 창이 뜬다. 결과는 주소에서 지운다
		const result = page.getByRole('alertdialog', { name: '로그인했습니다' });
		await expect(result).toBeVisible();
		await expect(result).toContainText('hyeoniverse(으)로 로그인했습니다');
		await expect(page.locator('.loading-container')).toHaveCount(0);
		await expect(page).toHaveURL('http://localhost:4173/');
		await result.getByRole('button', { name: '확인' }).click();
		await expect(result).toBeHidden();
		await expect(appWindow(page, 'memo')).toBeVisible();

		await page.getByRole('button', { name: 'Apple 메뉴', exact: true }).click();
		await expect(appleMenu(page)).toContainText('hyeoniverse(으)로 로그인됨');

		// 시스템 설정 → 계정
		await appleMenu(page).getByRole('menuitem', { name: '시스템 설정…' }).click();
		const settings = appWindow(page, 'settings');
		await settings.getByRole('button', { name: '계정' }).click();
		const account = settings.getByRole('region', { name: '관리자 계정' });
		await expect(account).toContainText('hyeoniverse');
		await expect(account).toContainText('GitHub로 로그인됨');
		// 로그인한 때 (서버가 알려 준 세션 시작 시각)
		await expect(account.locator('time')).toHaveAttribute('datetime', FAKE_SIGNED_IN_AT);
		await expect(account).toContainText('2026년 10월 2일');

		await account.getByRole('button', { name: '로그아웃' }).click();
		await expect(account).toContainText('로그인하지 않음');
		await expect(account).not.toContainText('로그인 시각');
		await expect(account.getByRole('button', { name: /GitHub로 로그인/ })).toBeEnabled();
	});

	test('GitHub 사진을 받는 동안에는 자리에 사람 아이콘이 보이고, 받으면 사진으로 바뀐다', async ({ page }) => {
		await fakeApi(page, { signedIn: true });
		// 1×1 PNG를 손으로 내보낼 때까지 붙잡아 둔다 (github.com이 느린 경우)
		let release = () => {};
		const held = new Promise<void>((resolve) => (release = resolve));
		await page.route('https://github.com/*.png*', async (route) => {
			await held;
			await route.fulfill({
				contentType: 'image/png',
				body: Buffer.from(
					'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
					'base64'
				),
			});
		});
		await enterDesktop(page);
		await dockItem(page, 'settings').click();
		const avatar = appWindow(page, 'settings').locator('.admin-account-avatar');
		await expect(avatar.locator('.fa-user')).toBeVisible();
		await expect(avatar).toHaveCSS('width', '56px');
		await expect(avatar.locator('img')).toHaveCSS('opacity', '0');

		release();
		await expect(avatar).toHaveAttribute('data-loaded', 'true');
		await expect(avatar.locator('img')).toHaveCSS('opacity', '1');
	});

	test('관리자가 아닌 계정이면 로그인할 수 없다고 알린다', async ({ page }) => {
		await fakeApi(page, { admin: false });
		await enterDesktop(page);
		await page.getByRole('button', { name: 'Apple 메뉴', exact: true }).click();
		await appleMenu(page).getByRole('menuitem', { name: '관리자 로그인…' }).click();

		const result = page.getByRole('alertdialog', { name: '로그인할 수 없습니다' });
		await expect(result).toBeVisible();
		await expect(result).toContainText('관리자 GitHub 계정만');
		// Esc로도 닫힌다
		await page.keyboard.press('Escape');
		await expect(result).toBeHidden();
		await page.getByRole('button', { name: 'Apple 메뉴', exact: true }).click();
		await expect(appleMenu(page).getByRole('menuitem', { name: '관리자 로그인…' })).toBeEnabled();
	});

	test('관리자 서버가 없으면 로그인 단추가 꺼져 있다', async ({ page }) => {
		await enterDesktop(page);
		await page.getByRole('button', { name: 'Apple 메뉴', exact: true }).click();
		await expect(appleMenu(page).getByRole('menuitem', { name: '관리자 로그인…' })).toBeDisabled();
		// 바깥을 누르면 닫힌다
		await page.mouse.click(800, 500);
		await expect(appleMenu(page)).toBeHidden();

		await page.getByRole('button', { name: 'Apple 메뉴', exact: true }).click();
		await appleMenu(page).getByRole('menuitem', { name: '시스템 설정…' }).click();
		const settings = appWindow(page, 'settings');
		await settings.getByRole('button', { name: '계정' }).click();
		const account = settings.getByRole('region', { name: '관리자 계정' });
		await expect(account).toContainText('관리자 서버가 아직 연결되지 않았습니다');
		await expect(account.getByRole('button', { name: /GitHub로 로그인/ })).toBeDisabled();
	});
});
