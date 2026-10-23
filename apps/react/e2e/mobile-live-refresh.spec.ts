import type { Page } from '@playwright/test';
import { test, expect, appWindow } from './fixtures';
import { fakeApi } from './fakeApi';

// 휴대폰: 메시지의 새 답글, 홈 화면 위젯은 앞에 앱이 있으면 묻지 않는다 (usePolling의 useSharedPolling)

async function enterHome(page: Page) {
	await page.goto('/');
	const loading = page.locator('.loading-container');
	await expect(loading).toContainText('탭하여');
	await loading.tap();
	await expect(loading).toBeHidden({ timeout: 20_000 });
}

/** 홈 화면의 앱 아이콘. 다른 쪽에 있으면 점을 눌러 그 쪽으로 넘긴다 */
async function homeApp(page: Page, label: string) {
	const home = page.locator('.mobile-home');
	const pages = home.locator('.mobile-page');
	const count = await pages.count();
	for (let index = 0; index < count; index++) {
		if ((await pages.nth(index).locator(`.mobile-app[aria-label="${label}"]`).count()) === 0) continue;
		if (count > 1) await home.getByRole('tab', { name: `${index + 1}쪽` }).click();
		break;
	}
	return home.getByRole('button', { name: label, exact: true });
}

const countRequests = (page: Page, path: string) => {
	const counter = { count: 0 };
	page.on('request', (request) => {
		if (request.method() === 'GET' && new URL(request.url()).pathname === path) counter.count += 1;
	});
	return counter;
};

test.describe('휴대폰: 값 갱신', () => {
	test('메시지: 보고 있는 대화에 새 답글이 15초 안에 보이고, 입력 중인 글은 그대로다', async ({ page }) => {
		await page.clock.install();
		const api = await fakeApi(page);
		await enterHome(page);
		await (await homeApp(page, '메시지')).tap();
		const messages = appWindow(page, 'messages');
		await messages.getByRole('complementary', { name: '대화 목록' }).getByRole('button').first().tap();
		const log = messages.getByRole('log');
		await expect(log).toContainText('안녕하세요, 김정현입니다');
		const textbox = messages.getByRole('textbox', { name: '메시지' });
		await textbox.fill('쓰는 중');

		api.messages.push({
			id: 'm900',
			threadId: 'owner',
			text: '새 답글이 도착했어요',
			createdAt: new Date().toISOString(),
			authorId: 'other',
			nickname: '🐻 느긋한 곰',
			fromOwner: false,
			mine: false,
		});
		await page.clock.fastForward(16_000);
		await expect(log).toContainText('새 답글이 도착했어요');
		await expect(textbox).toHaveValue('쓰는 중');
	});

	test('홈 화면 위젯(GitHub 기여)은 앞에 앱이 있는 동안 묻지 않고, 홈으로 돌아오면 간격이 지났을 때 바로 묻는다', async ({
		page,
	}) => {
		await page.clock.install();
		await fakeApi(page);
		const activity = countRequests(page, '/github/activity');
		await enterHome(page);
		await expect.poll(() => activity.count).toBe(1);

		await (await homeApp(page, '메시지')).tap();
		const messages = appWindow(page, 'messages');
		await expect(messages).toBeVisible();
		await page.clock.fastForward(30 * 60_000);
		expect(activity.count).toBe(1);

		await messages.getByRole('button', { name: '홈 화면으로' }).tap();
		await expect(messages).toBeHidden();
		await expect.poll(() => activity.count).toBe(2);
	});
});
