import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Page } from '@playwright/test';

/** 요소를 잡고 끈다. at은 요소 안에서 잡을 위치의 비율(기본: 가운데) */
async function dragBy(
	page: Page,
	selector: ReturnType<Page['locator']>,
	dx: number,
	dy: number,
	at = { x: 0.5, y: 0.5 }
) {
	const box = (await selector.boundingBox())!;
	const x = box.x + box.width * at.x;
	const y = box.y + box.height * at.y;
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.move(x + dx, y + dy, { steps: 10 });
	await page.mouse.up();
}

// 제목 표시줄이 있는 일반 창(GitHub)으로 확인한다
test.describe('창', () => {
	test('옮긴 위치가 새로고침 후에도 유지된다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'github').click();
		const github = appWindow(page, 'github');
		await dragBy(page, github.locator('.title'), 200, 100);
		const moved = (await github.boundingBox())!;

		await enterDesktop(page);
		await dockItem(page, 'github').click();
		const restored = (await github.boundingBox())!;
		expect(restored.x).toBeCloseTo(moved.x, 0);
		expect(restored.y).toBeCloseTo(moved.y, 0);
	});

	test('브라우저 창이 작아져도 앱 창은 화면 안에 남는다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'github').click();
		const github = appWindow(page, 'github');
		// 오른쪽 아래 끝으로 옮긴 뒤 브라우저를 줄인다
		await dragBy(page, github.locator('.title'), 2000, 2000);
		await page.setViewportSize({ width: 1000, height: 700 });

		// 크기 변경 후 다시 그려질 때까지 기다린다
		await expect
			.poll(async () => {
				const box = (await github.boundingBox())!;
				return box.x >= 0 && box.y >= 0 && box.x + box.width <= 1000 && box.y + box.height <= 700;
			})
			.toBe(true);
	});

	test('모서리를 끌어 크기를 바꿀 수 있다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'github').click();
		const github = appWindow(page, 'github');
		const before = (await github.boundingBox())!;

		// 핸들은 절반이 창 밖으로 나와 잘려 있으므로 창 안쪽 부분을 잡는다
		await dragBy(page, github.locator('.resize-handle.bottom-right'), 100, 50, { x: 0.25, y: 0.25 });

		const after = (await github.boundingBox())!;
		expect(after.width - before.width).toBeCloseTo(100, -1);
		expect(after.height - before.height).toBeCloseTo(50, -1);
		expect(after.x).toBeCloseTo(before.x, 0);
	});

	test('전체 화면 버튼으로 최대화하고 다시 누르면 원래 크기로 돌아온다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'github').click();
		const github = appWindow(page, 'github');
		const before = (await github.boundingBox())!;

		await github.getByRole('button', { name: '전체 화면' }).click();
		const maximized = (await github.boundingBox())!;
		const viewport = page.viewportSize()!;
		expect(maximized.width).toBeCloseTo(viewport.width, 0);
		// Dock 영역(136px)은 비워 둔다
		expect(maximized.y + maximized.height).toBeCloseTo(viewport.height - 136, 0);

		await github.getByRole('button', { name: '전체 화면' }).click();
		const restored = (await github.boundingBox())!;
		expect(restored).toEqual(before);
	});

	test('최대화한 창도 모서리를 끌면 최대화가 풀리며 크기가 바뀐다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'github').click();
		const github = appWindow(page, 'github');
		await github.getByRole('button', { name: '전체 화면' }).click();
		const maximized = (await github.boundingBox())!;

		await dragBy(page, github.locator('.resize-handle.bottom-right'), -300, -200, { x: 0.25, y: 0.25 });

		const after = (await github.boundingBox())!;
		expect(maximized.width - after.width).toBeCloseTo(300, -1);
		expect(maximized.height - after.height).toBeCloseTo(200, -1);
		expect(after.x).toBeCloseTo(maximized.x, 0);
	});
});

