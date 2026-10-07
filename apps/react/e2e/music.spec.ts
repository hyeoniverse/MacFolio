import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Page } from '@playwright/test';

async function openMusic(page: Page) {
	await enterDesktop(page);
	await dockItem(page, 'music').click();
	const music = appWindow(page, 'music');
	await expect(music).toBeVisible();
	return music;
}

test.describe('음악', () => {
	test('재생 목록을 고르면 곡 목록이 바뀐다', async ({ page }) => {
		const music = await openMusic(page);
		const sidebar = music.getByRole('navigation', { name: '보관함' });

		await sidebar.getByRole('button', { name: /지브리/ }).click();
		await expect(music.getByRole('heading', { name: '지브리' })).toBeVisible();
		await expect(music.locator('.music-track')).toHaveCount(3);

		await sidebar.getByRole('button', { name: /모든 노래/ }).click();
		await expect(music.locator('.music-track')).toHaveCount(7);
	});

	test('곡을 누르면 재생 막대와 곡 목록에 지금 곡이 표시된다', async ({ page }) => {
		const music = await openMusic(page);
		await music
			.getByRole('navigation', { name: '보관함' })
			.getByRole('button', { name: /애니메이션 OST/ })
			.click();
		await music.locator('.music-track', { hasText: 'Affections Touching Across Time' }).click();

		await expect(music.locator('.music-track[aria-current]')).toContainText('Affections Touching Across Time');
		await expect(music.getByRole('contentinfo', { name: '재생 막대' })).toContainText(
			'Affections Touching Across Time'
		);
	});

	test('셔플, 반복, 다음 재생 목록', async ({ page }) => {
		const music = await openMusic(page);
		const bar = music.getByRole('contentinfo', { name: '재생 막대' });

		const shuffle = bar.getByRole('button', { name: '셔플' });
		await shuffle.click();
		await expect(shuffle).toHaveAttribute('aria-pressed', 'true');

		// 전체 반복 → 한 곡 반복 → 끔
		await bar.getByRole('button', { name: '전체 반복' }).click();
		await bar.getByRole('button', { name: '한 곡 반복' }).click();
		await expect(bar.getByRole('button', { name: '반복 끔' })).toBeVisible();

		await bar.getByRole('button', { name: '다음 재생' }).click();
		const upNext = music.getByRole('region', { name: '다음 재생' });
		await expect(upNext).toBeVisible();
		// 지금 곡을 뺀 나머지 6곡
		await expect(upNext.getByRole('button')).toHaveCount(6);
	});

	test('다음 곡 버튼으로 대기열의 다음 곡으로 넘어간다', async ({ page }) => {
		const music = await openMusic(page);
		const bar = music.getByRole('contentinfo', { name: '재생 막대' });
		await expect(bar).toContainText('Inochi No Namae');
		await bar.getByRole('button', { name: '다음 곡' }).click();
		await expect(bar).toContainText('Itsumo Nando Demo');
	});

	test('좁은 창에서는 제목이 신호등 단추 아래에 있고, 곡 목록에서 보관함으로 돌아온다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'music').click();
		const music = appWindow(page, 'music');
		await music.evaluate((el) => {
			(el as HTMLElement).style.width = '380px';
			(el as HTMLElement).style.height = '640px';
		});
		const lights = await music.locator('.traffic-lights').boundingBox();
		const title = await music.getByRole('heading', { name: '보관함' }).boundingBox();
		expect(title!.y).toBeGreaterThanOrEqual(lights!.y + lights!.height);

		await music
			.getByRole('button', { name: /지브리/ })
			.first()
			.click();
		const back = music.getByRole('button', { name: '보관함', exact: true });
		await expect(back).toBeVisible();
		const backBox = await back.boundingBox();
		expect(backBox!.y).toBeGreaterThanOrEqual(lights!.y + lights!.height);
		await back.click();
		await expect(music.getByRole('heading', { name: '보관함' })).toBeVisible();
	});
});

test('재생과 일시 정지를 오가도 단추가 움직이지 않는다 (아이콘 폭이 달라도)', async ({ page }) => {
	await enterDesktop(page);
	await dockItem(page, 'music').click();
	const play = page.locator('.music-play');
	await expect(play).toBeVisible();
	const layout = () =>
		page.evaluate(() => {
			const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
			return {
				play: box('.music-play').width,
				next: box('.music-play + button').x,
				previous: box('.music-transport button:has(+ .music-play)').x,
				bar: box('.macos-statusbar [aria-label="다음 곡"]').x,
			};
		});
	const before = await layout();
	await play.click();
	await expect(play).toHaveAttribute('aria-label', /재생|일시 정지/);
	await page.waitForTimeout(100);
	expect(await layout()).toEqual(before);
});
