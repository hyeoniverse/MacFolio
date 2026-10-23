import { test, expect, appWindow } from './fixtures';
import type { Locator, Page } from '@playwright/test';

/** 로딩 화면을 탭해 넘기고 홈 화면에서 메시지를 연다 */
async function openMessages(page: Page) {
	await page.goto('/');
	const loading = page.locator('.loading-container');
	await loading.tap();
	await expect(loading).toBeHidden({ timeout: 20_000 });
	const home = page.locator('.mobile-home');
	const pages = home.locator('.mobile-page');
	const count = await pages.count();
	for (let index = 0; index < count; index++) {
		if ((await pages.nth(index).locator('.mobile-app[aria-label="메시지"]').count()) === 0) continue;
		if (count > 1) await home.getByRole('tab', { name: `${index + 1}쪽` }).click();
		break;
	}
	await home.getByRole('button', { name: '메시지', exact: true }).tap();
	const messages = appWindow(page, 'messages');
	await expect(messages.getByRole('complementary', { name: '대화 목록' })).toBeVisible();
	return messages;
}

/** 요소 한가운데를 누르면 그 요소(또는 그 안)가 눌리는지. 다른 요소가 덮고 있으면 false */
const isOnTop = (locator: Locator) =>
	locator.evaluate((element) => {
		const rect = element.getBoundingClientRect();
		const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
		return hit !== null && (hit === element || element.contains(hit));
	});

test.describe('메시지 (휴대폰 셸의 넓은 화면): 목록과 대화를 나란히', () => {
	// iPad mini 세로. 767px 이하라 모바일 셸이지만 앱 폭이 640px보다 넓어 목록과 대화를 나란히 보여 준다
	test.use({ viewport: { width: 744, height: 1133 } });

	test('아래 검색 알약은 목록 칸 안에만 있고, 대화의 입력 칸을 덮지 않아 메시지를 보낼 수 있다', async ({ page }) => {
		const messages = await openMessages(page);
		const textbox = messages.getByRole('textbox', { name: '메시지' });
		const bottom = messages.locator('.messages-phone-bottom');
		await expect(textbox).toBeVisible();
		await expect(bottom).toBeVisible();

		const sidebar = (await messages.locator('.messages-sidebar').boundingBox())!;
		const pill = (await bottom.boundingBox())!;
		const field = (await messages.locator('.messages-field').boundingBox())!;
		expect(pill.x + pill.width).toBeLessThanOrEqual(sidebar.x + sidebar.width);
		expect(pill.x + pill.width).toBeLessThanOrEqual(field.x);
		expect(await isOnTop(textbox)).toBe(true);
		expect(await isOnTop(messages.locator('.messages-field'))).toBe(true);

		await textbox.tap();
		await textbox.fill('아이패드에서 남겨요');
		await textbox.press('Enter');
		await expect(messages.getByRole('log')).toContainText('아이패드에서 남겨요');
		// 목록이 옆에 보이므로 뒤로 가기는 앱 안(메시지)이 아니라 홈으로 간다. 검색 알약도 그대로 남는다
		await expect(messages.locator('.mobile-navbar-back-label')).toHaveText('홈');
		await expect(bottom).toBeVisible();
	});

	test('새 피드백 화면에서도 입력 칸이 가려지지 않는다', async ({ page }) => {
		const messages = await openMessages(page);
		await messages.locator('.messages-phone-bottom').getByRole('button', { name: '새 피드백' }).tap();
		await expect(messages.getByRole('region', { name: '새 피드백' })).toBeVisible();
		const textbox = messages.getByRole('textbox', { name: '메시지' });
		expect(await isOnTop(textbox)).toBe(true);
		await textbox.fill('새 피드백입니다');
		await textbox.press('Enter');
		await expect(messages.locator('.messages-thread')).toHaveCount(1);
	});
});