test.describe('팝업', () => {
	/** 메시지 앱에서 글을 쓰고 삭제 확인창(공통 AlertDialog)을 연다 */
	async function openDeleteDialog(page: Page) {
		await enterDesktop(page);
		await dockItem(page, 'messages').click();
		const messages = appWindow(page, 'messages');
		await messages.getByRole('textbox', { name: '메시지' }).fill('팝업 확인용');
		await messages.getByRole('textbox', { name: '메시지' }).press('Enter');
		await messages.locator('.messages-bubble', { hasText: '팝업 확인용' }).click({ button: 'right' });
		await page.getByRole('menu', { name: '메시지 메뉴' }).getByRole('menuitem', { name: '삭제…' }).click();
		const dialog = page.getByRole('alertdialog', { name: '메시지를 삭제할까요?' });
		await expect(dialog).toBeVisible();
		return dialog;
	}

	test('Esc로 닫힌다', async ({ page }) => {
		const dialog = await openDeleteDialog(page);
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
	});

	test('바깥 영역을 클릭하면 닫힌다', async ({ page }) => {
		const dialog = await openDeleteDialog(page);
		await page.locator('.ui-alert-overlay').click({ position: { x: 5, y: 5 } });
		await expect(dialog).toBeHidden();
	});
});

test.describe('바탕화면 보기', () => {
	/** 아이콘·위젯·창이 없는 바탕화면 빈 곳 (바탕화면 판 자신이 받는 곳) */
	async function wallpaperPoint(page: Page) {
		const point = await page.evaluate(() => {
			for (let x = 40; x < window.innerWidth - 40; x += 40)
				for (let y = 60; y < window.innerHeight - 160; y += 40)
					if (document.elementFromPoint(x, y)?.classList.contains('desktop-icons')) return { x, y };
			return null;
		});
		expect(point).not.toBeNull();
		return point!;
	}

	test('바탕화면 빈 곳을 누르면 창이 가까운 가장자리로 밀려나 조금만 남고, 다시 누르면 돌아온다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'github').click();
		const github = appWindow(page, 'github');
		await expect(github).toBeVisible();
		const before = (await github.boundingBox())!;
		const viewport = page.viewportSize()!;

		const point = await wallpaperPoint(page);
		await page.mouse.click(point.x, point.y);
		await expect(github).toHaveClass(/revealed/);
		const away = (await github.boundingBox())!;
		const toLeft = before.x + before.width / 2 < viewport.width / 2;
		// 가장자리에 40px만 남는다
		if (toLeft) expect(away.x + away.width).toBeCloseTo(40, 0);
		else expect(away.x).toBeCloseTo(viewport.width - 40, 0);
		expect(away.y).toBeCloseTo(before.y, 0);
		// 메뉴 막대는 Finder
		await expect(page.locator('.macos-statusbar')).toContainText('Finder');

		await page.mouse.click(point.x, point.y);
		await expect(github).not.toHaveClass(/revealed/);
		expect((await github.boundingBox())!.x).toBeCloseTo(before.x, 0);
	});

	test('밀려난 창의 남은 곳을 누르면 모든 창이 돌아오고 그 창이 맨 앞이 된다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'github').click();
		const github = appWindow(page, 'github');
		await expect(github).toBeVisible();
		const before = (await github.boundingBox())!;
		const point = await wallpaperPoint(page);
		await page.mouse.click(point.x, point.y);
		await expect(github).toHaveClass(/revealed/);

		const away = (await github.boundingBox())!;
		const viewport = page.viewportSize()!;
		const peekX = away.x < 0 ? 20 : viewport.width - 20;
		await page.mouse.click(peekX, away.y + away.height / 2);
		await expect(github).not.toHaveClass(/revealed/);
		expect((await github.boundingBox())!.x).toBeCloseTo(before.x, 0);
		await expect(page.locator('.macos-statusbar')).toContainText('GitHub');
	});

	test('창을 치운 채 Dock에서 앱을 열면 창이 모두 돌아온다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'github').click();
		const github = appWindow(page, 'github');
		await expect(github).toBeVisible();
		const point = await wallpaperPoint(page);
		await page.mouse.click(point.x, point.y);
		await expect(github).toHaveClass(/revealed/);

		await dockItem(page, 'terminal').click();
		await expect(github).not.toHaveClass(/revealed/);
		await expect(appWindow(page, 'terminal')).not.toHaveClass(/revealed/);
	});

	test('바탕화면을 끌어 아이콘을 고르는 것은 창을 치우지 않는다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'github').click();
		const github = appWindow(page, 'github');
		await expect(github).toBeVisible();
		const point = await wallpaperPoint(page);
		await page.mouse.move(point.x, point.y);
		await page.mouse.down();
		await page.mouse.move(point.x + 30, point.y + 30, { steps: 5 });
		await page.mouse.up();
		await expect(github).not.toHaveClass(/revealed/);
	});
});
