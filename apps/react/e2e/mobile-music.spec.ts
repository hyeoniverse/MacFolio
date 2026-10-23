import { test, expect, appWindow } from './fixtures';
import type { Page } from '@playwright/test';

// 휴대폰 음악 앱: 지금 재생 중(iOS 18 구성)과 로딩 화면을 누른 뒤의 배경 음악

/** 로딩 화면을 탭해 넘기고 홈 화면에 들어간다 */
async function enterHome(page: Page) {
	await page.goto('/');
	const loading = page.locator('.loading-container');
	await expect(loading).toContainText('탭하여');
	await loading.tap();
	await expect(loading).toBeHidden({ timeout: 20_000 });
}

/** 음악 앱에서 지브리의 'Merry-Go-Round of Life'를 재생하고 지금 재생 중을 연다 */
async function openNowPlaying(page: Page) {
	await enterHome(page);
	await page.locator('.mobile-home').getByRole('button', { name: '음악', exact: true }).tap();
	const music = appWindow(page, 'music');
	await music.getByRole('button', { name: '플레이리스트', exact: true }).tap();
	await music.getByRole('button', { name: /지브리/ }).tap();
	await music.locator('.music-track', { hasText: 'Merry-Go-Round of Life' }).tap();
	await music.getByRole('button', { name: '지금 재생 중 열기' }).tap();
	const sheet = music.getByRole('dialog', { name: '지금 재생 중' });
	await expect(sheet).toBeVisible();
	return { music, sheet };
}

/**
 * iPhone Safari(WebKit)의 소리 재생 규칙을 흉내 낸다: 요소마다 탭·클릭 처리 중에 처음 play()해야 허용되고,
 * 한 번 허용된 요소는 그 뒤 제스처 없이도 재생된다. Playwright의 Chromium은 이 규칙이 없어(자동 재생 허용) 직접 건다
 */
async function emulateWebKitAutoplay(page: Page) {
	await page.addInitScript(() => {
		const allowed = new WeakSet<HTMLMediaElement>();
		let gesture = false;
		for (const type of ['click', 'touchend', 'keydown'])
			window.addEventListener(
				type,
				() => {
					gesture = true;
					setTimeout(() => (gesture = false), 0);
				},
				true
			);
		const play = HTMLMediaElement.prototype.play;
		HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
			if (gesture) allowed.add(this);
			if (!allowed.has(this)) return Promise.reject(new DOMException('사용자 제스처 없음', 'NotAllowedError'));
			return play.call(this);
		};
	});
}

/**
 * 요소 안에 그려진 밝은 픽셀(흰 아이콘, 바탕과 아이콘 밝기의 중간값 초과)의 오른쪽 끝 x (CSS px). 글리프 상자가 아니라 화면에 보이는 그림의 끝을 잰다.
 * Font Awesome 글리프는 상자(1.25em) 안쪽에 여백을 두고 그려지므로 상자 좌표로는 보이는 끝을 알 수 없다
 */
async function inkRight(page: Page, locator: ReturnType<Page['locator']>) {
	const box = (await locator.boundingBox())!;
	const png = (await page.screenshot({ clip: box })).toString('base64');
	const ratio = await page.evaluate(() => devicePixelRatio);
	const right = await page.evaluate(async (data) => {
		const image = new Image();
		image.src = `data:image/png;base64,${data}`;
		await image.decode();
		const canvas = document.createElement('canvas');
		canvas.width = image.width;
		canvas.height = image.height;
		const context = canvas.getContext('2d')!;
		context.drawImage(image, 0, 0);
		const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
		// 밝기: 바탕(가장 어두운 값)과 아이콘(가장 밝은 값)의 가운데를 넘는 픽셀을 그림으로 본다
		const light = (at: number) => (pixels[at] + pixels[at + 1] + pixels[at + 2]) / 3;
		let darkest = 255;
		let brightest = 0;
		for (let at = 0; at < pixels.length; at += 4) {
			darkest = Math.min(darkest, light(at));
			brightest = Math.max(brightest, light(at));
		}
		const threshold = (darkest + brightest) / 2;
		let max = -1;
		for (let y = 0; y < canvas.height; y++)
			for (let x = 0; x < canvas.width; x++) if (light((y * canvas.width + x) * 4) > threshold) max = Math.max(max, x);
		return max + 1;
	}, png);
	return box.x + right / ratio;
}

/** 배경 음악(body의 audio)이 멈춰 있는지 */
const audioPaused = (page: Page) => page.evaluate(() => document.querySelector('audio')?.paused ?? true);

