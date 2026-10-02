import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Page } from '@playwright/test';
import { fakeApi, FAKE_API } from './fakeApi';

/** 시험용 사진: 가로 1200×800 그라데이션 JPEG (브라우저 캔버스로 만든다) */
async function samplePhoto(page: Page, width = 1200, height = 800): Promise<Buffer> {
	const dataUrl = await page.evaluate(
		([w, h]) => {
			const canvas = document.createElement('canvas');
			canvas.width = w;
			canvas.height = h;
			const context = canvas.getContext('2d')!;
			const gradient = context.createLinearGradient(0, 0, w, h);
			gradient.addColorStop(0, '#ff9a8b');
			gradient.addColorStop(0.5, '#ff6a88');
			gradient.addColorStop(1, '#6a5acd');
			context.fillStyle = gradient;
			context.fillRect(0, 0, w, h);
			return canvas.toDataURL('image/jpeg', 0.9);
		},
		[width, height]
	);
	return Buffer.from(dataUrl.split(',')[1], 'base64');
}

async function openWallpapers(page: Page) {
	await dockItem(page, 'settings').click();
	const settings = appWindow(page, 'settings');
	await settings.getByRole('button', { name: '배경화면' }).click();
	return settings;
}

const desktopWallpaper = (page: Page) =>
	page.evaluate(() => document.documentElement.style.getPropertyValue('--wallpaper'));

test.describe('관리자가 더한 배경화면', () => {
	test('관리자는 + 칸으로 사진을 올리고, 올린 배경화면이 바로 적용되며 다시 열어도 유지된다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		await enterDesktop(page);
		const settings = await openWallpapers(page);
		const mac = settings.getByRole('radiogroup', { name: 'macOS 배경화면' });

		await settings.getByLabel('macOS 배경화면 파일').setInputFiles({
			name: '노을.jpg',
			mimeType: 'image/jpeg',
			buffer: await samplePhoto(page),
		});
		await expect(mac.getByRole('radio', { name: '노을' })).toBeChecked();
		expect(api.wallpapers).toMatchObject([{ kind: 'mac', name: '노을' }]);
		await expect.poll(() => desktopWallpaper(page)).toContain(`${FAKE_API}/files/`);
		// 브라우저에서 줄여서 보낸다: 원본·썸네일 모두 JPEG, 썸네일이 더 작다
		const [image, thumbnail] = api.uploads;
		expect(image.type).toBe('image/jpeg');
		expect(thumbnail.data.length).toBeLessThan(image.data.length);

		await page.reload();
		await page.locator('.loading-container').click();
		await expect.poll(() => desktopWallpaper(page)).toContain(`${FAKE_API}/files/`);
	});

	test('방문자는 더한 배경화면을 고를 수 있지만, + 칸과 지우기는 없다', async ({ page }) => {
		const api = await fakeApi(page);
		api.wallpapers.push({
			id: 'wallpaper0000001',
			kind: 'ios',
			name: '바다',
			image: '/files/missing-image-01',
			thumbnail: '/files/missing-thumb-01',
		});
		await enterDesktop(page);
		const settings = await openWallpapers(page);
		const ios = settings.getByRole('radiogroup', { name: 'iOS 배경화면' });
		await ios.getByRole('radio', { name: '바다' }).click();
		await expect(ios.getByRole('radio', { name: '바다' })).toBeChecked();
		await expect
			.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--wallpaper-mobile')))
			.toBe(`url('${FAKE_API}/files/missing-image-01')`);

		await expect(settings.getByRole('button', { name: /배경화면 추가/ })).toHaveCount(0);
		await expect(settings.getByRole('button', { name: /배경화면 삭제/ })).toHaveCount(0);
		await ios.getByRole('radio', { name: '바다' }).click({ button: 'right' });
		await expect(page.getByRole('menu', { name: '배경화면 메뉴' })).toHaveCount(0);
	});

	test('관리자가 지우면 목록에서 빠지고, 쓰던 배경화면은 기본 배경화면으로 돌아간다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		await enterDesktop(page);
		const settings = await openWallpapers(page);
		const mac = settings.getByRole('radiogroup', { name: 'macOS 배경화면' });
		await settings.getByLabel('macOS 배경화면 파일').setInputFiles({
			name: '노을.jpg',
			mimeType: 'image/jpeg',
			buffer: await samplePhoto(page),
		});
		await expect(mac.getByRole('radio', { name: '노을' })).toBeChecked();

		await settings.getByRole('button', { name: '노을 배경화면 삭제' }).click();
		const confirm = page.getByRole('alertdialog', { name: "'노을' 배경화면을 삭제할까요?" });
		await confirm.getByRole('button', { name: '삭제' }).click();
		await expect(mac.getByRole('radio', { name: '노을' })).toHaveCount(0);
		await expect(mac.getByRole('radio', { name: 'High Sierra' })).toBeChecked();
		expect(api.wallpapers).toEqual([]);
		await expect.poll(() => desktopWallpaper(page)).toContain('/imgs/wallpapers/highsierra.jpg');
	});

	test('골라 둔 배경화면이 서버에서 지워졌으면 다음에 열 때 기본 배경화면으로 돌아간다', async ({ page }) => {
		await fakeApi(page);
		await page.addInitScript(() =>
			localStorage.setItem(
				'macfolio:settings',
				JSON.stringify({ wallpaper: 'custom:gone', wallpaperImage: 'http://api.test/files/gone0000000000' })
			)
		);
		await enterDesktop(page);
		await expect.poll(() => desktopWallpaper(page)).toContain('/imgs/wallpapers/highsierra.jpg');
	});

	test('서버에 닿지 못하면 기본 배경화면만 보인다', async ({ page }) => {
		await fakeApi(page, { signedIn: true });
		await page.route(`${FAKE_API}/wallpapers`, (route) => route.abort());
		await enterDesktop(page);
		const settings = await openWallpapers(page);
		await expect(settings.getByRole('radiogroup', { name: 'macOS 배경화면' }).getByRole('radio')).toHaveCount(6);
	});
});
