import { test, expect, enterDesktop, firstVisit, appWindow } from './fixtures';

test.describe('처음 방문 둘러보기 (팁)', () => {
	test('처음 오면 환영 카드가 뜨고, 단계마다 한 곳을 비추며, 비춘 곳을 누르면 다음으로 넘어간다', async ({ page }) => {
		await firstVisit(page);
		await enterDesktop(page);
		const card = page.locator('.tour-card');
		await expect(card.getByRole('heading')).toHaveText('MacFolio에 오신 걸 환영해요');
		await card.getByRole('button', { name: '둘러보기 시작' }).click();

		// 1단계: 바탕화면의 이력서 폴더를 비춘다
		await expect(card.getByRole('heading')).toHaveText('이력서부터 보세요');
		await expect(card.getByLabel(/단계 중 1단계/)).toBeVisible();
		const spot = (await page.locator('.tour-spotlight').boundingBox())!;
		const icon = (await page.locator('.desktop-icon[aria-label="이력서"]').boundingBox())!;
		expect(spot.x).toBeLessThanOrEqual(icon.x);
		expect(spot.x + spot.width).toBeGreaterThanOrEqual(icon.x + icon.width);

		// 덮개는 화면을 막지 않는다: 비춘 곳을 누르면 그 동작을 하고 다음 단계로
		await page.locator('.desktop-icon[aria-label="이력서"]').dblclick();
		await expect(appWindow(page, 'finder')).toBeVisible();
		await expect(card.getByRole('heading')).not.toHaveText('이력서부터 보세요');

		// 다음 버튼으로 끝까지
		for (let guard = 0; guard < 10 && (await card.getByRole('button', { name: '다음' }).count()); guard++)
			await card.getByRole('button', { name: '다음' }).click();
		await expect(card.getByRole('heading')).toHaveText('이제 마음껏 둘러보세요');
		await card.getByRole('button', { name: '시작하기' }).click();
		await expect(card).toHaveCount(0);

		// 한 번 본 뒤에는 다시 띄우지 않게 이 브라우저에 남긴다 (휴지통의 '내 브라우저 데이터'에도 보인다)
		expect(await page.evaluate(() => localStorage.getItem('macfolio:tour'))).toBe('done');
	});

	test('다음에 할게요로 닫고, 도움말 › MacFolio 둘러보기로 다시 연다', async ({ page }) => {
		await firstVisit(page);
		await enterDesktop(page);
		await page.locator('.tour-card').getByRole('button', { name: '다음에 할게요' }).click();
		await expect(page.locator('.tour-card')).toHaveCount(0);
		await page.getByRole('group', { name: '메뉴 막대' }).getByRole('button', { name: '도움말' }).click();
		await page.getByRole('menuitem', { name: 'MacFolio 둘러보기' }).click();
		await expect(page.locator('.tour-card').getByRole('heading')).toHaveText('MacFolio에 오신 걸 환영해요');
		await page.keyboard.press('Escape');
		await expect(page.locator('.tour-card')).toHaveCount(0);
	});

	test('팁 앱: 팁 하나를 보여 주기로 화면에서 짚고, 처음부터 둘러보기를 연다', async ({ page }) => {
		await enterDesktop(page);
		await page.locator('.dock').getByRole('button', { name: 'launchpad', exact: true }).click();
		await page.locator('.launchpad-modal').getByRole('button', { name: 'tips', exact: true }).click();
		const tips = appWindow(page, 'tips');
		await expect(tips.getByRole('heading', { level: 1 })).toHaveText('MacFolio 둘러보기');
		await tips.getByRole('button', { name: '터미널도 진짜예요 보여 주기' }).click();
		const card = page.locator('.tour-card');
		await expect(card.getByRole('heading')).toHaveText('터미널도 진짜예요');
		await expect(tips).toBeHidden();
		await card.getByRole('button', { name: '확인' }).click();
		await expect(card).toHaveCount(0);
	});
});

test.describe('처음 방문 둘러보기: 휴대폰', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

	test('홈 화면의 앱 아이콘을 비춘다', async ({ page }) => {
		await firstVisit(page);
		await enterDesktop(page);
		const card = page.locator('.tour-card');
		await card.getByRole('button', { name: '둘러보기 시작' }).click();
		await expect(card.getByRole('heading')).toHaveText('이력서는 파일 앱에');
		await expect(page.locator('.tour-spotlight')).toBeVisible();
	});
});
