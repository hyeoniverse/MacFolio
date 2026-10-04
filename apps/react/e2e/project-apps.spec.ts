import { test, expect, enterDesktop, appWindow, dockItem } from './fixtures';
import type { Page } from '@playwright/test';

/** 실제 사이트 대신 가짜 페이지를 돌려준다 (테스트가 바깥 사이트에 기대지 않게) */
async function fakeSites(page: Page) {
	for (const [host, text] of [
		['https://www.hyeoniverse.com', 'HYEONIVERSE 첫 화면'],
		['https://newpick-tan.vercel.app', 'NewPick 첫 화면'],
		['https://what-to-do-chi.vercel.app', 'WTD 첫 화면'],
		['https://qryou-app.web.app', 'QRU 첫 화면'],
	]) {
		await page.route(`${host}/**`, (route) =>
			route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<h1>${text}</h1>` })
		);
	}
}

test.describe('프로젝트 앱', () => {
	test('Dock에 고정되어 있고, 열면 배포한 사이트를 창 안에 띄운다', async ({ page }) => {
		await fakeSites(page);
		await enterDesktop(page);
		// PROJECTS에서 앱이 된 프로젝트는 Dock에 고정된다
		await expect(dockItem(page, 'newpick')).toBeVisible();

		await dockItem(page, 'newpick').click();
		const app = appWindow(page, 'newpick');
		await expect(app.locator('iframe[title="NewPick 뉴픽"]')).toHaveAttribute('src', 'https://newpick-tan.vercel.app');
		await expect(page.frameLocator('iframe[title="NewPick 뉴픽"]').getByRole('heading')).toHaveText('NewPick 첫 화면');
		// 불러온 뒤에는 불러오는 중 화면이 사라진다
		await expect(app.getByRole('status')).toHaveCount(0);

		// 닫아도 고정된 아이콘은 Dock에 남는다
		await app.getByRole('button', { name: '닫기', exact: true }).click();
		await expect(app).toBeHidden();
		await expect(dockItem(page, 'newpick')).toBeVisible();
	});

	test('Dock에 다 들어가지 않아 Launchpad로 간 앱도 실행 중에는 Dock 끝에 나타난다', async ({ page }) => {
		await enterDesktop(page);
		await fakeSites(page);
		// 1600px 창에는 13개까지: 프로젝트 앱은 시스템 앱 뒤에 있어서 뒤쪽 셋(QRU, WTD, 새싹 농장)이 Launchpad로 간다
		await expect(dockItem(page, 'qru')).toHaveCount(0);
		await dockItem(page, 'launchpad').click();
		await page.locator('.launchpad-modal').getByRole('button', { name: 'qru', exact: true }).click();
		await expect(appWindow(page, 'qru')).toBeVisible();
		await expect(dockItem(page, 'qru')).toBeVisible();
	});

	test('Safari 프로젝트 페이지의 "여기서 열기"로 그 앱을 연다', async ({ page }) => {
		await fakeSites(page);
		await enterDesktop(page);
		const safari = appWindow(page, 'safari');
		// 앱 목록은 PROJECTS에서 만든다: 데모가 있고 app을 둔 프로젝트는 모두 "여기서 열기"가 있다
		for (const [tab, app, title] of [
			[/HYEONIVERSE/, 'hyeoniverse', 'HYEONIVERSE'],
			[/WTD/, 'whattodo', 'WTD (What To Do)'],
			[/QRU/, 'qru', 'QRU 큐알유'],
		] as const) {
			await safari.getByRole('tab', { name: tab }).click();
			await safari.getByRole('button', { name: '여기서 열기' }).first().click();
			await expect(appWindow(page, app).locator(`iframe[title="${title}"]`)).toBeVisible();
			await dockItem(page, 'safari').click();
		}
	});
});
