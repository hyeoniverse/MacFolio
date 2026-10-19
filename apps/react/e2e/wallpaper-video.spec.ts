import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Page } from '@playwright/test';
import { fakeApi, FAKE_API } from './fakeApi';

/**
 * 시험용 MP4: 색이 바뀌는 캔버스를 브라우저의 MediaRecorder로 1초 녹화한다 (VP9을 담은 MP4).
 * 시험용 Chromium은 H.264를 풀지 못해서 브라우저가 직접 만든 MP4를 쓴다
 */
async function sampleVideo(page: Page): Promise<Buffer> {
	const base64 = await page.evaluate(async () => {
		const canvas = document.createElement('canvas');
		canvas.width = 320;
		canvas.height = 200;
		const context = canvas.getContext('2d')!;
		const recorder = new MediaRecorder(canvas.captureStream(30), { mimeType: 'video/mp4;codecs=vp9' });
		const chunks: Blob[] = [];
		recorder.ondataavailable = (event) => chunks.push(event.data);
		const stopped = new Promise((resolve) => (recorder.onstop = resolve));
		recorder.start();
		const started = performance.now();
		await new Promise<void>((resolve) => {
			const draw = () => {
				const t = (performance.now() - started) / 1000;
				context.fillStyle = `hsl(${Math.round(t * 300) % 360} 70% 55%)`;
				context.fillRect(0, 0, 320, 200);
				if (t < 1) requestAnimationFrame(draw);
				else resolve();
			};
			draw();
		});
		recorder.stop();
		await stopped;
		const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
		let binary = '';
		for (const byte of bytes) binary += String.fromCharCode(byte);
		return btoa(binary);
	});
	return Buffer.from(base64, 'base64');
}

async function openWallpapers(page: Page) {
	await dockItem(page, 'settings').click();
	const settings = appWindow(page, 'settings');
	await settings.getByRole('button', { name: '배경화면' }).click();
	return settings;
}

const desktopWallpaper = (page: Page) =>
	page.evaluate(() => document.documentElement.style.getPropertyValue('--wallpaper'));

const VIDEO_WALLPAPER = {
	id: 'wallpaper0000009',
	name: '파도',
	image: '/files/fakeupload900001',
	thumbnail: '/files/fakeupload900002',
	video: true,
};

/** 서버에 동영상 배경화면 하나를 미리 둔다 (MP4와 포스터 파일까지) */
async function seedVideoWallpaper(page: Page, api: Awaited<ReturnType<typeof fakeApi>>) {
	await page.goto('/');
	const video = await sampleVideo(page);
	api.uploads.push(
		{ id: 'fakeupload900001', name: '파도.mp4', type: 'video/mp4', image: false, data: video },
		{ id: 'fakeupload900002', name: 'thumb.jpg', type: 'image/jpeg', image: true, data: Buffer.from([0xff, 0xd8]) }
	);
	api.wallpapers.push(VIDEO_WALLPAPER);
}

