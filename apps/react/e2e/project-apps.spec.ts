import { test, expect, enterDesktop, appWindow, dockItem } from './fixtures';
import type { Page } from '@playwright/test';

/** 실제 사이트 대신 가짜 페이지를 돌려준다 (테스트가 바깥 사이트에 기대지 않게) */
async function fakeSites(page: Page) {
	for (const [host, text] of [
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
	test('Launchpad에서 열면 배포한 사이트를 창 안에 띄우고, 실행 중에는 Dock에 나타난다', async ({ page }) => {
		await fakeSites(page);
		await enterDesktop(page);
		// Dock에는 고정하지 않는다
		await expect(dockItem(page, 'newpick')).toHaveCount(0);

		await dockItem(page, 'launchpad').click();
		await page.locator('.launchpad-modal').getByRole('button', { name: 'newpick', exact: true }).click();
		const app = appWindow(page, 'newpick');
		await expect(app.locator('iframe[title="NewPick 뉴픽"]')).toHaveAttribute('src', 'https://newpick-tan.vercel.app');
		await expect(page.frameLocator('iframe[title="NewPick 뉴픽"]').getByRole('heading')).toHaveText('NewPick 첫 화면');
		// 불러온 뒤에는 불러오는 중 화면이 사라진다
		await expect(app.getByRole('status')).toHaveCount(0);

		// 실행 중이면 Dock에 나타나고, 닫으면 사라진다
		await expect(dockItem(page, 'newpick')).toBeVisible();
		await app.getByRole('button', { name: '닫기', exact: true }).click();
		await expect(dockItem(page, 'newpick')).toHaveCount(0);
	});

	test('Safari 프로젝트 페이지의 "여기서 열기"로 그 앱을 연다', async ({ page }) => {
		await fakeSites(page);
		await enterDesktop(page);
		const safari = appWindow(page, 'safari');
		for (const [tab, app, title] of [
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
