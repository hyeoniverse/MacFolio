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
});

test.describe('팝업', () => {
	/** 메시지 앱에서 글을 쓰고 삭제 팝업을 연다 */
	async function openDeleteDialog(page: Page) {
		await enterDesktop(page);
		await dockItem(page, 'messages').click();
		const messages = appWindow(page, 'messages');
		await messages.getByLabel('이름').fill('민수');
		await messages.getByLabel('비밀번호', { exact: true }).fill('pw1234');
		await messages.getByRole('textbox', { name: '메시지' }).fill('팝업 확인용');
		await messages.getByRole('textbox', { name: '메시지' }).press('Enter');
		await messages.locator('.messages-bubble', { hasText: '팝업 확인용' }).click({ button: 'right' });
		await messages.getByRole('menuitem', { name: '삭제…' }).click();
		const dialog = page.getByRole('dialog', { name: '메시지 삭제' });
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
		await page.locator('.modal-overlay').click({ position: { x: 5, y: 5 } });
		await expect(dialog).toBeHidden();
	});
});
