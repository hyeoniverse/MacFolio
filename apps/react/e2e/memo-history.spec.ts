import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Locator, Page } from '@playwright/test';

async function openMemo(page: Page) {
	await enterDesktop(page);
	await dockItem(page, 'memo').click();
	const memo = appWindow(page, 'memo');
	await expect(memo.locator('.memo-item').first()).toBeVisible();
	return memo;
}

/** 본문에 연 글의 제목 */
const readerTitle = (memo: Locator) => memo.locator('.memo-reader').getAttribute('aria-label');

/** 목록의 n번째 글을 연다. 연 글의 제목을 돌려준다 */
async function openNth(memo: Locator, index: number) {
	const item = memo.locator('.memo-item').nth(index);
	const title = (await item.locator('strong').first().textContent())?.trim() ?? '';
	await item.click();
	await expect.poll(() => readerTitle(memo)).toBe(title);
	return title;
}

test.describe('메모 뒤로·앞으로', () => {
	test('누르면 한 칸씩 가고, 단축키 ⌘[·⌘]도 같다. 브라우저 페이지는 떠나지 않는다', async ({ page }) => {
		const memo = await openMemo(page);
		const back = memo.getByRole('button', { name: '뒤로', exact: true });
		const forward = memo.getByRole('button', { name: '앞으로', exact: true });
		await expect(back).toBeDisabled();
		await expect(forward).toBeDisabled();

		const first = await openNth(memo, 1);
		const second = await openNth(memo, 2);
		await back.click();
		await expect.poll(() => readerTitle(memo)).toBe(first);
		await expect(forward).toBeEnabled();
		await forward.click();
		await expect.poll(() => readerTitle(memo)).toBe(second);

		// 단축키 (글자를 쓰는 칸 밖에서)
		await memo.locator('.memo-reader').click({ position: { x: 10, y: 120 } });
		await page.keyboard.press('ControlOrMeta+BracketLeft');
		await expect.poll(() => readerTitle(memo)).toBe(first);
		await page.keyboard.press('ControlOrMeta+BracketRight');
		await expect.poll(() => readerTitle(memo)).toBe(second);
		await expect(memo).toBeVisible();

		// 뒤로 간 뒤 다른 글을 열면 앞으로 갈 기록은 사라진다 (Safari와 같다)
		await back.click();
		await openNth(memo, 3);
		await expect(forward).toBeDisabled();
	});

	test('폴더를 옮긴 것도 기록되고, 길게 누르면 지난 칸 목록에서 골라 간다', async ({ page }) => {
		const memo = await openMemo(page);
		const first = await openNth(memo, 0);
		// 본문 머리의 폴더 (날짜 · 개발 기록 › MacFolio › …): 목록의 둘째 줄도 이 폴더여야 한다 ('모든 글'이 아니라)
		const firstFolder = ((await memo.locator('.memo-reader-date').first().textContent()) ?? '').split(' · ')[1].trim();
		expect(firstFolder).toContain(' › ');
		const folders = memo.getByRole('navigation', { name: '카테고리' });
		await folders.locator('li[data-folder-path="개발 기록/MacFolio/회고"] > .memo-folder-row .memo-folder').click();
		const retro = await openNth(memo, 1);
		expect(retro).not.toBe(first);

		const back = memo.getByRole('button', { name: '뒤로', exact: true });
		const box = (await back.boundingBox())!;
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		const menu = page.getByRole('menu', { name: '뒤로 기록' });
		await expect(menu).toBeVisible();
		await page.mouse.up();
		// 손을 떼도 한 칸 이동하지 않는다
		await expect.poll(() => readerTitle(memo)).toBe(retro);
		// 가까운 칸부터: 회고 폴더의 첫 글, 모든 글에서 본 첫 글
		const items = menu.getByRole('menuitem');
		await expect(items.last()).toContainText(first);
		await expect(items.last().locator('.ui-menu-item-detail')).toHaveText(firstFolder);
		await expect(menu.locator('.ui-menu-item-detail', { hasText: /^모든 글$/ })).toHaveCount(0);

		// 올려 강조하면 둘째 줄도 강조 글자색 (흐린 회색이 파란 바탕에 묻히지 않게)
		await items.last().hover();
		const colors = await items.last().evaluate((item) => ({
			label: getComputedStyle(item).color,
			detail: getComputedStyle(item.querySelector('.ui-menu-item-detail')!).color,
		}));
		expect(colors.detail).toBe(colors.label);
		await items.last().click();
		await expect.poll(() => readerTitle(memo)).toBe(first);
		await expect(folders.getByRole('button', { name: /^모든 글/ })).toHaveClass(/active/);
		await expect(memo.getByRole('button', { name: '앞으로', exact: true })).toBeEnabled();
	});
});
