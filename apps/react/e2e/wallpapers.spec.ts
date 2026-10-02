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
		expect(api.wallpapers).toMatchObject([{ name: '노을' }]);
		await expect.poll(() => desktopWallpaper(page)).toContain(`${FAKE_API}/files/`);
		// 브라우저에서 줄여서 보낸다: 원본·썸네일 모두 JPEG, 썸네일이 더 작다
		const [image, thumbnail] = api.uploads;
		expect(image.type).toBe('image/jpeg');
		expect(thumbnail.data.length).toBeLessThan(image.data.length);

		await page.reload();
		await page.locator('.loading-container').click();
		await expect.poll(() => desktopWallpaper(page)).toContain(`${FAKE_API}/files/`);
	});

	test('방문자는 더한 배경화면을 고를 수 있지만, 사진 추가 칸과 지우기는 없다', async ({ page }) => {
		const api = await fakeApi(page);
		api.wallpapers.push({
			id: 'wallpaper0000001',
			name: '바다',
			image: '/files/missing-image-01',
			thumbnail: '/files/missing-thumb-01',
		});
		await enterDesktop(page);
		const settings = await openWallpapers(page);
		const ios = settings.getByRole('radiogroup', { name: 'macOS 배경화면' });
		await ios.getByRole('radio', { name: '바다' }).click();
		await expect(ios.getByRole('radio', { name: '바다' })).toBeChecked();
		await expect.poll(() => desktopWallpaper(page)).toBe(`url('${FAKE_API}/files/missing-image-01')`);

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

	test('관리자는 오른쪽 클릭 메뉴로 이름을 바꾸고, 긴 이름은 칸 폭에서 자른다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		await enterDesktop(page);
		const settings = await openWallpapers(page);
		const mac = settings.getByRole('radiogroup', { name: 'macOS 배경화면' });
		await settings.getByLabel('macOS 배경화면 파일').setInputFiles({
			name: 'IMG_4021.jpg',
			mimeType: 'image/jpeg',
			buffer: await samplePhoto(page),
		});
		await mac.getByRole('radio', { name: 'IMG_4021' }).click({ button: 'right' });
		await page.getByRole('menu', { name: '배경화면 메뉴' }).getByRole('menuitem', { name: '이름 바꾸기…' }).click();
		const dialog = page.getByRole('dialog', { name: '배경화면 이름 바꾸기' });
		const input = dialog.getByRole('textbox', { name: '배경화면 이름' });
		await expect(input).toHaveValue('IMG_4021');
		await input.fill('   ');
		await expect(dialog.getByRole('button', { name: '저장' })).toBeDisabled();
		const long = '제주 바다 위로 해가 지는 저녁 무렵의 노을 사진';
		await input.fill(long);
		await input.press('Enter');
		await expect(dialog).toBeHidden();
		const renamed = mac.getByRole('radio', { name: long });
		await expect(renamed).toBeVisible();
		expect(api.wallpapers[0].name).toBe(long);
		// 이름은 한 줄로, 썸네일 폭을 넘지 않는다 (다 보려면 마우스를 올린다)
		const name = renamed.locator('.wallpaper-name');
		await expect(name).toHaveAttribute('title', long);
		const [nameBox, thumbBox] = await Promise.all([name.boundingBox(), renamed.locator('img').boundingBox()]);
		expect(nameBox!.width).toBeLessThanOrEqual(thumbBox!.width);
		expect(nameBox!.height).toBeLessThan(30);
	});

	test('사진 추가… 칸은 더한 배경화면 앞에 있고, ×는 왼쪽 위에 있다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		api.wallpapers.push({
			id: 'wallpaper0000001',
			name: '노을',
			image: '/files/a',
			thumbnail: '/files/b',
		});
		await enterDesktop(page);
		const settings = await openWallpapers(page);
		const grid = settings.getByRole('radiogroup', { name: 'macOS 배경화면' });
		const add = grid.getByRole('button', { name: 'macOS 배경화면 추가' });
		await expect(add).toContainText('사진 추가…');
		const tile = grid.getByRole('radio', { name: '노을' });
		const [addBox, tileBox, removeBox] = await Promise.all([
			add.boundingBox(),
			tile.boundingBox(),
			settings.getByRole('button', { name: '노을 배경화면 삭제' }).boundingBox(),
		]);
		expect(addBox!.x).toBeLessThan(tileBox!.x);
		expect(removeBox!.x).toBeLessThan(tileBox!.x + 10);
		expect(removeBox!.y).toBeLessThan(tileBox!.y + 10);
	});

	test('데스크톱에는 macOS 배경화면만 보이고, 처음에는 가로 한 줄이며 모두 보기로 펼친다', async ({ page }) => {
		const api = await fakeApi(page);
		for (const n of [1, 2, 3, 4]) {
			api.wallpapers.push({
				id: `wallpaper000000${n}`,
				name: `사진 ${n}`,
				image: `/files/a${n}`,
				thumbnail: `/files/b${n}`,
			});
		}
		await enterDesktop(page);
		const settings = await openWallpapers(page);
		await expect(settings.getByRole('radiogroup', { name: 'iOS 배경화면' })).toHaveCount(0);
		const grid = settings.getByRole('radiogroup', { name: 'macOS 배경화면' });
		const radios = grid.getByRole('radio');
		await expect(radios).toHaveCount(10);

		// 간략히 보기: 모두 한 줄 (같은 높이), 넘치는 것은 가로로 넘긴다
		const tops = async () =>
			new Set(await radios.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top))));
		expect((await tops()).size).toBe(1);
		expect(await grid.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);

		// 한 줄에서는 고른 배경화면(기본: High Sierra)이 보이는 자리에서 시작한다
		await expect(grid.getByRole('radio', { name: 'High Sierra' })).toBeInViewport();
		const toggle = settings.getByRole('button', { name: '모두 보기(10)' });
		await toggle.click();
		expect((await tops()).size).toBeGreaterThan(1);
		await settings.getByRole('button', { name: '간략히 보기' }).click();
		expect((await tops()).size).toBe(1);
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
