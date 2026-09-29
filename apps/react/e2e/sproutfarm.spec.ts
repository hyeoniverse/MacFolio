import { test, expect, enterDesktop, appWindow, dockItem } from './fixtures';

test.describe('새싹 농장', () => {
	test('Dock에서 열면 배포한 게임을 창 안에 띄운다', async ({ page }) => {
		// 실제 게임 대신 가짜 페이지를 돌려준다 (테스트가 바깥 사이트에 기대지 않게)
		await page.route('https://sprout-farm-beta.vercel.app/**', (route) =>
			route.fulfill({ contentType: 'text/html', body: '<button>START</button>' })
		);
		await enterDesktop(page);
		await dockItem(page, 'sproutfarm').click();

		const game = appWindow(page, 'sproutfarm');
		await expect(game).toBeVisible();
		const frame = game.locator('iframe[title="SproutFarm 새싹 농장"]');
		await expect(frame).toHaveAttribute('src', 'https://sprout-farm-beta.vercel.app');
		await expect(
			page.frameLocator('iframe[title="SproutFarm 새싹 농장"]').getByRole('button', { name: 'START' })
		).toBeVisible();
	});

	test('Safari 프로젝트 페이지에서 바로 플레이한다', async ({ page }) => {
		await page.route('https://sprout-farm-beta.vercel.app/**', (route) =>
			route.fulfill({ contentType: 'text/html', body: '<button>START</button>' })
		);
		await enterDesktop(page);
		const safari = appWindow(page, 'safari');
		await safari.getByRole('tab', { name: /SproutFarm/ }).click();
		await safari.getByRole('button', { name: '여기서 플레이' }).first().click();
		await expect(appWindow(page, 'sproutfarm')).toBeVisible();
	});
});