test.describe('음악: 지금 재생 중', () => {
	test('대기열 버튼으로 표지 화면과 대기열 화면을 오간다: 셔플·반복, 다음 재생 목록에서 곡 고르기와 순서 바꾸기', async ({
		page,
	}) => {
		const { music, sheet } = await openNowPlaying(page);
		const queueRegion = sheet.getByRole('region', { name: '다음 재생' });
		const queueButton = sheet.getByRole('button', { name: '대기열' });
		await expect(queueRegion).toHaveCount(0);
		await expect(queueButton).toHaveAttribute('aria-pressed', 'false');

		await queueButton.tap();
		await expect(queueButton).toHaveAttribute('aria-pressed', 'true');
		await expect(queueRegion).toBeVisible();
		await expect(queueRegion).toContainText('지브리에서 재생 중');
		// 지브리 3곡 중 지금 곡을 뺀 2곡. 끝에 닿으면 처음부터 이어진다
		const titles = queueRegion.locator('.music-queue-track strong');
		await expect(titles).toHaveText(['Inochi No Namae', 'Itsumo Nando Demo']);
		// 표지는 제목 옆 썸네일로 줄어든다
		expect((await sheet.locator('.music-now-art').boundingBox())!.width).toBeLessThan(80);

		// 셔플·반복은 대기열 화면의 캡슐 버튼
		const shuffle = sheet.getByRole('button', { name: '셔플' });
		await shuffle.tap();
		await expect(shuffle).toHaveAttribute('aria-pressed', 'true');
		await shuffle.tap();
		await sheet.getByRole('button', { name: '전체 반복' }).tap();
		await expect(sheet.getByRole('button', { name: '한 곡 반복' })).toContainText('1');
		await sheet.getByRole('button', { name: '한 곡 반복' }).tap();
		await expect(sheet.getByRole('button', { name: '반복 끔' })).toBeVisible();

		// 손잡이로 순서를 바꾼다 (↑·↓ 키, 끄는 것과 같은 동작)
		await queueRegion.getByRole('button', { name: 'Inochi No Namae 순서 바꾸기' }).press('ArrowDown');
		await expect(titles).toHaveText(['Itsumo Nando Demo', 'Inochi No Namae']);
		// 다음 곡은 바뀐 순서를 따른다
		await sheet.getByRole('button', { name: '다음 곡' }).tap();
		await expect(sheet.locator('.music-now-info')).toContainText('Itsumo Nando Demo');

		// 목록의 곡을 누르면 그 곡으로 건너뛴다
		await queueRegion.locator('.music-queue-track', { hasText: 'Inochi No Namae' }).tap();
		await expect(sheet.locator('.music-now-info')).toContainText('Inochi No Namae');
		await expect(music.getByRole('contentinfo', { name: '재생 막대' })).toContainText('Inochi No Namae');

		// 다시 누르면 큰 표지로 돌아온다
		await queueButton.tap();
		await expect(queueRegion).toHaveCount(0);
		expect((await sheet.locator('.music-now-art').boundingBox())!.width).toBeGreaterThan(150);
	});

	test('••• 메뉴: 플레이리스트·앨범·아티스트로 이동하면 시트를 닫고 그 목록을 연다', async ({ page }) => {
		const { music, sheet } = await openNowPlaying(page);
		const more = sheet.getByRole('button', { name: '더 보기' });
		await more.tap();
		const menu = page.getByRole('menu', { name: '더 보기' });
		await expect(menu.getByRole('menuitem')).toHaveText([
			'플레이리스트로 이동지브리',
			"앨범으로 이동Howl's Moving Castle",
			'아티스트로 이동Joe Hisaishi',
		]);

		await menu.getByRole('menuitem', { name: /앨범으로 이동/ }).tap();
		await expect(sheet).toBeHidden();
		await expect(music.getByRole('heading', { name: "Howl's Moving Castle", level: 1 })).toBeVisible();
		// 뒤로 가면 앨범 목록
		await expect(music.locator('.mobile-navbar-home')).toHaveText('앨범');

		await music.getByRole('button', { name: '지금 재생 중 열기' }).tap();
		await more.tap();
		await page.getByRole('menuitem', { name: /아티스트로 이동/ }).tap();
		await expect(music.getByRole('heading', { name: 'Joe Hisaishi', level: 1 })).toBeVisible();
		await expect(music.locator('.mobile-navbar-home')).toHaveText('아티스트');

		await music.getByRole('button', { name: '지금 재생 중 열기' }).tap();
		await more.tap();
		await page.getByRole('menuitem', { name: /플레이리스트로 이동/ }).tap();
		await expect(music.getByRole('heading', { name: '지브리', level: 1 })).toBeVisible();
		await expect(music.locator('.mobile-navbar-home')).toHaveText('플레이리스트');
	});

	test('진행 막대를 눌러 그 위치로 옮기고, 음량 막대를 눌러 음량을 바꾼다', async ({ page }) => {
		const { sheet } = await openNowPlaying(page);
		const seek = sheet.getByRole('slider', { name: '재생 위치' });
		const box = (await seek.boundingBox())!;
		await seek.tap({ position: { x: box.width * 0.75, y: box.height / 2 } });
		const max = Number(await seek.getAttribute('aria-valuemax'));
		await expect.poll(async () => Number(await seek.getAttribute('aria-valuenow')) / max).toBeGreaterThan(0.7);
		expect(await page.evaluate(() => document.querySelector('audio')!.currentTime)).toBeGreaterThan(max * 0.7);

		const volume = sheet.getByRole('slider', { name: '음량' });
		const volumeBox = (await volume.boundingBox())!;
		await volume.tap({ position: { x: volumeBox.width * 0.25, y: volumeBox.height / 2 } });
		await expect(volume).toHaveAttribute('aria-valuenow', /^(2[0-9]|30)$/);
		const level = await page.evaluate(() => document.querySelector('audio')!.volume);
		expect(level).toBeGreaterThan(0.2);
		expect(level).toBeLessThan(0.31);
	});

	for (const viewport of [
		{ width: 390, height: 664 },
		{ width: 430, height: 740 },
	])
		test(`오른쪽 끝 정렬 (${viewport.width}px): 대기열 아이콘·••• 버튼·음량 아이콘·≡ 손잡이가 진행 막대 끝에 맞는다`, async ({
			page,
		}) => {
			await page.setViewportSize(viewport);
			const { sheet } = await openNowPlaying(page);
			// 큰 표지가 나타나는 움직임이 끝난 뒤에 잰다
			await page.waitForTimeout(600);
			const right = async (selector: string) => {
				const box = (await sheet.locator(selector).first().boundingBox())!;
				return box.x + box.width;
			};
			for (const queueOpen of [false, true]) {
				if (queueOpen) {
					await sheet.getByRole('button', { name: '대기열' }).tap();
					await page.waitForTimeout(600);
				}
				const edge = await right('.seek-bar-track');
				// ••• 버튼은 반투명 원 전체가 보인다
				expect(await right('.music-now-more')).toBeCloseTo(edge, 0);
				expect(Math.abs((await inkRight(page, sheet.locator('.volume-bar i').last())) - edge)).toBeLessThanOrEqual(1);
				// 대기열 버튼: 켜진 원이 아이콘을 덮으므로 꺼진 상태(흰 아이콘)에서 그림의 끝을 잰다
				// 다음 재생 목록의 ≡ 손잡이
				if (queueOpen)
					expect(
						Math.abs((await inkRight(page, sheet.locator('.music-queue-handle').first())) - edge)
					).toBeLessThanOrEqual(1);
				if (!queueOpen)
					expect(
						Math.abs((await inkRight(page, sheet.getByRole('button', { name: '대기열' }))) - edge)
					).toBeLessThanOrEqual(1);
			}
		});

	test('떠 있는 뒤로 가기는 없고, 손잡이를 누르거나 Esc를 누르면 닫힌다', async ({ page }) => {
		const { music, sheet } = await openNowPlaying(page);
		await expect(music.locator('.mobile-navbar-home')).toHaveCount(0);
		await sheet.getByRole('button', { name: '지금 재생 중 닫기' }).tap();
		await expect(sheet).toBeHidden();
		// 시트가 닫히면 셸의 뒤로 가기가 돌아온다
		await expect(music.locator('.mobile-navbar-home')).toBeVisible();

		await music.getByRole('button', { name: '지금 재생 중 열기' }).tap();
		await expect(sheet).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(sheet).toBeHidden();
		// Esc 한 번은 시트만 닫는다 (앱의 뒤로 가기까지 가지 않는다)
		await expect(music.getByRole('heading', { name: '지브리', level: 1 })).toBeVisible();

		// 키보드: 손잡이에 초점을 두고 Enter
		await music.getByRole('button', { name: '지금 재생 중 열기' }).tap();
		await sheet.getByRole('button', { name: '지금 재생 중 닫기' }).focus();
		await page.keyboard.press('Enter');
		await expect(sheet).toBeHidden();
	});

	test('손잡이를 쓸어내리기: 기준(120px)을 넘기면 닫히고, 못 미치면 제자리로 돌아오고, 빠르게 튕기면 짧아도 닫힌다', async ({
		page,
	}) => {
		// 시험은 기본으로 움직임 줄이기를 켜 둔다. 따라 내려오는 움직임을 보려고 끈다
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		const { music, sheet } = await openNowPlaying(page);
		const grabber = sheet.getByRole('button', { name: '지금 재생 중 닫기' });
		const center = async () => {
			const box = (await grabber.boundingBox())!;
			return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
		};
		/** 천천히 끌다가 멈춘 뒤 놓는다 (속도 0) */
		const slowDrag = async (distance: number, release = true) => {
			const { x, y } = await center();
			await page.mouse.move(x, y);
			await page.mouse.down();
			for (let step = 1; step <= 10; step++) {
				await page.mouse.move(x, y + (distance * step) / 10);
				await page.waitForTimeout(20);
			}
			await page.waitForTimeout(200);
			if (release) await page.mouse.up();
		};
		const sheetTop = async () => (await sheet.boundingBox())!.y;
		// 올라오는 움직임이 끝난 뒤의 자리
		await page.waitForTimeout(600);
		const top = await sheetTop();

		// 못 미치면: 끄는 동안 따라 내려오고, 놓으면 제자리
		await slowDrag(80, false);
		expect((await sheetTop()) - top).toBeCloseTo(80, 0);
		await page.mouse.up();
		await expect.poll(sheetTop).toBeCloseTo(top, 0);
		await expect(sheet).toBeVisible();

		// 짧게(50px) 빠르게 튕기면 닫힌다
		{
			const { x, y } = await center();
			await page.mouse.move(x, y);
			await page.mouse.down();
			await page.mouse.move(x, y + 25);
			await page.mouse.move(x, y + 50);
			await page.mouse.up();
		}
		await expect(sheet).toBeHidden();

		// 셸의 '아래로 쓸면 제어 센터'는 열리지 않는다
		await expect(page.getByRole('dialog', { name: '제어 센터' })).toHaveCount(0);

		// 기준을 넘기면 천천히 끌어도 닫힌다
		await music.getByRole('button', { name: '지금 재생 중 열기' }).tap();
		await expect(sheet).toBeVisible();
		await page.waitForTimeout(600);
		await slowDrag(160);
		await expect(sheet).toBeHidden();

		// 표지를 쓸어내려도 닫힌다
		await music.getByRole('button', { name: '지금 재생 중 열기' }).tap();
		await page.waitForTimeout(600);
		const art = (await sheet.locator('.music-now-art').boundingBox())!;
		await page.mouse.move(art.x + art.width / 2, art.y + 20);
		await page.mouse.down();
		for (let step = 1; step <= 10; step++) await page.mouse.move(art.x + art.width / 2, art.y + 20 + step * 18);
		await page.mouse.up();
		await expect(sheet).toBeHidden();
	});

	test('움직임 줄이기면 끄는 동안 따라 내려오지 않고, 기준을 넘기면 닫히기만 한다', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		const { sheet } = await openNowPlaying(page);
		const box = (await sheet.getByRole('button', { name: '지금 재생 중 닫기' }).boundingBox())!;
		const x = box.x + box.width / 2;
		const y = box.y + box.height / 2;
		const top = (await sheet.boundingBox())!.y;
		await page.mouse.move(x, y);
		await page.mouse.down();
		for (let step = 1; step <= 8; step++) await page.mouse.move(x, y + step * 20);
		expect((await sheet.boundingBox())!.y).toBeCloseTo(top, 0);
		await page.mouse.up();
		await expect(sheet).toBeHidden();
	});

	test('진행 막대·음량 막대를 아래로 끌어도 시트는 닫히지 않는다', async ({ page }) => {
		const { sheet } = await openNowPlaying(page);
		for (const name of ['재생 위치', '음량']) {
			const box = (await sheet.getByRole('slider', { name }).boundingBox())!;
			await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
			await page.mouse.down();
			for (let step = 1; step <= 8; step++) await page.mouse.move(box.x + box.width / 2, box.y + step * 25);
			await page.mouse.up();
			await expect(sheet).toBeVisible();
		}
	});
});

