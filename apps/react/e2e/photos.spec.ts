import { test, expect, enterDesktop, appWindow, dockItem } from './fixtures';
import type { Locator, Page } from '@playwright/test';
import { fakeApi } from './fakeApi';

const openPhotos = async (page: Page) => {
	await enterDesktop(page);
	await dockItem(page, 'photos').click();
	return appWindow(page, 'photos');
};

/** 정보 판이 스크롤 없이 다 보이고, 끝(프로젝트 페이지 단추)이 아래 막대보다 위에 있다 */
async function expectInfoFits(viewer: Locator) {
	const info = viewer.getByRole('complementary', { name: '사진 정보' });
	await expect.poll(() => info.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(0);
	const action = (await info.locator('.photos-phone-info-action').boundingBox())!;
	const bar = (await viewer.locator('.photos-phone-viewer-bar').boundingBox())!;
	expect(action.y + action.height + 12).toBeLessThanOrEqual(bar.y);
	// 사진 칸은 맨 위에 있고, 캡션은 그 바로 아래 붙는다. 사진은 칸을 가득 채운다 (cover)
	const stage = (await viewer.locator('.photos-phone-stage').boundingBox())!;
	const caption = (await info.locator('.photos-phone-caption').boundingBox())!;
	expect(stage.height).toBeGreaterThan(90);
	expect(Math.abs(stage.y + stage.height - caption.y)).toBeLessThanOrEqual(1);
	const media = (await viewer.locator('.photos-phone-stage :is(img, video)').boundingBox())!;
	expect(Math.round(media.width)).toBe(Math.round(stage.width));
	expect(Math.round(media.height)).toBe(Math.round(stage.height));
}

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

	test('크게 보기의 좌우 화살표는 둥근 사각형으로, 가장자리 가까이 가야 나타난다. 트랙패드 두 손가락 스와이프로도 넘긴다', async ({
		page,
	}) => {
		const photos = await openPhotos(page);
		await photos.getByRole('complementary', { name: '사진 보관함' }).getByRole('button', { name: /^QRU/ }).click();
		const total = await photos.locator('.photos-thumb').count();
		await photos.locator('.photos-thumb').nth(1).click();
		const viewer = photos.getByRole('dialog');
		await expect(viewer).toHaveAttribute('aria-label', new RegExp(`^사진 2/${total}:`));
		const stage = viewer.locator('.photos-viewer-stage');
		const prev = viewer.getByRole('button', { name: '이전 사진' });
		const next = viewer.getByRole('button', { name: '다음 사진' });

		// 둥근 모서리 사각형 (원이 아니다: 세로가 조금 더 길고 모서리는 반지름 9px)
		const box = (await next.boundingBox())!;
		expect(box.height).toBeGreaterThan(box.width);
		await expect(next).toHaveCSS('border-radius', '9px');
		expect(box.height).toBeLessThanOrEqual(40);

		// 가운데에서는 둘 다 숨고, 오른쪽 가장자리 가까이 가면 다음만, 왼쪽이면 이전만
		const area = (await stage.boundingBox())!;
		await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2);
		await expect(next).toHaveCSS('opacity', '0');
		await expect(prev).toHaveCSS('opacity', '0');
		await page.mouse.move(area.x + area.width - 60, area.y + area.height / 2);
		await expect(next).toHaveCSS('opacity', '1');
		await expect(prev).toHaveCSS('opacity', '0');
		await page.mouse.move(area.x + 60, area.y + area.height / 2);
		await expect(prev).toHaveCSS('opacity', '1');
		await expect(next).toHaveCSS('opacity', '0');

		// 두 손가락으로 왼쪽으로 밀면(가로 휠) 다음 사진. 한 번 미는 동안(관성 포함)은 한 장만
		await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2);
		for (let step = 0; step < 6; step++) await page.mouse.wheel(40, 0);
		await expect(viewer).toHaveAttribute('aria-label', new RegExp(`^사진 3/${total}:`));
		// 손을 떼고 잠시 뒤 오른쪽으로 밀면 이전 사진. 세로로 민 것은 넘기지 않는다
		await page.waitForTimeout(400);
		for (let step = 0; step < 6; step++) await page.mouse.wheel(-40, 0);
		await expect(viewer).toHaveAttribute('aria-label', new RegExp(`^사진 2/${total}:`));
		// 관성이 끝나기 전에 다시 밀어도 또 넘긴다 (쉬지 않고 두 번: 세졌다 약해지고, 다시 세졌다 약해진다)
		const swipeTwice = [8, 16, 24, 30, 20, 12, 6, 3, 8, 16, 24, 30, 20, 12, 6, 3];
		for (const delta of swipeTwice) await page.mouse.wheel(delta, 0);
		await expect(viewer).toHaveAttribute('aria-label', new RegExp(`^사진 4/${total}:`));
		await page.waitForTimeout(400);
		for (let step = 0; step < 6; step++) await page.mouse.wheel(0, 80);
		await page.waitForTimeout(400);
		await expect(viewer).toHaveAttribute('aria-label', new RegExp(`^사진 4/${total}:`));
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
	test('창을 좁히면 macOS 사진처럼: 사이드바는 좁게 남고 막대는 줄어 겹치지 않는다. 더 좁히면 사이드바가 접히고, 열면 격자 위에 뜬다', async ({
		page,
	}) => {
		const photos = await openPhotos(page);
		const shrinkBy = async (dx: number) => {
			const handle = (await photos.locator('.resize-handle.bottom-right').boundingBox())!;
			await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
			await page.mouse.down();
			await page.mouse.move(handle.x + handle.width / 2 - dx, handle.y + handle.height / 2, { steps: 8 });
			await page.mouse.up();
		};
		const sidebar = photos.getByRole('complementary', { name: '사진 보관함' });
		const heading = photos.locator('.photos-toolbar-heading');
		const noOverlap = async () => {
			const title = (await heading.boundingBox())!;
			for (const control of await photos
				.locator('.photos-toolbar :is(.photos-capsule, .photos-pill, .photos-circle)')
				.all()) {
				const box = (await control.boundingBox())!;
				expect(box.x).toBeGreaterThanOrEqual(title.x + title.width - 1);
			}
		};

		// 좁은 창 (760px 아래): 사이드바는 그대로, 보기 방식은 팝업 단추, 격자는 정사각형으로 꽉
		await shrinkBy(300);
		await expect(sidebar).toBeVisible();
		await expect(photos.getByRole('group', { name: '보기 방식' })).toHaveCount(0);
		const viewButton = photos.getByRole('button', { name: '보기 방식: 모든 사진' });
		await viewButton.click();
		await page.getByRole('menu', { name: '보기 방식' }).getByRole('menuitemcheckbox', { name: '앨범별' }).click();
		await expect(photos.getByRole('button', { name: '보기 방식: 앨범별' })).toBeVisible();
		await expect(photos.getByRole('region', { name: 'QRU 큐알유' })).toBeVisible();
		await noOverlap();
		const thumb = (await photos.locator('.photos-thumb img').first().boundingBox())!;
		const cellBox = (await photos.locator('.photos-thumb').first().boundingBox())!;
		expect(Math.round(thumb.width)).toBe(Math.round(cellBox.width));
		expect(Math.round(thumb.height)).toBe(Math.round(cellBox.height));

		// 사이드바 단추로 접고 편다
		await sidebar.getByRole('button', { name: '사이드바 가리기' }).click();
		await expect(sidebar).toBeHidden();
		await photos.getByRole('button', { name: '사이드바 보기' }).click();
		await expect(sidebar).toBeVisible();

		// 아주 좁은 창 (560px 아래): 사이드바는 접혀 있고, 열면 격자 위에 뜬다. 고르면 접힌다
		await shrinkBy(200);
		await photos.getByRole('button', { name: '사이드바 가리기' }).click();
		await expect(sidebar).toBeHidden();
		await photos.getByRole('button', { name: '사이드바 보기' }).click();
		const main = (await photos.locator('.photos-main').boundingBox())!;
		const side = (await sidebar.boundingBox())!;
		expect(side.x).toBeLessThan(main.x + 20);
		await sidebar.getByRole('button', { name: /QRU 큐알유/ }).click();
		await expect(sidebar).toBeHidden();
		await expect(photos.getByRole('heading', { name: 'QRU 큐알유' })).toBeVisible();
		await noOverlap();

		// 크게 보기: 프로젝트 페이지는 나침반 동그라미
		await photos.locator('.photos-thumb').first().click();
		const project = photos.getByRole('dialog').getByRole('button', { name: 'QRU 큐알유 페이지' });
		await expect(project).toBeVisible();
		expect((await project.boundingBox())!.width).toBeLessThanOrEqual(36);
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
		// 정보 단추는 켜도 꺼도 같은 크기 (채움만 바뀐다)
		const infoIcon = viewer.getByRole('button', { name: '정보' }).locator('i');
		const off = await infoIcon.boundingBox();
		await viewer.getByRole('button', { name: '정보' }).click();
		await expect(viewer.getByRole('button', { name: '정보' })).toHaveAttribute('aria-pressed', 'true');
		expect(await infoIcon.boundingBox()).toEqual(off);
		const info = viewer.getByRole('complementary', { name: '사진 정보' });
		await expect(info.getByRole('region', { name: '파일' })).toContainText('QRU 큐알유');
		await expect(info.locator('.photos-phone-format')).toHaveText(/^(JPG|PNG|WEBP|GIF|SVG|MP4)$/);
		await expect(info.getByRole('region', { name: '파일' })).toContainText(/\d+(\.\d)?MP · \d+ × \d+/);
		await expect(info.getByRole('button', { name: 'QRU 큐알유 페이지 열기…' })).toBeVisible();
		await expect(strip).toBeHidden();
		// 정보는 스크롤 없이 한 번에 다 보이고, 아래 막대에 가리지 않는다. 사진 칸은 화면 폭의 정사각형
		await expectInfoFits(viewer);
		const square = (await viewer.locator('.photos-phone-stage').boundingBox())!;
		expect(Math.round(square.height)).toBe(Math.round(square.width));
		expect(Math.round(square.y)).toBe(Math.round((await viewer.boundingBox())!.y));

		// 아래 막대에는 Safari(프로젝트 페이지) 단추가 없다. 프로젝트 페이지는 정보에서 연다
		await expect(viewer.locator('.photos-phone-viewer-bar').getByRole('button')).toHaveCount(3);
		await info.getByRole('button', { name: 'QRU 큐알유 페이지 열기…' }).click();
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

	test('보관함은 오래된 것이 위, 최신이 아래이고, 열면 맨 아래부터 보인다. 크게 봤다가 돌아오면 보던 자리', async ({
		page,
	}) => {
		const photos = await openPhone(page);
		const scroll = photos.locator('.photos-phone-scroll');
		const atBottom = () =>
			scroll.evaluate((element) => element.scrollHeight - element.scrollTop - element.clientHeight <= 2);
		await expect.poll(atBottom).toBe(true);
		// 맨 아래 칸은 가장 최근 프로젝트(HYEONIVERSE, 2026)의 사진, 맨 위 칸은 가장 오래된 프로젝트의 사진
		const thumbs = photos.locator('.photos-phone-grid .photos-thumb');
		await expect(thumbs.last()).toHaveAttribute('aria-label', /^HYEONIVERSE:/);
		await expect(thumbs.first()).not.toHaveAttribute('aria-label', /^HYEONIVERSE:/);

		// 조금 올려 둔 자리에서 사진을 크게 봤다가 돌아오면 그 자리
		await scroll.evaluate((element) => (element.scrollTop = element.scrollHeight / 2));
		const before = await scroll.evaluate((element) => element.scrollTop);
		await thumbs.nth(Math.floor((await thumbs.count()) / 2)).click();
		await photos.locator('.mobile-navbar-home').click();
		await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBe(before);
	});

	test('관리자는 사진 정보에서 캡션을 고친다: 저장하면 제목과 검색에 쓰이고, 비우면 원래 캡션으로', async ({
		page,
	}) => {
		const api = await fakeApi(page, { signedIn: true });
		const photos = await openPhone(page);
		await photos.locator('.photos-phone-grid .photos-thumb').nth(7).click();
		const viewer = photos.getByRole('dialog');
		const original = (await viewer.locator('.photos-phone-viewer-title span').textContent())!;
		await viewer.getByRole('button', { name: '정보' }).click();

		const field = viewer.getByRole('textbox', { name: '캡션' });
		await expect(field).toHaveValue(original);
		await field.fill('관리자가 고친 캡션');
		await field.press('Enter');
		await expect(viewer.locator('.photos-phone-viewer-title span')).toHaveText('관리자가 고친 캡션');
		const src = Object.keys(api.photoCaptions)[0];
		expect(api.photoCaptions).toEqual({ [src]: '관리자가 고친 캡션' });

		// Esc는 고치던 것만 되돌린다 (크게 보기는 그대로)
		await field.fill('지울 글');
		await field.press('Escape');
		await expect(field).toHaveValue('관리자가 고친 캡션');
		await expect(viewer).toBeVisible();

		// 비우고 저장하면 원래 캡션
		await field.fill('');
		await field.press('Enter');
		await expect(viewer.locator('.photos-phone-viewer-title span')).toHaveText(original);
		expect(api.photoCaptions).toEqual({});
	});

	test('방문자에게는 캡션이 글자로만 보인다', async ({ page }) => {
		await fakeApi(page);
		const photos = await openPhone(page);
		await photos.locator('.photos-phone-grid .photos-thumb').nth(7).click();
		await photos.getByRole('dialog').getByRole('button', { name: '정보' }).click();
		await expect(photos.getByRole('textbox', { name: '캡션' })).toHaveCount(0);
		await expect(photos.locator('p.photos-phone-caption')).not.toBeEmpty();
	});
	test('사진을 탭하면 사진만 보기: 상태줄과 다른 UI는 숨고 바탕은 까맣게, 사진은 제자리. 다시 탭하면 돌아오고, 밀어 넘기기는 그대로', async ({
		page,
	}) => {
		const photos = await openPhone(page);
		await photos.locator('.photos-phone-grid .photos-thumb').last().click();
		const viewer = photos.getByRole('dialog');
		const stage = viewer.locator('.photos-phone-stage');
		const chrome = [
			viewer.locator('.photos-phone-viewer-title'),
			viewer.getByRole('button', { name: '사진 동작' }),
			viewer.getByRole('list', { name: '사진 띠' }),
			viewer.getByRole('button', { name: '정보' }),
			page.getByRole('button', { name: '돌아가기' }),
			page.locator('.mobile-statusbar'),
		];
		// 정보를 연 채로 탭해도 정보는 닫히고 사진만 남는다
		await viewer.getByRole('button', { name: '정보' }).click();
		await stage.locator('img').click();
		await expect(viewer).toHaveAttribute('data-focus', 'true');
		// 정보를 닫고 나면 사진은 제자리: 사진만 보기를 켜고 꺼도 사진은 움직이지 않는다 (움찔거리지 않게)
		const still = await stage.locator('img').boundingBox();
		await stage.click();
		await expect(viewer).not.toHaveAttribute('data-focus');
		expect(await stage.locator('img').boundingBox()).toEqual(still);
		await stage.click();
		await expect(viewer).toHaveAttribute('data-focus', 'true');
		expect(await stage.locator('img').boundingBox()).toEqual(still);
		await expect(viewer).toHaveCSS('background-color', 'rgb(0, 0, 0)');
		await expect(viewer.getByRole('complementary', { name: '사진 정보' })).toHaveCount(0);
		for (const part of chrome) await expect(part).toBeHidden();
		// 사진은 화면 가득 (사진 칸이 대화 상자 전체)
		expect(await stage.boundingBox()).toEqual(await viewer.boundingBox());

		// 사진만 보기에서도 밀어 넘긴다 (마지막 사진이니 오른쪽으로 밀어 앞 사진으로)
		const before = (await viewer.getAttribute('aria-label'))!;
		const [, at, total] = before.match(/^사진 (\d+)\/(\d+):/)!;
		const box = (await stage.boundingBox())!;
		await page.mouse.move(box.x + 40, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width - 40, box.y + box.height / 2, { steps: 6 });
		await page.mouse.up();
		await expect(viewer).toHaveAttribute('aria-label', new RegExp(`^사진 ${Number(at) - 1}/${total}:`));
		await expect(viewer).toHaveAttribute('data-focus', 'true');

		// 다시 탭하면 돌아온다
		await stage.click();
		await expect(viewer).not.toHaveAttribute('data-focus');
		for (const part of chrome) await expect(part).toBeVisible();
	});
});

test.describe('사진: 작은 휴대폰', () => {
	test.use({ viewport: { width: 375, height: 667 } });

	test('정보는 스크롤 없이 다 보이고, 어떤 사진이든 (긴 캡션이어도) 정보 판과 사진의 크기가 같다', async ({ page }) => {
		await fakeApi(page, { signedIn: true });
		await enterDesktop(page);
		await page.locator('[data-launch="photos"]').click();
		const photos = appWindow(page, 'photos');
		const thumbs = photos.locator('.photos-phone-grid .photos-thumb');
		await expect(thumbs.first()).toBeVisible();
		const total = await thumbs.count();
		await thumbs.last().click();
		const viewer = photos.getByRole('dialog');
		await viewer.getByRole('button', { name: '정보' }).click();
		const info = viewer.getByRole('complementary', { name: '사진 정보' });
		const card = info.getByRole('region', { name: '파일' });
		const layout = async () => {
			// 크기를 다 읽은 뒤에 잰다 (읽는 중… 줄과 높이가 같아야 하지만, 재는 시점은 맞춘다)
			await expect(card).toContainText(/\d+ × \d+/);
			await expectInfoFits(viewer);
			const panel = (await info.boundingBox())!;
			const stage = (await viewer.locator('.photos-phone-stage').boundingBox())!;
			return [Math.round(panel.y), Math.round(panel.height), Math.round(stage.height)];
		};
		const first = await layout();

		// 여러 앨범을 건너가며 넘겨도 그대로 (영상, 긴 앨범·파일 이름 포함)
		for (let step = 1; step <= 12; step++) {
			await page.keyboard.press('ArrowLeft');
			await expect(viewer).toHaveAttribute('aria-label', new RegExp(`^사진 ${total - step}/${total}:`));
			expect(await layout()).toEqual(first);
		}

		// 관리자가 가장 긴 캡션을 써도 그대로 (두 줄 칸 안에서 말줄임)
		const field = viewer.getByRole('textbox', { name: '캡션' });
		await field.fill('긴 캡션 '.repeat(40).slice(0, 200));
		await field.press('Enter');
		await expect(viewer.locator('.photos-phone-viewer-title span')).toHaveText(/^긴 캡션/);
		expect(await layout()).toEqual(first);
	});
});
