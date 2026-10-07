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

	test('아래 막대는 어느 화면에서나 같다: 보관함·모음 탭과 검색. 앨범별·전체는 오른쪽 위 •••', async ({ page }) => {
		const photos = await openPhone(page);
		const bar = photos.getByRole('navigation', { name: '사진 탭' });
		const tabs = bar.getByRole('tablist', { name: '사진 탭' });
		await expect(photos.getByRole('heading', { name: '보관함', level: 2 })).toBeVisible();
		await expect(tabs.getByRole('tab', { name: '보관함' })).toHaveAttribute('aria-selected', 'true');
		await expect(bar.getByRole('button', { name: '검색' })).toBeVisible();
		const all = await photos.locator('.photos-phone-grid .photos-thumb').count();
		expect(all).toBeGreaterThan(20);

		await photos.getByRole('button', { name: '보기 방식' }).click();
		await page.getByRole('menuitemcheckbox', { name: '앨범별' }).click();
		await expect(photos.getByRole('region', { name: 'QRU 큐알유' })).toBeVisible();
		await expect(photos.locator('.photos-phone-grid .photos-thumb')).toHaveCount(all);

		// 모음으로 가도 아래 막대는 같은 모양 (탭 두 개와 검색)
		await tabs.getByRole('tab', { name: '모음' }).click();
		await expect(photos.getByRole('heading', { name: '모음', level: 2 })).toBeVisible();
		await expect(tabs.getByRole('tab')).toHaveCount(2);
		await expect(bar.getByRole('button', { name: '검색' })).toBeVisible();
	});

	test('모음: 추억·고정됨·앨범 카드, 앨범을 누르면 그 격자로 들어가고 모음으로 돌아온다', async ({ page }) => {
		const photos = await openPhone(page);
		await photos.getByRole('tab', { name: '모음' }).click();
		for (const shelf of ['추억', '고정됨', '앨범'])
			await expect(photos.getByRole('region', { name: shelf })).toBeVisible();

		await photos
			.getByRole('region', { name: '앨범' })
			.getByRole('button', { name: /QRU 큐알유/ })
			.click();
		await expect(photos.getByRole('heading', { name: 'QRU 큐알유', level: 2 })).toBeVisible();
		await expect(photos.locator('.photos-phone-grid .photos-thumb')).toHaveCount(9);
		// 앨범으로 들어갈 때는 오른쪽에서, 나올 때는 왼쪽에서 넘어온다
		await expect(photos.locator('.photos-phone-scroll')).toHaveAttribute('data-motion', 'forward');

		await photos.locator('.mobile-navbar-home').click();
		await expect(photos.getByRole('heading', { name: '모음', level: 2 })).toBeVisible();
		await expect(photos.locator('.photos-phone-scroll')).toHaveAttribute('data-motion', 'back');

		await photos
			.getByRole('region', { name: '고정됨' })
			.getByRole('button', { name: /비디오/ })
			.click();
		await expect(photos.getByRole('heading', { name: '비디오', level: 2 })).toBeVisible();
		await expect(photos.locator('.photos-phone-grid video')).not.toHaveCount(0);
	});

	test('크게 보기 (iOS 사진): 위에 제목 알약, 아래에 사진 띠와 막대. 띠·밀기로 넘기고 좋아요·정보·프로젝트 페이지', async ({
		page,
	}) => {
		const photos = await openPhone(page);
		await photos.getByRole('tab', { name: '모음' }).click();
		await photos
			.getByRole('region', { name: '앨범' })
			.getByRole('button', { name: /QRU 큐알유/ })
			.click();
		// 첫 줄 왼쪽은 떠 있는 뒤로 가기 밑이라, 가려지지 않은 둘째 줄의 사진을 누른다
		await photos.locator('.photos-phone-grid .photos-thumb').nth(7).click();
		const viewer = photos.getByRole('dialog');
		await expect(viewer).toHaveAttribute('aria-label', /^사진 8\/9:/);
		await expect(viewer.locator('.photos-phone-viewer-title strong')).toHaveText('QRU 큐알유');

		// 사진 띠: 앨범의 사진이 모두, 지금 사진이 표시된다. 띠의 사진을 누르면 그 사진으로
		const strip = viewer.getByRole('list', { name: '사진 띠' });
		await expect(strip.getByRole('button')).toHaveCount(9);
		await expect(strip.getByRole('button').nth(7)).toHaveAttribute('aria-current', 'true');
		await strip.getByRole('button').nth(3).click();
		await expect(viewer).toHaveAttribute('aria-label', /^사진 4\/9:/);

		// 사진을 왼쪽으로 밀면 다음
		const stage = (await viewer.locator('.photos-phone-stage').boundingBox())!;
		await page.mouse.move(stage.x + stage.width - 40, stage.y + stage.height / 2);
		await page.mouse.down();
		await page.mouse.move(stage.x + 40, stage.y + stage.height / 2, { steps: 6 });
		await page.mouse.up();
		await expect(viewer).toHaveAttribute('aria-label', /^사진 5\/9:/);

		// 좋아요, 정보
		await viewer.getByRole('button', { name: '좋아요' }).click();
		await expect(viewer.getByRole('button', { name: '좋아요' })).toHaveAttribute('aria-pressed', 'true');
		// 정보 (iOS 사진): 사진이 위로 줄고, 형식 딱지와 실제 크기, 프로젝트 페이지 단추. 사진 띠는 숨는다
		await viewer.getByRole('button', { name: '정보' }).click();
		const info = viewer.getByRole('complementary', { name: '사진 정보' });
		await expect(info.getByRole('region', { name: '파일' })).toContainText('QRU 큐알유');
		await expect(info.locator('.photos-phone-format')).toHaveText(/^(JPG|PNG|WEBP|GIF|SVG|MP4)$/);
		await expect(info.getByRole('region', { name: '파일' })).toContainText(/\d+(\.\d)?MP · \d+ × \d+/);
		await expect(info.getByRole('button', { name: 'QRU 큐알유 페이지 열기…' })).toBeVisible();
		await expect(strip).toBeHidden();

		// 프로젝트 페이지: Safari가 그 프로젝트를 연다
		await viewer.getByRole('button', { name: 'QRU 큐알유 페이지', exact: true }).click();
		await expect(appWindow(page, 'safari')).toBeVisible();
	});

	test('검색: 최근 항목 카드와 앨범 추천, 아래의 검색 칸. 추천을 누르면 결과, ×로 닫는다', async ({ page }) => {
		const photos = await openPhone(page);
		await photos.getByRole('button', { name: '검색' }).click();
		await expect(photos.getByRole('heading', { name: '검색', level: 2 })).toBeVisible();
		await expect(photos.getByRole('region', { name: '최근 항목' }).getByRole('button')).toHaveCount(2);
		const search = photos.getByRole('searchbox', { name: '보관함 검색' });
		await expect(search).toBeFocused();

		await photos.getByRole('list', { name: '추천 검색어' }).getByRole('button', { name: 'QRU 큐알유' }).click();
		await expect(search).toHaveValue('QRU 큐알유');
		await expect(photos.locator('.photos-phone-results')).toHaveText('9개의 결과');
		await expect(photos.locator('.photos-phone-grid .photos-thumb')).toHaveCount(9);

		await search.fill('없는 사진');
		await expect(photos.locator('.photos-phone-results')).toHaveText('찾는 사진이 없습니다.');

		await photos.getByRole('button', { name: '검색 닫기' }).click();
		await expect(photos.getByRole('heading', { name: '보관함', level: 2 })).toBeVisible();
	});
});
