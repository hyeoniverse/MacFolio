import type { Page } from '@playwright/test';
import { test, expect, enterDesktop, appWindow } from './fixtures';
import { fakeApi } from './fakeApi';
import { fakeWeather } from './fakeWeather';
import { fakeFiles } from './fakeFiles';

const widget = (page: Page, label: string) =>
	page.locator('.desktop-widgets').getByRole('group', { name: `${label} 위젯` });

/** 처음 뜨는 Safari 창이 왼쪽 위의 위젯을 덮으므로 닫는다 */
async function closeSafari(page: Page) {
	await appWindow(page, 'safari').locator('.traffic-lights').getByRole('button', { name: '닫기' }).click();
	await expect(appWindow(page, 'safari')).toBeHidden();
}

const saved = (page: Page) =>
	page.evaluate(() => JSON.parse(localStorage.getItem('macfolio:desktop:widgets') ?? 'null')) as Promise<
		{ id: string; kind: string; size: string; col: number; row: number }[] | null
	>;

test.describe('바탕화면 위젯', () => {
	test('처음에는 왼쪽 위에 날씨·캘린더·GitHub 잔디, 그 아래 음악·최근 글', async ({ page }) => {
		await fakeWeather(page);
		await enterDesktop(page);
		await closeSafari(page);
		await expect(widget(page, '날씨')).toContainText('19°');
		await expect(widget(page, '캘린더').locator('td[aria-current="date"]')).toHaveCount(1);
		await expect(widget(page, '음악')).toBeVisible();
		// 잔디: 서버가 없으면 안내만 (자료가 있을 때의 모양은 단위 시험과 GitHub 앱 시험이 본다)
		await expect(widget(page, 'GitHub')).toContainText('기여 기록을 불러오지 못했습니다');
		await expect(widget(page, '메모').getByRole('listitem')).toHaveCount(3);
		const weather = (await widget(page, '날씨').boundingBox())!;
		const calendar = (await widget(page, '캘린더').boundingBox())!;
		expect(weather.x).toBeLessThan(60);
		expect(calendar.x).toBeGreaterThan(weather.x + weather.width);
		expect(Math.round(calendar.y)).toBe(Math.round(weather.y));
	});

	test('GitHub 잔디: 지난 1년을 그리고 가장 최근 주가 오른쪽 끝에 들어온다. 작게로 바꿔도 같다', async ({ page }) => {
		await fakeApi(page);
		await enterDesktop(page);
		await closeSafari(page);
		const github = widget(page, 'GitHub');
		await expect(github).toContainText('지난 1년');
		// 가장 최근 날(마지막 칸)이 위젯 안 오른쪽에 있다: 옛 주는 왼쪽으로 잘린다
		const inside = async () => {
			const box = (await github.boundingBox())!;
			// 최근 주가 먼저 그려진다 (오른쪽 끝부터)
			const last = (await github.locator('.widget-github-day:not([data-level="none"])').first().boundingBox())!;
			expect(last.x + last.width).toBeLessThanOrEqual(box.x + box.width);
			expect(last.x + last.width).toBeGreaterThan(box.x + box.width - 40);
		};
		await inside();
		await github.click({ button: 'right' });
		await page.getByRole('menuitemcheckbox', { name: '작게' }).click();
		await expect(github).not.toContainText('지난 1년');
		await inside();
	});

	test('최근 글을 누르면 메모가 그 글을 열고, 위젯의 빈 곳을 누르면 그 앱이 열린다', async ({ page }) => {
		await enterDesktop(page);
		await closeSafari(page);
		const first = widget(page, '메모').getByRole('button').first();
		const title = (await first.locator('strong').textContent())!;
		await first.click();
		await expect(appWindow(page, 'memo').getByRole('heading', { level: 1, name: title })).toBeVisible();

		await widget(page, '날씨').click({ position: { x: 100, y: 20 } });
		await expect(appWindow(page, 'weather')).toBeVisible();
	});

	test('끌어 옮기면 빈 칸에 붙고, 새로고침해도 그 자리에 있다. 다른 위젯 위에 놓으면 제자리로', async ({ page }) => {
		await enterDesktop(page);
		await closeSafari(page);
		const calendar = widget(page, '캘린더');
		const box = (await calendar.boundingBox())!;
		await page.mouse.move(box.x + 40, box.y + 40);
		await page.mouse.down();
		await page.mouse.move(box.x + 40 + 3 * 180, box.y + 40 + 10, { steps: 10 });
		await page.mouse.up();
		await expect.poll(async () => Math.round((await calendar.boundingBox())!.x)).toBe(Math.round(box.x + 3 * 180));
		expect((await saved(page))?.find((item) => item.id === 'calendar')).toMatchObject({ col: 4, row: 0 });

		// 다른 위젯 위에 놓으면 제자리로
		const moved = (await calendar.boundingBox())!;
		await page.mouse.move(moved.x + 40, moved.y + 40);
		await page.mouse.down();
		await page.mouse.move(60, moved.y + 40, { steps: 10 });
		await page.mouse.up();
		await expect.poll(async () => Math.round((await calendar.boundingBox())!.x)).toBe(Math.round(moved.x));

		await page.reload();
		await page.locator('.loading-container').click();
		await expect(page.locator('.loading-container')).toBeHidden({ timeout: 20_000 });
		await expect
			.poll(async () => Math.round((await widget(page, '캘린더').boundingBox())!.x))
			.toBe(Math.round(moved.x));
	});

	test('오른쪽 클릭 메뉴로 크기를 바꾸고 지운다', async ({ page }) => {
		await enterDesktop(page);
		await closeSafari(page);
		const calendar = widget(page, '캘린더');
		const small = (await calendar.boundingBox())!.width;
		await calendar.click({ button: 'right' });
		await page.getByRole('menuitemcheckbox', { name: '중간' }).click();
		await expect.poll(async () => (await calendar.boundingBox())!.width).toBeGreaterThan(small * 2);
		await expect(calendar.getByRole('table')).toBeVisible();

		await calendar.click({ button: 'right' });
		await page.getByRole('menuitem', { name: '위젯 제거' }).click();
		await expect(calendar).toHaveCount(0);
		expect((await saved(page))?.map((item) => item.id)).toEqual(['weather', 'github', 'music', 'posts']);
	});

	test('사진 위젯은 오른쪽 클릭 메뉴에서 앨범을 고른다', async ({ page }) => {
		await enterDesktop(page);
		await closeSafari(page);
		await page.mouse.click(page.viewportSize()!.width - 320, 480, { button: 'right' });
		await page.getByRole('menuitem', { name: '위젯 편집…' }).click();
		await page
			.getByRole('dialog', { name: '위젯 갤러리' })
			.getByRole('button', { name: '사진 위젯 (작게) 더하기' })
			.click();
		await page.keyboard.press('Escape');
		const photos = widget(page, '사진');
		await photos.click({ button: 'right' });
		await expect(page.getByRole('menuitemcheckbox', { name: '모든 앨범' })).toHaveAttribute('aria-checked', 'true');
		await page.getByRole('menuitemcheckbox', { name: 'SproutFarm 새싹 농장' }).click();
		await expect(photos.locator('figcaption')).toHaveText('SproutFarm 새싹 농장');
		// 소리 단추는 그림일 때도 늘 같은 자리(오른쪽 아래)에 있다
		const sound = photos.getByRole('button', { name: '소리 켜기' });
		await expect(sound).toBeVisible();
		const [widgetBox, soundBox] = [(await photos.boundingBox())!, (await sound.boundingBox())!];
		expect(soundBox.x).toBeGreaterThan(widgetBox.x + widgetBox.width / 2);
		expect(soundBox.y).toBeGreaterThan(widgetBox.y + widgetBox.height / 2);
		expect((await saved(page))?.find((item) => item.kind === 'photos')).toMatchObject({ album: 'sproutfarm' });
	});

	test('사진 위젯은 Finder › 그림에 만든 폴더의 그림도 보여 준다', async ({ page }) => {
		const api = await fakeApi(page);
		api.finderLayout = {
			folders: [{ id: 'folder:widget01', name: '위젯 사진', parent: 'pictures' }],
			files: { 'file:pictures/sea.png': 'folder:widget01' },
			aliases: null,
		};
		await fakeFiles(page, [{ id: 'p1', folder: '그림', name: '바다.png', key: 'pictures/sea.png', kind: 'image' }]);
		await enterDesktop(page);
		await closeSafari(page);
		await page.mouse.click(page.viewportSize()!.width - 320, 480, { button: 'right' });
		await page.getByRole('menuitem', { name: '위젯 편집…' }).click();
		await page
			.getByRole('dialog', { name: '위젯 갤러리' })
			.getByRole('button', { name: '사진 위젯 (작게) 더하기' })
			.click();
		await page.keyboard.press('Escape');
		const photos = widget(page, '사진');
		await photos.click({ button: 'right' });
		await expect(page.getByRole('menu')).toContainText('그림 폴더');
		await page.getByRole('menuitemcheckbox', { name: '위젯 사진' }).click();
		await expect(photos.locator('figcaption')).toHaveText('위젯 사진');
		await expect(photos.locator('img')).toHaveAttribute('src', '/files/pictures/sea.png');
		expect((await saved(page))?.find((item) => item.kind === 'photos')).toMatchObject({ album: 'folder:widget01' });
	});

	test('메모 위젯은 오른쪽 클릭 메뉴에서 최근 글·인기글·랜덤을 고른다', async ({ page }) => {
		await enterDesktop(page);
		await closeSafari(page);
		const memo = widget(page, '메모');
		await expect(memo.locator('.widget-posts-header')).toHaveText('최근 글');
		await memo.click({ button: 'right' });
		await expect(page.getByRole('menuitemcheckbox', { name: '최근 글' })).toHaveAttribute('aria-checked', 'true');
		// 서버가 없으면 조회·반응이 없어 인기글이 비어 있다
		await page.getByRole('menuitemcheckbox', { name: '인기글' }).click();
		await expect(memo.locator('.widget-posts-header')).toHaveText('인기글');
		await expect(memo).toContainText('아직 인기글이 없습니다');
		await memo.click({ button: 'right' });
		await page.getByRole('menuitemcheckbox', { name: '랜덤' }).click();
		await expect(memo.locator('.widget-posts-header')).toHaveText('랜덤');
		await expect(memo.getByRole('listitem')).toHaveCount(3);
		expect((await saved(page))?.find((item) => item.kind === 'posts')).toMatchObject({ posts: 'random' });
	});

	test('사진 위젯은 영상을 소리 없이 재생하고, 단추로 소리를 켠다', async ({ page }) => {
		const api = await fakeApi(page);
		api.finderLayout = { folders: [], files: {}, aliases: null };
		await fakeFiles(page, [{ id: 'v1', folder: '그림', name: '파도.mp4', key: 'pictures/wave.mp4', kind: 'file' }]);
		await enterDesktop(page);
		await closeSafari(page);
		await page.mouse.click(page.viewportSize()!.width - 320, 480, { button: 'right' });
		await page.getByRole('menuitem', { name: '위젯 편집…' }).click();
		await page
			.getByRole('dialog', { name: '위젯 갤러리' })
			.getByRole('button', { name: '사진 위젯 (작게) 더하기' })
			.click();
		await page.keyboard.press('Escape');
		const photos = widget(page, '사진');
		await photos.click({ button: 'right' });
		await page.getByRole('menuitemcheckbox', { name: '그림' }).click();
		const video = photos.locator('video');
		await expect(video).toHaveAttribute('src', '/files/pictures/wave.mp4');
		expect(await video.evaluate((el: HTMLVideoElement) => el.muted && el.autoplay)).toBe(true);
		await photos.getByRole('button', { name: '소리 켜기' }).click();
		expect(await video.evaluate((el: HTMLVideoElement) => el.muted)).toBe(false);
		await expect(photos.getByRole('button', { name: '소리 끄기' })).toHaveAttribute('aria-pressed', 'true');
		// 일시 정지하면 영상이 멈추고, 재생하면 다시 돈다
		await photos.getByRole('button', { name: '일시 정지' }).click();
		expect(await video.evaluate((el: HTMLVideoElement) => el.paused)).toBe(true);
		await photos.getByRole('button', { name: '재생' }).click();
		await expect(photos.getByRole('button', { name: '일시 정지' })).toBeVisible();
	});

	test('사진 위젯의 GIF는 일시 정지하면 지금 장면에서 멈춘다', async ({ page }) => {
		const api = await fakeApi(page);
		api.finderLayout = { folders: [], files: {}, aliases: null };
		await fakeFiles(page, [{ id: 'g1', folder: '그림', name: '움짤.gif', key: 'pictures/loop.gif', kind: 'image' }]);
		await page.addInitScript(() =>
			localStorage.setItem(
				'macfolio:desktop:widgets',
				JSON.stringify([{ id: 'photos', kind: 'photos', size: 'small', col: 3, row: 0, album: 'pictures' }])
			)
		);
		await enterDesktop(page);
		await closeSafari(page);
		const photos = widget(page, '사진');
		await expect(photos.locator('img')).toHaveAttribute('src', '/files/pictures/loop.gif');
		await expect(photos.locator('canvas')).toHaveCount(0);
		await photos.getByRole('button', { name: '일시 정지' }).click();
		// 멈춘 장면을 그린 캔버스가 그림 위를 덮는다
		await expect(photos.locator('canvas.widget-photo-frame')).toBeVisible();
		await photos.getByRole('button', { name: '재생' }).click();
		await expect(photos.locator('canvas')).toHaveCount(0);
	});

	test('위젯 편집: 바탕화면 메뉴에서 갤러리를 열어 더하고, 지우기 단추로 빼고, 완료나 Esc로 닫는다', async ({
		page,
	}) => {
		await enterDesktop(page);
		await closeSafari(page);
		await page.mouse.click(page.viewportSize()!.width - 320, 480, { button: 'right' });
		await page.getByRole('menuitem', { name: '위젯 편집…' }).click();
		const gallery = page.getByRole('dialog', { name: '위젯 갤러리' });
		await expect(gallery).toBeVisible();
		const previews = gallery.getByRole('button', { name: /위젯 \(.+\) 더하기$/ });
		await expect(previews).toHaveCount(14);

		// 사이드바: 종류를 고르면 그 위젯의 크기들만, 찾으면 맞는 종류만
		const kinds = gallery.getByRole('navigation', { name: '위젯 종류' });
		await kinds.getByRole('button', { name: '날씨' }).click();
		await expect(previews).toHaveCount(2);
		await kinds.getByRole('button', { name: '모든 위젯' }).click();
		await gallery.getByRole('searchbox', { name: '위젯 검색' }).fill('시각');
		await expect(previews).toHaveCount(1);

		await gallery.getByRole('button', { name: '시계 위젯 (작게) 더하기' }).click();
		await expect(widget(page, '시계')).toBeVisible();
		expect((await saved(page))?.find((item) => item.kind === 'clock')).toMatchObject({ size: 'small' });

		await page.getByRole('button', { name: '시계 위젯 제거' }).click();
		await expect(widget(page, '시계')).toHaveCount(0);

		await gallery.getByRole('button', { name: '완료' }).click();
		await expect(gallery).toBeHidden();
		await expect(page.getByRole('button', { name: '날씨 위젯 제거' })).toHaveCount(0);

		await widget(page, '날씨').click({ button: 'right' });
		await page.getByRole('menuitem', { name: '위젯 편집…' }).click();
		await expect(gallery).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(gallery).toBeHidden();
	});

	test('위젯은 바탕화면 아이콘(폴더)을 가리지 않는다: 아이콘 자리에 저장된 위젯도 빈 칸에 그린다', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		// 오른쪽 위 아이콘 열에 걸치는 자리 (1440 폭에서 열 6~7은 아이콘 열과 겹친다)
		await page.addInitScript(() => {
			localStorage.setItem(
				'macfolio:desktop:widgets',
				JSON.stringify([{ id: 'github', kind: 'github', size: 'medium', col: 6, row: 0 }])
			);
		});
		await enterDesktop(page);
		await closeSafari(page);
		const box = (await widget(page, 'GitHub').boundingBox())!;
		const icons = page.locator('[data-desktop-icon]');
		await expect(icons.first()).toBeVisible();
		for (const icon of await icons.all()) {
			const b = (await icon.boundingBox())!;
			const overlap =
				box.x < b.x + b.width && b.x < box.x + box.width && box.y < b.y + b.height && b.y < box.y + box.height;
			expect(overlap).toBe(false);
		}
	});

	test('위젯 편집은 갤러리·위젯 바깥(빈 바탕화면)을 누르면 끝난다', async ({ page }) => {
		await enterDesktop(page);
		await closeSafari(page);
		await page.mouse.click(page.viewportSize()!.width - 320, 480, { button: 'right' });
		await page.getByRole('menuitem', { name: '위젯 편집…' }).click();
		const gallery = page.getByRole('dialog', { name: '위젯 갤러리' });
		await expect(gallery).toBeVisible();
		// 위젯을 눌러도 끝나지 않는다
		await widget(page, '날씨').click();
		await expect(gallery).toBeVisible();
		await page.mouse.click(page.viewportSize()!.width - 320, 300);
		await expect(gallery).toBeHidden();
		await expect(page.getByRole('button', { name: '날씨 위젯 제거' })).toHaveCount(0);
	});

	test('위젯을 편집하는 동안은 열린 창을 내려 두고, 끝나면 그 창만 다시 띄운다', async ({ page }) => {
		await enterDesktop(page);
		const safari = appWindow(page, 'safari');
		await expect(safari).toBeVisible();
		await page.mouse.click(page.viewportSize()!.width - 320, 480, { button: 'right' });
		await page.getByRole('menuitem', { name: '위젯 편집…' }).click();
		await expect(safari).toBeHidden();
		await page.getByRole('dialog', { name: '위젯 갤러리' }).getByRole('button', { name: '완료' }).click();
		await expect(safari).toBeVisible();
	});
});
