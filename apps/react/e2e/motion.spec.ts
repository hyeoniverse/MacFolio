import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Page } from '@playwright/test';

const bar = (page: Page) => page.getByRole('group', { name: '메뉴 막대' });

/** 사라지는 복사본(useExitMotion)이 생길 때마다 그 움직임 이름을 적는다 */
async function recordExits(page: Page) {
	await page.evaluate(() => {
		const seen: string[] = [];
		(window as unknown as { __exits: string[] }).__exits = seen;
		new MutationObserver((records) => {
			for (const record of records)
				for (const node of record.addedNodes)
					if (node instanceof HTMLElement && node.dataset.exiting) seen.push(node.dataset.exiting);
		}).observe(document.body, { childList: true, subtree: true });
	});
	return () => page.evaluate(() => (window as unknown as { __exits: string[] }).__exits);
}

test.describe('움직임: 나타나고 사라지기, 화면 바뀌기', () => {
	// 다른 시험은 움직임 줄이기로 돈다 (playwright.config.ts). 여기서는 움직임을 켠다
	test.use({ reducedMotion: 'no-preference' });

	test('메뉴는 닫히면 바로 닫히고(역할 없음), 겉모습만 잠깐 남아 작아지며 사라진다', async ({ page }) => {
		await enterDesktop(page);
		const exits = await recordExits(page);
		await bar(page).getByRole('button', { name: '파일', exact: true }).click();
		const menu = page.getByRole('menu', { name: '파일', exact: true });
		await expect(menu).toBeVisible();
		// 열 때는 pop-in
		expect(await menu.evaluate((element) => getComputedStyle(element).animationName)).toBe('pop-in');

		await page.keyboard.press('Escape');
		// 메뉴는 바로 닫힌다: 역할로는 찾을 수 없다
		await expect(page.getByRole('menu')).toHaveCount(0);
		// 복사본: 누를 수 없고 화면 읽기 프로그램에 보이지 않으며, 움직임이 끝나면 없어진다
		await expect.poll(exits).toEqual(['pop-out']);
		await expect(page.locator('[data-exiting]')).toHaveCount(0);
	});

	test('움직임 줄이기를 켜면 복사본을 남기지 않는다', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await enterDesktop(page);
		const exits = await recordExits(page);
		await bar(page).getByRole('button', { name: '파일', exact: true }).click();
		await page.keyboard.press('Escape');
		await expect(page.getByRole('menu')).toHaveCount(0);
		await page.waitForTimeout(300);
		expect(await exits()).toEqual([]);
	});

	test('경고창·단축키 창은 바탕이 흐려지며 사라진다', async ({ page }) => {
		await enterDesktop(page);
		const exits = await recordExits(page);
		await bar(page).getByRole('button', { name: '도움말', exact: true }).click();
		await page.getByRole('menuitem', { name: /키보드 단축키/ }).click();
		const dialog = page.getByRole('dialog', { name: '키보드 단축키' });
		await expect(dialog).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(dialog).toHaveCount(0);
		// 메뉴(pop-out) 다음에 단축키 창(fade-out)
		await expect.poll(exits).toEqual(['pop-out', 'fade-out']);
	});

	test('Finder에서 보기를 바꾸면 내용이 새로 그려지며 서서히 나타난다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'finder').click();
		const finder = appWindow(page, 'finder');
		const content = finder.locator('.finder-content .motion-swap').first();
		await expect(content).toBeVisible();
		await content.evaluate((element) => element.setAttribute('data-before', 'yes'));
		// 보기를 바꾸면 (들어가고 나오는 것이 아니라) 서서히
		await finder.getByRole('button', { name: '목록으로 보기' }).first().click();
		const next = finder.locator('.finder-content .motion-swap').first();
		await expect(next).not.toHaveAttribute('data-before');
		expect(await next.evaluate((element) => getComputedStyle(element).animationName)).toBe('fade-in');
	});

	test('누를 수 있는 것은 바탕·글자 색이 부드럽게 바뀐다 (자기 전환이 있는 것은 그것을 따른다)', async ({ page }) => {
		await enterDesktop(page);
		const transition = (element: Element) => getComputedStyle(element).transitionProperty;
		const property = await bar(page).getByRole('button', { name: '파일', exact: true }).evaluate(transition);
		expect(property).toContain('background-color');
		expect(property).toContain('color');
		// Dock 아이콘은 자기 전환(커지기)을 그대로 쓴다: 공통 규칙은 층 안이라 진다
		expect(await dockItem(page, 'finder').evaluate(transition)).toBe('transform');
	});

	test('사진: 넘긴 쪽에서 사진이 들어오고, 정보 판은 오른쪽에서 들어왔다 나간다', async ({ page }) => {
		await enterDesktop(page);
		const exits = await recordExits(page);
		await dockItem(page, 'photos').click();
		const photos = appWindow(page, 'photos');
		await photos.getByRole('complementary', { name: '사진 보관함' }).getByRole('button', { name: /^QRU/ }).click();
		await photos.locator('.photos-thumb').nth(1).click();
		const stage = photos.locator('.photos-viewer-stage');
		const image = stage.locator('img');
		const animationOf = () => image.evaluate((element) => getComputedStyle(element).animationName);
		await page.keyboard.press('ArrowRight');
		await expect(stage).toHaveAttribute('data-direction', 'next');
		expect(await animationOf()).toBe('slide-from-right');
		await page.keyboard.press('ArrowLeft');
		await expect(stage).toHaveAttribute('data-direction', 'prev');
		expect(await animationOf()).toBe('slide-from-left');

		const info = photos.getByRole('button', { name: '정보' });
		await info.click();
		const panel = photos.getByRole('complementary', { name: '사진 정보' });
		expect(await panel.evaluate((element) => getComputedStyle(element).animationName)).toBe('panel-in-right');
		await info.click();
		await expect(panel).toHaveCount(0);
		await expect.poll(exits).toContain('panel-out-right');
	});

	test('Finder: 폴더로 들어가면 오른쪽에서, 뒤로 가면 왼쪽에서 들어온다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'finder').click();
		const finder = appWindow(page, 'finder');
		const content = finder.locator('.finder-content');
		await finder.getByRole('navigation', { name: '즐겨찾기' }).getByRole('button').nth(1).click();
		await expect(content).toHaveAttribute('data-direction', 'next');
		expect(
			await content
				.locator('.motion-swap')
				.first()
				.evaluate((element) => getComputedStyle(element).animationName)
		).toBe('slide-from-right');
		await finder.getByRole('button', { name: '뒤로' }).first().click();
		await expect(content).toHaveAttribute('data-direction', 'prev');
	});

	test('배경화면을 바꾸면 옛 배경이 흐려지며 새 배경이 드러난다', async ({ page }) => {
		await enterDesktop(page);
		await page.evaluate(() => {
			const seen: string[] = [];
			(window as unknown as { __fades: string[] }).__fades = seen;
			new MutationObserver((records) => {
				for (const record of records)
					for (const node of record.addedNodes)
						if (node instanceof HTMLElement && node.classList.contains('wallpaper-fade'))
							seen.push(node.style.animationName || node.style.animation);
			}).observe(document.body, { childList: true, subtree: true });
		});
		await dockItem(page, 'settings').click();
		const settings = appWindow(page, 'settings');
		await settings.getByRole('button', { name: '배경화면' }).click();
		await settings.getByRole('radiogroup', { name: 'macOS 배경화면' }).getByRole('radio', { name: 'Sonoma' }).click();
		await expect
			.poll(() => page.evaluate(() => (window as unknown as { __fades: string[] }).__fades.join()))
			.toContain('fade-out');
		await expect(page.locator('.wallpaper-fade')).toHaveCount(0);
	});
});
