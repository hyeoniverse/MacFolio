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

test.describe('사진: 휴대폰 (iOS 사진)', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	const openPhone = async (page: Page) => {
		await enterDesktop(page);
		await page.locator('[data-launch="photos"]').click();
		return appWindow(page, 'photos');
	};

	test('보관함: 꽉 찬 격자 위의 큰 제목, 아래의 앨범별·전체', async ({ page }) => {
		const photos = await openPhone(page);
		await expect(photos.getByRole('heading', { name: '보관함', level: 2 })).toBeVisible();
		const tabs = photos.getByRole('navigation', { name: '사진 탭' });
		await expect(tabs.getByRole('button', { name: '전체' })).toHaveAttribute('aria-pressed', 'true');
		const all = await photos.locator('.photos-phone-grid .photos-thumb').count();
		expect(all).toBeGreaterThan(20);

		await tabs.getByRole('button', { name: '앨범별' }).click();
		await expect(photos.getByRole('region', { name: 'QRU 큐알유' })).toBeVisible();
		await expect(photos.locator('.photos-phone-grid .photos-thumb')).toHaveCount(all);

		// 사진을 누르면 크게 본다
		await photos.getByRole('region', { name: 'QRU 큐알유' }).locator('.photos-thumb').first().click();
		await expect(photos.getByRole('dialog')).toHaveAttribute('aria-label', /^사진 \d+\/\d+:/);
	});

	test('모음: 추억·고정됨·앨범 카드, 앨범을 누르면 그 격자로 들어가고 모음으로 돌아온다', async ({ page }) => {
		const photos = await openPhone(page);
		await photos.getByRole('navigation', { name: '사진 탭' }).getByRole('button', { name: '모음' }).click();
		await expect(photos.getByRole('heading', { name: '모음', level: 2 })).toBeVisible();
		for (const shelf of ['추억', '고정됨', '앨범'])
			await expect(photos.getByRole('region', { name: shelf })).toBeVisible();
		await expect(photos.getByRole('tab', { name: '모음' })).toHaveAttribute('aria-selected', 'true');

		await photos
			.getByRole('region', { name: '앨범' })
			.getByRole('button', { name: /QRU 큐알유/ })
			.click();
		await expect(photos.getByRole('heading', { name: 'QRU 큐알유', level: 2 })).toBeVisible();
		await expect(photos.locator('.photos-phone-grid .photos-thumb')).toHaveCount(9);

		await page.getByRole('button', { name: '모음' }).first().click();
		await expect(photos.getByRole('heading', { name: '모음', level: 2 })).toBeVisible();

		await photos
			.getByRole('region', { name: '고정됨' })
			.getByRole('button', { name: /비디오/ })
			.click();
		await expect(photos.getByRole('heading', { name: '비디오', level: 2 })).toBeVisible();
		await expect(photos.locator('.photos-phone-grid video')).not.toHaveCount(0);
	});
});