test.describe('음악: 휴대폰의 배경 음악', () => {
	test('로딩 화면을 탭하면 배경 음악이 재생된다 (탭 처리 중에 허용받은 요소라 WebKit 규칙에서도 재생된다)', async ({
		page,
	}) => {
		await emulateWebKitAutoplay(page);
		await enterHome(page);
		await expect.poll(() => audioPaused(page)).toBe(false);
		await page.locator('.mobile-home').getByRole('button', { name: '음악', exact: true }).tap();
		await expect(
			appWindow(page, 'music')
				.getByRole('contentinfo', { name: '재생 막대' })
				.getByRole('button', { name: '일시 정지' })
		).toBeVisible();
	});

	test('재생이 막히면 멈춘 상태로 남고 미니 플레이어는 재생 버튼을 보여 준다', async ({ page }) => {
		await page.addInitScript(() => {
			HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('막힘', 'NotAllowedError'));
		});
		await enterHome(page);
		await page.waitForTimeout(500);
		expect(await audioPaused(page)).toBe(true);
		await page.locator('.mobile-home').getByRole('button', { name: '음악', exact: true }).tap();
		await expect(
			appWindow(page, 'music')
				.getByRole('contentinfo', { name: '재생 막대' })
				.getByRole('button', { name: '재생', exact: true })
		).toBeVisible();
	});
});
