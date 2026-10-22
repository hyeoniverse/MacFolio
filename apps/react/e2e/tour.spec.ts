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
		for (let guard = 0; guard < 25 && (await card.getByRole('button', { name: '다음' }).count()); guard++)
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
		await expect(tips.getByRole('heading', { level: 1 })).toHaveText(/도움이 필요하세요/);
		await tips.getByRole('button', { name: /화면에서 짚어 보기/ }).click();
		await tips.getByRole('button', { name: '터미널도 진짜예요 보여 주기' }).click();
		const card = page.locator('.tour-card');
		await expect(card.getByRole('heading')).toHaveText('터미널도 진짜예요');
		await expect(tips).toBeHidden();
		await card.getByRole('button', { name: '확인' }).click();
		await expect(card).toHaveCount(0);
	});

	test('팁 앱의 사용법: 블로그 읽는 법을 단계별로 읽고, 메모를 연다', async ({ page }) => {
		await enterDesktop(page);
		await page.locator('.dock').getByRole('button', { name: 'launchpad', exact: true }).click();
		await page.locator('.launchpad-modal').getByRole('button', { name: 'tips', exact: true }).click();
		const tips = appWindow(page, 'tips');
		await tips.getByRole('button', { name: /블로그 읽는 법/ }).click();
		const guide = tips.getByRole('article', { name: '블로그 읽는 법' });
		await expect(guide.getByRole('heading', { level: 2 }).first()).toContainText('폴더에서 주제를 고르세요');
		await expect(guide.getByText('⌘F')).toBeVisible();
		// 홈으로 돌아갔다가 뒤로로 다시 와서, 끝의 '메모 열기'로 메모를 연다
		await tips.getByRole('button', { name: '홈' }).click();
		await expect(tips.getByRole('heading', { level: 1 })).toHaveText(/도움이 필요하세요/);
		await tips.getByRole('button', { name: '뒤로' }).click();
		await guide.getByRole('button', { name: /메모 열기/ }).click();
		await expect(appWindow(page, 'memo')).toBeVisible();
	});

	test('팁 앱: 위쪽 막대의 빈 곳을 끌면 창이 움직이고, 두 번 누르면 커진다. 막대의 단추는 그대로 눌린다', async ({
		page,
	}) => {
		await enterDesktop(page);
		await page.locator('.dock').getByRole('button', { name: 'launchpad', exact: true }).click();
		await page.locator('.launchpad-modal').getByRole('button', { name: 'tips', exact: true }).click();
		const tips = appWindow(page, 'tips');
		await expect(tips.getByRole('heading', { level: 1 })).toBeVisible();
		// 막대 가운데의 빈 곳 (전에는 막대가 제목 표시줄을 덮어 끌리지 않았다)
		const bar = (await tips.locator('.tips-bar').boundingBox())!;
		const before = (await tips.boundingBox())!;
		await page.mouse.move(bar.x + bar.width / 2, bar.y + bar.height / 2);
		await page.mouse.down();
		await page.mouse.move(bar.x + bar.width / 2 + 120, bar.y + bar.height / 2 + 60, { steps: 6 });
		await page.mouse.up();
		await expect.poll(async () => Math.round((await tips.boundingBox())!.x - before.x)).toBe(120);

		const moved = (await tips.locator('.tips-bar').boundingBox())!;
		await page.mouse.dblclick(moved.x + moved.width / 2, moved.y + moved.height / 2);
		await expect.poll(async () => (await tips.boundingBox())!.width).toBeGreaterThan(before.width);

		// 단추는 여전히 막대 위에서 눌린다
		await tips.getByRole('button', { name: /블로그 읽는 법/ }).click();
		await tips.getByRole('button', { name: '홈' }).click();
		await expect(tips.getByRole('heading', { level: 1 })).toHaveText(/도움이 필요하세요/);
	});

	test('팁 앱의 사용 설명서: 모두 보기로 모든 앱의 설명서를 보고, 하나를 연다', async ({ page }) => {
		await enterDesktop(page);
		await page.locator('.dock').getByRole('button', { name: 'launchpad', exact: true }).click();
		await page.locator('.launchpad-modal').getByRole('button', { name: 'tips', exact: true }).click();
		const tips = appWindow(page, 'tips');
		const manuals = tips.getByRole('list', { name: '사용 설명서' });
		await expect(manuals.getByRole('listitem')).toHaveCount(8);
		await tips.getByRole('button', { name: '모두 보기' }).click();
		await expect(tips.getByRole('heading', { level: 1 })).toHaveText('사용 설명서');
		expect(await manuals.getByRole('listitem').count()).toBeGreaterThan(8);
		await manuals.getByRole('button', { name: /날씨/ }).click();
		await expect(tips.getByRole('article', { name: '날씨 사용 설명서' })).toBeVisible();
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
