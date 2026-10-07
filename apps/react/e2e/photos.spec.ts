import { test, expect, enterDesktop, appWindow, dockItem } from './fixtures';
import type { Page } from '@playwright/test';

const openPhotos = async (page: Page) => {
	await enterDesktop(page);
	await dockItem(page, 'photos').click();
	return appWindow(page, 'photos');
};

test.describe('사진 (#21)', () => {
	test('보관함 = 앨범 사진의 합, 비디오는 영상만, 앨범을 고른다', async ({ page }) => {
		const photos = await openPhotos(page);
		const sidebar = photos.getByRole('complementary', { name: '사진 보관함' });
		const counts = (await sidebar.locator('.photos-place .photos-count').allTextContents()).map(Number);
		const [all, videos, ...albums] = counts;
		expect(albums.length).toBeGreaterThan(3);
		expect(all).toBe(albums.reduce((sum, count) => sum + count, 0));
		await expect(photos.getByRole('heading', { name: '보관함' })).toBeVisible();

		await sidebar.getByRole('button', { name: /^비디오/ }).click();
		await expect(photos.locator('.photos-thumb')).toHaveCount(videos);
		await expect(photos.locator('.photos-thumb video')).toHaveCount(videos);

		await sidebar.getByRole('button', { name: /^QRU/ }).click();
		await expect(photos.getByRole('heading', { name: 'QRU 큐알유' })).toBeVisible();
		await expect(sidebar.getByRole('button', { name: /^QRU/ })).toHaveAttribute('aria-current', 'true');
	});

	test('보관함을 앨범별로 나눠 보고, 앨범 이름을 누르면 그 앨범으로. −·+로 칸 크기를 바꾼다', async ({ page }) => {
		const photos = await openPhotos(page);
		const cell = photos.locator('.photos-thumb').first();
		const before = (await cell.boundingBox())!.width;
		await photos.getByRole('button', { name: '확대' }).click();
		await expect.poll(async () => (await cell.boundingBox())!.width).toBeGreaterThan(before);

		await photos.getByRole('button', { name: '앨범별' }).click();
		await expect(photos.getByRole('button', { name: '앨범별' })).toHaveAttribute('aria-pressed', 'true');
		const group = photos.getByRole('region', { name: 'SproutFarm 새싹 농장' });
		await expect(group.locator('.photos-thumb')).not.toHaveCount(0);
		await group.getByRole('heading').getByRole('button').click();
		await expect(photos.getByRole('heading', { name: 'SproutFarm 새싹 농장' })).toBeVisible();
	});

	test('크게 보기: ←·→로 넘기고 끝에서 처음으로, 정보, 확대, Esc로 닫기', async ({ page }) => {
		const photos = await openPhotos(page);
		await photos.getByRole('complementary', { name: '사진 보관함' }).getByRole('button', { name: /^QRU/ }).click();
		const thumbs = photos.locator('.photos-thumb');
		const total = await thumbs.count();
		expect(total).toBeGreaterThan(2);

		await thumbs.nth(1).click();
		const viewer = photos.getByRole('dialog');
		await expect(viewer).toHaveAttribute('aria-label', new RegExp(`^사진 2/${total}:`));
		await expect(viewer.locator('.photos-toolbar-title')).toContainText(`2/${total}`);
		await page.keyboard.press('ArrowRight');
		await expect(viewer).toHaveAttribute('aria-label', new RegExp(`^사진 3/${total}:`));
		await page.keyboard.press('ArrowLeft');
		await page.keyboard.press('ArrowLeft');
		await expect(viewer).toHaveAttribute('aria-label', new RegExp(`^사진 1/${total}:`));
		await page.keyboard.press('ArrowLeft');
		await expect(viewer).toHaveAttribute('aria-label', new RegExp(`^사진 ${total}/${total}:`));
		await viewer.getByRole('button', { name: '다음 사진' }).click();
		await expect(viewer).toHaveAttribute('aria-label', new RegExp(`^사진 1/${total}:`));

		await viewer.getByRole('button', { name: '정보' }).click();
		await expect(viewer.getByRole('complementary', { name: '사진 정보' })).toContainText('QRU 큐알유');

		const image = viewer.locator('.photos-viewer-stage img');
		const fitted = (await image.boundingBox())!.width;
		await viewer.getByRole('button', { name: '확대하기' }).click();
		await viewer.getByRole('button', { name: '확대하기' }).click();
		await expect.poll(async () => (await image.boundingBox())!.width).toBeGreaterThan(fitted);

		await page.keyboard.press('Escape');
		await expect(viewer).toHaveCount(0);
	});

	test('크게 보기에서 그 프로젝트의 Safari 페이지로 간다', async ({ page }) => {
		const photos = await openPhotos(page);
		await photos.getByRole('complementary', { name: '사진 보관함' }).getByRole('button', { name: /^QRU/ }).click();
		await photos.locator('.photos-thumb').first().click();
		await photos.getByRole('dialog').getByRole('button', { name: 'QRU 큐알유 페이지' }).click();
		await expect(appWindow(page, 'safari')).toBeVisible();
		await expect.poll(() => new URL(page.url()).pathname).toBe('/safari/qru');
	});

	test('메뉴 막대의 보기에서 앨범을 고른다', async ({ page }) => {
		const photos = await openPhotos(page);
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