test.describe('메시지 (휴대폰): 화면 키보드', () => {
	/**
	 * 화면 키보드를 흉내 낸다. 브라우저 시험에서는 키보드가 뜨지 않아서, iOS Safari처럼 보이는 곳(visualViewport)만 줄이고
	 * 입력 칸을 키보드 위로 올리려고 보이는 곳을 아래로 옮긴다(offsetTop). window.__keyboard(높이, 옮긴 거리)로 올리고 내린다
	 */
	const fakeKeyboard = (page: Page) =>
		page.addInitScript(() => {
			const listeners = new Set<EventListener>();
			let height = 0;
			let offsetTop = 0;
			const viewport = {
				get width() {
					return window.innerWidth;
				},
				get height() {
					return window.innerHeight - height;
				},
				get offsetTop() {
					return offsetTop;
				},
				offsetLeft: 0,
				pageTop: 0,
				pageLeft: 0,
				scale: 1,
				addEventListener: (_type: string, listener: EventListener) => listeners.add(listener),
				removeEventListener: (_type: string, listener: EventListener) => listeners.delete(listener),
			};
			Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true });
			(window as unknown as { __keyboard: (next: number, top: number) => void }).__keyboard = (next, top) => {
				height = next;
				offsetTop = top;
				listeners.forEach((listener) => listener(new Event('resize')));
			};
		});
	const setKeyboard = (page: Page, height: number, offsetTop: number) =>
		page.evaluate(
			([next, top]) => (window as unknown as { __keyboard: (h: number, t: number) => void }).__keyboard(next, top),
			[height, offsetTop] as const
		);

	for (const offset of ['pan', 'none'] as const) {
		test(`키보드가 올라오면 머리와 상태 표시줄은 보이는 곳 맨 위에 남고, 대화와 입력 칸만 키보드 위로 줄어든다 (보이는 곳 이동: ${offset})`, async ({
			page,
		}) => {
			await fakeKeyboard(page);
			const messages = await openMessages(page);
			await messages.getByRole('complementary', { name: '대화 목록' }).getByRole('button').first().tap();
			const textbox = messages.getByRole('textbox', { name: '메시지' });
			await expect(textbox).toBeVisible();
			const pill = messages.locator('.messages-name-pill');
			const statusbar = page.locator('.mobile-statusbar');
			const field = messages.locator('.messages-field');
			const before = { pill: (await pill.boundingBox())!, statusbar: (await statusbar.boundingBox())! };

			await textbox.tap();
			const viewport = page.viewportSize()!;
			const keyboard = Math.round(viewport.height * 0.4);
			// iOS는 아래쪽 입력 칸에 초점이 가면 보이는 곳을 키보드 높이만큼 아래로 옮긴다
			const top = offset === 'pan' ? keyboard : 0;
			await setKeyboard(page, keyboard, top);
			await expect(messages).toHaveClass(/keyboard-open/);

			// 머리(이름 알약)와 상태 표시줄은 보이는 곳 맨 위에서 키보드 전과 같은 자리
			expect(Math.round((await pill.boundingBox())!.y - top)).toBe(Math.round(before.pill.y));
			expect(Math.round((await statusbar.boundingBox())!.y - top)).toBe(Math.round(before.statusbar.y));
			// 입력 칸은 키보드 바로 위 (홈 바 여백 없이), 보이는 곳 안
			const visibleBottom = top + viewport.height - keyboard;
			const fieldBox = (await field.boundingBox())!;
			expect(fieldBox.y + fieldBox.height).toBeLessThanOrEqual(visibleBottom);
			expect(fieldBox.y + fieldBox.height).toBeGreaterThan(visibleBottom - 24);
			await expect(messages.locator('.home-indicator')).toBeHidden();
			// 마지막 말풍선은 입력 칸 위에 보인다
			const lastBubble = (await messages.locator('.messages-bubble').last().boundingBox())!;
			expect(lastBubble.y + lastBubble.height).toBeLessThanOrEqual(fieldBox.y);
			expect(lastBubble.y).toBeGreaterThanOrEqual(top);
			expect(await isOnTop(textbox)).toBe(true);

			await setKeyboard(page, 0, 0);
			await expect(messages).not.toHaveClass(/keyboard-open/);
			expect(Math.round((await pill.boundingBox())!.y)).toBe(Math.round(before.pill.y));
			expect(Math.round((await statusbar.boundingBox())!.y)).toBe(Math.round(before.statusbar.y));
			await expect(messages.locator('.home-indicator')).toBeVisible();
		});
	}
});

test.describe('메시지 (휴대폰): 빈 목록', () => {
	test('빈 목록의 말풍선 아이콘은 글리프가 상자 안에 다 들어가 잘리지 않는다', async ({ page }) => {
		const messages = await openMessages(page);
		const icon = messages.locator('.messages-empty-icon');
		await expect(icon).toBeVisible();
		const { lineBox, inkTop, inkBottom } = await icon.evaluate((element) => {
			const style = getComputedStyle(element);
			// 아이콘 글자 (::before의 content: "\f086" / "")
			const glyph = JSON.parse(getComputedStyle(element, '::before').content.split('/')[0]!.trim()) as string;
			const context = document.createElement('canvas').getContext('2d')!;
			context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
			const ink = context.measureText(glyph);
			const box = element.getBoundingClientRect();
			// 줄 상자 가운데에 글꼴의 ascent·descent가 놓인다 (반쪽 leading)
			const leading = (box.height - (ink.fontBoundingBoxAscent + ink.fontBoundingBoxDescent)) / 2;
			const baseline = leading + ink.fontBoundingBoxAscent;
			return {
				lineBox: box.height,
				inkTop: baseline - ink.actualBoundingBoxAscent,
				inkBottom: baseline + ink.actualBoundingBoxDescent,
			};
		});
		expect(inkTop).toBeGreaterThanOrEqual(0);
		expect(inkBottom).toBeLessThanOrEqual(lineBox);
		// 아이콘 상자는 목록 항목 안, 화면 안에 있다
		const item = (await messages.locator('.messages-empty').boundingBox())!;
		const box = (await icon.boundingBox())!;
		expect(box.y).toBeGreaterThanOrEqual(item.y);
		expect(box.y).toBeGreaterThan(0);
	});
});
