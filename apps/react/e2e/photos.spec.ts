import { test, expect, enterDesktop, appWindow, dockItem } from './fixtures';

test.describe('사진 (#21)', () => {
	test('프로젝트마다 앨범, 격자, 크게 보기(←·→로 넘기고 끝에서 처음으로, Esc로 닫기)', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'photos').click();
		const photos = appWindow(page, 'photos');
		const sidebar = photos.getByRole('complementary', { name: '사진 보관함' });

		// 모든 사진 = 앨범 사진의 합
		const counts = await sidebar.locator('.photos-place .photos-count').allTextContents();
		const [all, ...albums] = counts.map(Number);
		expect(albums.length).toBeGreaterThan(3);
		expect(all).toBe(albums.reduce((sum, count) => sum + count, 0));
		await expect(photos.getByRole('heading', { name: '모든 사진' })).toBeVisible();

		await sidebar.getByRole('button', { name: /^QRU/ }).click();
		await expect(photos.getByRole('heading', { name: 'QRU 큐알유' })).toBeVisible();
		const thumbs = photos.locator('.photos-thumb');
		const total = await thumbs.count();
		expect(total).toBeGreaterThan(2);

		await thumbs.nth(1).click();
		const viewer = photos.getByRole('dialog');
		await expect(viewer).toHaveAttribute('aria-label', new RegExp(`^사진 2/${total}:`));
		await page.keyboard.press('ArrowRight');
		await expect(viewer).toHaveAttribute('aria-label', new RegExp(`^사진 3/${total}:`));
		await page.keyboard.press('ArrowLeft');
		await page.keyboard.press('ArrowLeft');
		await expect(viewer).toHaveAttribute('aria-label', new RegExp(`^사진 1/${total}:`));
		await page.keyboard.press('ArrowLeft');
		await expect(viewer).toHaveAttribute('aria-label', new RegExp(`^사진 ${total}/${total}:`));
		await viewer.getByRole('button', { name: '다음 사진' }).click();
		await expect(viewer).toHaveAttribute('aria-label', new RegExp(`^사진 1/${total}:`));
		await page.keyboard.press('Escape');
		await expect(viewer).toHaveCount(0);
	});

	test('크게 보기에서 그 프로젝트의 Safari 페이지로 간다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'photos').click();
		const photos = appWindow(page, 'photos');
		await photos.getByRole('complementary', { name: '사진 보관함' }).getByRole('button', { name: /^QRU/ }).click();
		await photos.locator('.photos-thumb').first().click();
		await photos
			.getByRole('dialog')
			.getByRole('button', { name: /QRU 큐알유 페이지/ })
			.click();
		await expect(appWindow(page, 'safari')).toBeVisible();
		await expect.poll(() => new URL(page.url()).pathname).toBe('/safari/qru');
	});

	test('메뉴 막대의 보기에서 앨범을 고른다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'photos').click();
		const photos = appWindow(page, 'photos');
		await page.getByRole('group', { name: '메뉴 막대' }).getByRole('button', { name: '보기', exact: true }).click();
		await page
			.getByRole('menu', { name: '보기', exact: true })
			.getByRole('menuitemcheckbox', { name: /SproutFarm/ })
			.click();
		await expect(photos.getByRole('heading', { name: /SproutFarm/ })).toBeVisible();
	});
});

test.describe('사진: 휴대폰', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('사이드바 대신 위의 앨범 단추로 고른다', async ({ page }) => {
		await enterDesktop(page);
		await page.locator('[data-launch="photos"]').click();
		const chips = page.getByRole('navigation', { name: '앨범 고르기' });
		await expect(chips).toBeVisible();
		await expect(page.getByRole('complementary', { name: '사진 보관함' })).toBeHidden();
		await chips.getByRole('button', { name: /^QRU/ }).click();
		await expect(chips.getByRole('button', { name: /^QRU/ })).toHaveAttribute('aria-pressed', 'true');
		await expect(page.getByRole('heading', { name: 'QRU 큐알유' })).toBeVisible();
	});
});
