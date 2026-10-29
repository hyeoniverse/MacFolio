import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Locator, Page } from '@playwright/test';
import { fakeApi } from './fakeApi';

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

	test('누른 채 목록 위로 옮기면 그 항목이 강조되고, 손을 떼면 그 칸으로 간다', async ({ page }) => {
		const memo = await openMemo(page);
		const first = await openNth(memo, 0);
		await openNth(memo, 1);
		const back = memo.getByRole('button', { name: '뒤로', exact: true });
		const box = (await back.boundingBox())!;
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		const menu = page.getByRole('menu', { name: '뒤로 기록' });
		await expect(menu).toBeVisible();
		const item = menu.getByRole('menuitem').last();
		await expect(item).toContainText(first);
		const target = (await item.boundingBox())!;
		await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 6 });
		await expect(item).toHaveClass(/is-tracked/);
		const background = await item.evaluate((el) => getComputedStyle(el).backgroundColor);
		expect(background).not.toBe('rgba(0, 0, 0, 0)');
		await page.mouse.up();
		await expect(menu).toBeHidden();
		await expect.poll(() => readerTitle(memo)).toBe(first);
	});

	test('기록 목록은 바깥(메뉴 막대 포함)을 누르거나, 브라우저 창이 포커스를 잃으면 닫힌다', async ({ page }) => {
		const memo = await openMemo(page);
		await openNth(memo, 0);
		await openNth(memo, 1);
		const back = memo.getByRole('button', { name: '뒤로', exact: true });
		const menu = page.getByRole('menu', { name: '뒤로 기록' });

		// 사이트의 메뉴 막대를 누르면 닫힌다
		await back.click({ button: 'right' });
		await expect(menu).toBeVisible();
		await page.locator('.macos-statusbar').click({ position: { x: 800, y: 10 } });
		await expect(menu).toBeHidden();

		// 브라우저의 탭·주소 막대처럼 페이지 밖을 누르면 창이 포커스를 잃는다 (blur)
		await back.click({ button: 'right' });
		await expect(menu).toBeVisible();
		await page.evaluate(() => window.dispatchEvent(new Event('blur')));
		await expect(menu).toBeHidden();
	});

	test('새로 고쳐도 기록이 남고(같은 탭), 새 탭은 따로 시작한다', async ({ page, context }) => {
		const memo = await openMemo(page);
		const first = await openNth(memo, 1);
		const second = await openNth(memo, 2);
		// 주소 막대가 지금 글을 가리키므로, 같은 주소로 다시 열면 그 글이 열린다
		await expect(page).toHaveURL(/\/memo\/[^/]+$/);
		await enterDesktop(page, new URL(page.url()).pathname);
		const reopened = appWindow(page, 'memo');
		await expect.poll(() => readerTitle(reopened)).toBe(second);
		const back = reopened.getByRole('button', { name: '뒤로', exact: true });
		await expect(back).toBeEnabled();
		await back.click();
		await expect.poll(() => readerTitle(reopened)).toBe(first);
		await expect(reopened.getByRole('button', { name: '앞으로', exact: true })).toBeEnabled();

		// 다른 탭: sessionStorage가 따로라 기록이 비어 있다
		const other = await context.newPage();
		const otherMemo = await openMemo(other);
		await expect(otherMemo.getByRole('button', { name: '뒤로', exact: true })).toBeDisabled();
		await other.close();
	});

	for (const admin of [false, true])
		test(`뒤로·앞으로 돌아온 글은 떠날 때의 스크롤 위치에서 시작한다 (${admin ? '편집 화면' : '읽기 화면'})`, async ({
			page,
		}) => {
			if (admin) await fakeApi(page, { signedIn: true });
			const memo = await openMemo(page);
			const scroller = memo.locator('.memo-scroll:has(> .memo-reader-compact-bar)');
			const scrollTop = () => scroller.evaluate((el) => el.scrollTop);
			const scrollTo = async (top: number) => {
				await scroller.evaluate((el, value) => el.scrollTo({ top: value }), top);
				await expect.poll(scrollTop).toBe(top);
			};
			const back = memo.getByRole('button', { name: '뒤로', exact: true });
			const forward = memo.getByRole('button', { name: '앞으로', exact: true });

			const first = await openNth(memo, 1);
			await scrollTo(900);
			const second = await openNth(memo, 2);
			// 새로 연 글은 맨 위부터
			await expect.poll(scrollTop).toBe(0);
			await scrollTo(400);

			await back.click();
			await expect.poll(() => readerTitle(memo)).toBe(first);
			await expect.poll(scrollTop).toBe(900);
			await forward.click();
			await expect.poll(() => readerTitle(memo)).toBe(second);
			await expect.poll(scrollTop).toBe(400);
		});
});
