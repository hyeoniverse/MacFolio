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

	test('데스크톱은 배경 음악을 틀므로 음악 앱이 처음부터 실행 중이다', async ({ page }) => {
		await enterDesktop(page);
		await expect(dockItem(page, 'music').locator('.active-indicator')).toBeVisible();
		// 창은 내려 두어 맨 앞은 그대로 Safari, Dock을 누르면 음악 창이 올라온다
		await expect(appWindow(page, 'music')).toBeHidden();
		await expect(page.getByRole('contentinfo', { name: '재생 막대' })).toHaveCount(0);
		await dockItem(page, 'music').click();
		await expect(appWindow(page, 'music')).toBeVisible();
	});

	test('셔플 버튼을 여러 번 눌러도 재생 막대에는 지금 곡 하나만 보인다', async ({ page }) => {
		const music = await openMusic(page);
		const shuffle = music.locator('.music-pill-shuffle');
		for (let i = 0; i < 5; i++) await shuffle.click();
		const now = music.getByRole('button', { name: '지금 재생 중 열기' });
		await expect(now.locator('img')).toHaveCount(1);
		await expect(now.locator('strong')).toHaveCount(1);
	});

	test('지금 재생 중을 열고 다시 그려도 시트가 아래로 내려가는 움직임이 되풀이되지 않는다', async ({ page }) => {
		// 사라지는 움직임은 움직임 줄이기를 끈 화면에서만 돈다
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		const music = await openMusic(page);
		await music.getByRole('button', { name: '지금 재생 중 열기' }).click();
		const sheet = music.getByRole('dialog', { name: '지금 재생 중' });
		await expect(sheet).toBeVisible();
		// 시트 안의 버튼으로 상태를 바꿔 시트를 다시 그린다 (재생 시간이 바뀔 때와 같다)
		// 사라지는 움직임의 복사본은 금방 지워지므로, 생기는 순간을 센다
		await page.evaluate(() => {
			const win = window as Window & { exitingGhosts?: number };
			win.exitingGhosts = 0;
			new MutationObserver((records) => {
				for (const record of records)
					for (const node of record.addedNodes)
						if (node instanceof HTMLElement && node.dataset.exiting) win.exitingGhosts! += 1;
			}).observe(document.body, { childList: true, subtree: true });
		});
		const shuffle = sheet.getByRole('button', { name: '셔플' });
		await shuffle.click();
		await shuffle.click();
		await expect(shuffle).toHaveAttribute('aria-pressed', 'false');
		expect(await page.evaluate(() => (window as Window & { exitingGhosts?: number }).exitingGhosts)).toBe(0);
		await expect(sheet).toBeVisible();
	});

	test('다음 곡 버튼으로 대기열의 다음 곡으로 넘어간다', async ({ page }) => {
		const music = await openMusic(page);
		const bar = music.getByRole('contentinfo', { name: '재생 막대' });
		await expect(bar).toContainText('Inochi No Namae');
		await bar.getByRole('button', { name: '다음 곡' }).click();
		await expect(bar).toContainText('Itsumo Nando Demo');
	});

	test('좁은 창에서는 제목이 신호등 버튼 아래에 있고, 곡 목록에서 보관함으로 돌아온다', async ({ page }) => {
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

test('재생과 일시 정지를 오가도 버튼이 움직이지 않는다 (아이콘 폭이 달라도)', async ({ page }) => {
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
