import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * 실제 소리 대신, 소리를 튼 횟수를 센다. AudioContext를 가짜로 바꿔 끼우고
 * 버퍼를 틀 때(start)마다 기록한다. 불러온 파일도 기록해 누를 때·뗄 때 소리를 따로 쓰는지 본다.
 */
async function recordClickSounds(page: Page) {
	await page.addInitScript(() => {
		const w = window as unknown as { __clickSounds: number; __soundFiles: string[] };
		w.__clickSounds = 0;
		w.__soundFiles = [];
		const realFetch = window.fetch.bind(window);
		window.fetch = (input, init) => {
			const url = String(input instanceof Request ? input.url : input);
			if (url.includes('/sounds/')) w.__soundFiles.push(url.split('/').pop()!);
			return realFetch(input, init);
		};
		class FakeAudioContext {
			state = 'running';
			destination = {};
			createGain() {
				return { gain: { value: 1 }, connect() {} };
			}
			decodeAudioData() {
				return Promise.resolve({});
			}
			createBufferSource() {
				return {
					buffer: null,
					connect() {},
					start() {
						w.__clickSounds += 1;
					},
				};
			}
			resume() {
				return Promise.resolve();
			}
		}
		(window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
	});
	return {
		count: () => page.evaluate(() => (window as unknown as { __clickSounds: number }).__clickSounds),
		files: () => page.evaluate(() => (window as unknown as { __soundFiles: string[] }).__soundFiles),
	};
}

test.describe('클릭 소리', () => {
	test('로딩 화면에서는 시작음만 나고, 데스크톱에서는 누를 때·뗄 때 딸깍 소리가 난다', async ({ page }) => {
		const sounds = await recordClickSounds(page);
		await enterDesktop(page);
		// 로딩 화면을 누를 때는 소리를 미리 불러오기만 한다
		expect(await sounds.count()).toBe(0);
		await expect.poll(() => sounds.files()).toEqual(expect.arrayContaining(['mouse-down.mp3', 'mouse-up.mp3']));

		await dockItem(page, 'memo').click();
		await expect(appWindow(page, 'memo')).toBeVisible();
		await expect.poll(() => sounds.count()).toBe(2);

		// 오른쪽 단추는 소리 없이
		await appWindow(page, 'memo').click({ button: 'right', position: { x: 300, y: 300 } });
		await page.waitForTimeout(200);
		expect(await sounds.count()).toBe(2);
	});

	test('시스템 설정 → 사운드에서 끄면 소리가 나지 않고, 새로고침해도 꺼져 있다', async ({ page }) => {
		const sounds = await recordClickSounds(page);
		await enterDesktop(page);
		await dockItem(page, 'settings').click();
		const settings = appWindow(page, 'settings');
		await settings.getByRole('button', { name: '사운드' }).click();
		const toggle = settings.getByRole('switch', { name: /클릭 소리/ });
		await expect(toggle).toBeChecked();

		await toggle.click();
		await expect(toggle).not.toBeChecked();
		const before = await sounds.count();
		await dockItem(page, 'memo').click();
		await page.waitForTimeout(300);
		expect(await sounds.count()).toBe(before);

		await page.reload();
		await enterDesktop(page);
		await dockItem(page, 'settings').click();
		await appWindow(page, 'settings').getByRole('button', { name: '사운드' }).click();
		await expect(appWindow(page, 'settings').getByRole('switch', { name: /클릭 소리/ })).not.toBeChecked();
	});
});