test.describe('동영상 배경화면', () => {
	// 시험은 기본으로 움직임 줄이기를 켜 둔다 (playwright.config.ts). 동영상은 그때 틀지 않으니 여기서는 끈다
	test.beforeEach(async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'no-preference' });
	});

	test('관리자가 MP4를 올리면 원본 그대로 보내고, 포스터를 만들어 썸네일로 쓰며 바로 배경에서 튼다', async ({
		page,
	}) => {
		const api = await fakeApi(page, { signedIn: true });
		await enterDesktop(page);
		const settings = await openWallpapers(page);
		const custom = settings.getByRole('radiogroup', { name: '추가한 배경화면' });
		const video = await sampleVideo(page);

		await settings
			.getByLabel('macOS 배경화면 파일')
			.setInputFiles({ name: '파도.mp4', mimeType: 'video/mp4', buffer: video });
		const radio = custom.getByRole('radio', { name: '파도 (동영상)' });
		await expect(radio).toBeChecked();
		await expect(radio.locator('.wallpaper-video-badge')).toBeVisible();

		// 원본은 줄이지 않은 MP4 그대로, 썸네일은 브라우저가 한 장면을 그린 JPEG
		const [image, thumbnail] = api.uploads;
		expect(image.type).toBe('video/mp4');
		expect(image.data.equals(video)).toBe(true);
		expect(thumbnail.type).toBe('image/jpeg');
		expect(api.wallpapers).toMatchObject([{ name: '파도', video: true }]);

		// 배경에는 포스터가 깔리고, 그 위에서 동영상이 소리 없이 반복 재생된다
		const player = page.locator('video.wallpaper-video');
		await expect(player).toHaveAttribute('src', `${FAKE_API}${api.wallpapers[0].image}`);
		await expect.poll(() => desktopWallpaper(page)).toBe(`url('${FAKE_API}${api.wallpapers[0].thumbnail}')`);
		await expect
			.poll(() => player.evaluate((v: HTMLVideoElement) => ({ muted: v.muted, loop: v.loop, paused: v.paused })))
			.toEqual({ muted: true, loop: true, paused: false });
		await expect(player).toHaveCSS('object-fit', 'cover');

		// 다시 열어도 동영상 배경화면이 그대로다
		await page.reload();
		await page.locator('.loading-container').click();
		await expect(page.locator('video.wallpaper-video')).toHaveAttribute('src', /\/files\//);

		// 사진을 고르면 동영상은 사라진다
		await enterDesktop(page);
		const again = await openWallpapers(page);
		await again.getByRole('radio', { name: 'High Sierra' }).click();
		await expect(page.locator('video.wallpaper-video')).toHaveCount(0);
	});

	test('움직이는 GIF는 줄이지 않고 원본 그대로 올린다 (줄이면 첫 장면만 남는다)', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		await enterDesktop(page);
		const settings = await openWallpapers(page);
		// 1×1 GIF 두 장면 (빨강, 파랑)
		const gif = Buffer.from(
			'R0lGODlhAQABAPAAAP8AAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQACgAAACwAAAAAAQABAAACAkQBACH5BAAKAAAALAAAAAABAAEAgAAA/wAAAAICRAEAOw==',
			'base64'
		);
		await settings
			.getByLabel('macOS 배경화면 파일')
			.setInputFiles({ name: '반짝.gif', mimeType: 'image/gif', buffer: gif });
		await expect(settings.getByRole('radio', { name: '반짝' })).toBeChecked();
		const [image, thumbnail] = api.uploads;
		expect(image.type).toBe('image/gif');
		expect(image.data.equals(gif)).toBe(true);
		expect(thumbnail.type).toBe('image/jpeg');
		expect(api.wallpapers).toMatchObject([{ name: '반짝', video: false }]);
		await expect.poll(() => desktopWallpaper(page)).toBe(`url('${FAKE_API}${api.wallpapers[0].image}')`);
		await expect(page.locator('video.wallpaper-video')).toHaveCount(0);
	});

	test('방문자도 고를 수 있고, 탭이 가려지면 멈췄다가 다시 보이면 이어서 튼다', async ({ page }) => {
		const api = await fakeApi(page);
		await seedVideoWallpaper(page, api);
		await enterDesktop(page);
		const settings = await openWallpapers(page);
		await settings.getByRole('radio', { name: '파도 (동영상)' }).click();

		const player = page.locator('video.wallpaper-video');
		await expect.poll(() => player.evaluate((v: HTMLVideoElement) => v.paused)).toBe(false);

		const setHidden = (hidden: boolean) =>
			page.evaluate((value) => {
				Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
				document.dispatchEvent(new Event('visibilitychange'));
			}, hidden);
		await setHidden(true);
		await expect.poll(() => player.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
		await setHidden(false);
		await expect.poll(() => player.evaluate((v: HTMLVideoElement) => v.paused)).toBe(false);
	});

	test('움직임 줄이기를 켜면 동영상 대신 멈춘 포스터만 보인다', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await seedVideoWallpaper(page, await fakeApi(page));
		await enterDesktop(page);
		const settings = await openWallpapers(page);
		await settings.getByRole('radio', { name: '파도 (동영상)' }).click();
		await expect.poll(() => desktopWallpaper(page)).toBe(`url('${FAKE_API}${VIDEO_WALLPAPER.thumbnail}')`);
		await expect(page.locator('video.wallpaper-video')).toHaveCount(0);

		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await expect(page.locator('video.wallpaper-video')).toHaveCount(1);
	});

	test('휴대폰 홈 화면에서도 동영상 배경화면을 아이콘 아래에 깐다', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await seedVideoWallpaper(page, await fakeApi(page));
		await page.addInitScript(
			([wallpaper, api]) => {
				localStorage.setItem(
					'macfolio:settings',
					JSON.stringify({
						mobileWallpaper: `custom:${wallpaper.id}`,
						mobileWallpaperImage: `${api}${wallpaper.thumbnail}`,
						mobileWallpaperVideo: `${api}${wallpaper.image}`,
					})
				);
			},
			[VIDEO_WALLPAPER, FAKE_API] as const
		);
		await enterDesktop(page);
		const player = page.locator('.mobile-home > video.wallpaper-video');
		await expect(player).toHaveAttribute('src', `${FAKE_API}${VIDEO_WALLPAPER.image}`);
		await expect(player).toHaveCSS('z-index', '-1');
	});
});
