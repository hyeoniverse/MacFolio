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

	test('맨 위 손잡이를 누르거나 아래로 끌어 내리면 닫힌다', async ({ page }) => {
		const { music, sheet } = await openNowPlaying(page);
		await sheet.getByRole('button', { name: '지금 재생 중 닫기' }).tap();
		await expect(sheet).toBeHidden();

		await music.getByRole('button', { name: '지금 재생 중 열기' }).tap();
		await expect(sheet).toBeVisible();
		const grabber = (await sheet.getByRole('button', { name: '지금 재생 중 닫기' }).boundingBox())!;
		const x = grabber.x + grabber.width / 2;
		const y = grabber.y + grabber.height / 2;
		await page.mouse.move(x, y);
		await page.mouse.down();
		for (let step = 1; step <= 8; step++) await page.mouse.move(x, y + step * 30);
		await page.mouse.up();
		await expect(sheet).toBeHidden();
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
