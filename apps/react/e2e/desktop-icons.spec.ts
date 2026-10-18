import type { Page } from '@playwright/test';
import { test, expect, enterDesktop, appWindow } from './fixtures';

const desktop = (page: Page) => page.getByRole('listbox', { name: '바탕화면' });
const icon = (page: Page, name: string) => desktop(page).getByRole('option', { name, exact: true });

/** 아이콘 칸의 가운데 */
/** 창이 없는 빈 바탕화면 한 점: 아이콘 열 왼쪽 (처음 뜨는 Safari 창은 왼쪽 위에 있다) */
const emptySpot = (page: Page) => ({ x: page.viewportSize()!.width - 320, y: 480 });

async function centerOf(page: Page, name: string) {
	const box = (await icon(page, name).boundingBox())!;
	return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

test.describe('바탕화면 아이콘', () => {
	test('오른쪽 위에 이력서·포트폴리오·자격증·사진이 위에서 아래로 놓인다', async ({ page }) => {
		await enterDesktop(page);
		const width = page.viewportSize()!.width;
		const names = ['이력서', '포트폴리오', '자격증', '사진'];
		let lastY = 0;
		for (const name of names) {
			await expect(icon(page, name)).toBeVisible();
			const { box } = await centerOf(page, name);
			expect(box.x + box.width).toBeGreaterThan(width - 40);
			expect(box.y).toBeGreaterThan(lastY);
			lastY = box.y;
		}
	});

	test('누르면 고르고, 빈 곳을 누르면 풀린다. ⌘A는 모두, Esc는 해제', async ({ page }) => {
		await enterDesktop(page);
		await icon(page, '이력서').click();
		await expect(icon(page, '이력서')).toHaveAttribute('aria-selected', 'true');
		await expect(icon(page, '사진')).toHaveAttribute('aria-selected', 'false');

		await icon(page, '사진').click({ modifiers: ['Meta'] });
		await expect(icon(page, '이력서')).toHaveAttribute('aria-selected', 'true');
		await expect(icon(page, '사진')).toHaveAttribute('aria-selected', 'true');

		await page.mouse.click(emptySpot(page).x, emptySpot(page).y);
		await expect(desktop(page).getByRole('option', { selected: true })).toHaveCount(0);

		await icon(page, '자격증').click();
		await page.keyboard.press('ControlOrMeta+A');
		await expect(desktop(page).getByRole('option', { selected: true })).toHaveCount(4);
		await page.keyboard.press('Escape');
		await expect(desktop(page).getByRole('option', { selected: true })).toHaveCount(0);
	});

	test('빈 곳에서 끌면 사각형에 걸린 아이콘을 고른다', async ({ page }) => {
		await enterDesktop(page);
		const first = await centerOf(page, '이력서');
		const second = await centerOf(page, '포트폴리오');
		await page.mouse.move(first.box.x - 60, first.box.y + 10);
		await page.mouse.down();
		await page.mouse.move(second.x, second.y, { steps: 8 });
		await expect(page.locator('.desktop-band')).toBeVisible();
		await page.mouse.up();
		await expect(page.locator('.desktop-band')).toHaveCount(0);
		await expect(icon(page, '이력서')).toHaveAttribute('aria-selected', 'true');
		await expect(icon(page, '포트폴리오')).toHaveAttribute('aria-selected', 'true');
		await expect(icon(page, '자격증')).toHaveAttribute('aria-selected', 'false');
	});

	test('끌어 옮기면 칸에 맞춰 놓이고, 새로고침해도 그 자리다', async ({ page }) => {
		await enterDesktop(page);
		const start = await centerOf(page, '사진');
		await page.mouse.move(start.x, start.y);
		await page.mouse.down();
		await page.mouse.move(start.x - 300, start.y + 20, { steps: 10 });
		await page.mouse.up();
		await expect.poll(async () => (await icon(page, '사진').boundingBox())!.x).toBeLessThan(start.box.x - 200);
		const moved = (await icon(page, '사진').boundingBox())!;
		// 칸에 맞춘다: 가로로는 96px 칸 몇 개만큼, 세로로는 원래 줄
		expect(Math.round(start.box.x - moved.x) % 96).toBe(0);
		expect(moved.y).toBe(start.box.y);

		await enterDesktop(page);
		await expect(icon(page, '사진')).toBeVisible();
		const after = (await icon(page, '사진').boundingBox())!;
		expect(after.x).toBe(moved.x);
		expect(after.y).toBe(moved.y);
	});

	test('이력서를 두 번 누르면 Finder에서 이력서 폴더가 열린다', async ({ page }) => {
		await enterDesktop(page);
		await icon(page, '이력서').dblclick();
		const finder = appWindow(page, 'finder');
		await expect(finder).toBeVisible();
		await expect(finder.getByRole('heading', { name: '이력서' })).toBeVisible();
	});

	test('빈 곳의 오른쪽 클릭 메뉴: 정리하기, 배경화면 변경…은 시스템 설정을 연다', async ({ page }) => {
		await enterDesktop(page);
		await page.mouse.click(emptySpot(page).x, emptySpot(page).y, { button: 'right' });
		const menu = page.getByRole('menu', { name: '바탕화면 메뉴' });
		await expect(menu.getByRole('menuitem', { name: '정리하기' })).toBeVisible();
		await expect(menu.getByRole('menuitem', { name: '새 폴더' })).toBeDisabled();
		await menu.getByRole('menuitem', { name: '배경화면 변경…' }).click();
		const settings = appWindow(page, 'settings');
		await expect(settings).toBeVisible();
		await expect(settings.getByRole('heading', { name: '배경화면' })).toBeVisible();
	});
});
