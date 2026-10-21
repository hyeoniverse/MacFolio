import type { Page } from '@playwright/test';
import { test, expect, enterDesktop, appWindow } from './fixtures';
import { fakeApi } from './fakeApi';
import { fakeWeather } from './fakeWeather';

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
		await expect(widget(page, '캘린더')).toContainText('요일');
		await expect(widget(page, '음악')).toBeVisible();
		// 잔디: 서버가 없으면 안내만 (자료가 있을 때의 모양은 단위 시험과 GitHub 앱 시험이 본다)
		await expect(widget(page, 'GitHub')).toContainText('기여 기록을 불러오지 못했습니다');
		await expect(widget(page, '최근 글').getByRole('listitem')).toHaveCount(3);
		const weather = (await widget(page, '날씨').boundingBox())!;
		const calendar = (await widget(page, '캘린더').boundingBox())!;
		expect(weather.x).toBeLessThan(60);
		expect(calendar.x).toBeGreaterThan(weather.x + weather.width);
		expect(Math.round(calendar.y)).toBe(Math.round(weather.y));
	});

	test('GitHub 잔디: 서버의 기여 기록을 주마다 한 열로, 중간은 20주·작게는 8주', async ({ page }) => {
		await fakeApi(page);
		await enterDesktop(page);
		await closeSafari(page);
		const github = widget(page, 'GitHub');
		await expect(github.locator('.widget-github-week')).toHaveCount(20);
		await expect(github.locator('.widget-github-day[data-level="4"]').first()).toBeVisible();
		await expect(github).toContainText('최근 20주 기여');
		await github.click({ button: 'right' });
		await page.getByRole('menuitemcheckbox', { name: '작게' }).click();
		await expect(github.locator('.widget-github-week')).toHaveCount(8);
	});

	test('최근 글을 누르면 메모가 그 글을 열고, 위젯의 빈 곳을 누르면 그 앱이 열린다', async ({ page }) => {
		await enterDesktop(page);
		await closeSafari(page);
		const first = widget(page, '최근 글').getByRole('button').first();
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
		expect((await saved(page))?.find((item) => item.kind === 'photos')).toMatchObject({ album: 'sproutfarm' });
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
});
