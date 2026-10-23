import type { Locator, Page } from '@playwright/test';
import { test, expect, enterDesktop, appWindow, dockItem } from './fixtures';
import { fakeApi, type FakeMessage } from './fakeApi';

// 주기 조회 (shared/hooks/usePolling.ts): 메시지·댓글·메일 받은 편지함·위젯이 보이는 동안만 다시 묻는다.
// page.clock으로 시간을 앞당겨 간격을 확인한다

/** 브라우저 탭을 숨기거나 다시 보인다 (다른 탭으로 옮긴 것처럼) */
const setHidden = (page: Page, hidden: boolean) =>
	page.evaluate((value) => {
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			get: () => (value ? 'hidden' : 'visible'),
		});
		document.dispatchEvent(new Event('visibilitychange'));
	}, hidden);

/** 이 경로(GET)로 보낸 요청 수 */
const countRequests = (page: Page, path: string) => {
	const counter = { count: 0 };
	page.on('request', (request) => {
		if (request.method() === 'GET' && new URL(request.url()).pathname === path) counter.count += 1;
	});
	return counter;
};

/** 다른 방문자가 주인 안내에 단 답글 */
const reply = (id: string, text: string): FakeMessage => ({
	id,
	threadId: 'owner',
	text,
	createdAt: new Date().toISOString(),
	authorId: 'other',
	nickname: '🐻 느긋한 곰',
	fromOwner: false,
	mine: false,
});

async function openMessages(page: Page) {
	await enterDesktop(page);
	await dockItem(page, 'messages').click();
	const messages = appWindow(page, 'messages');
	await expect(messages.getByRole('log')).toContainText('안녕하세요, 김정현입니다');
	return messages;
}

/**
 * 대화 칸을 그 위치로 스크롤한다. 브라우저는 scroll 이벤트를 다음 렌더링 단계에 보내므로,
 * 바로 다음에 새 답글을 받으면 앱이 아직 이전 위치(맨 아래인지)를 기억하고 있을 수 있다. 이벤트를 바로 보내 순서를 고정한다
 */
const scrollLog = (log: Locator, to: 'top' | 'bottom') =>
	log.evaluate((element, where) => {
		element.scrollTop = where === 'top' ? 0 : element.scrollHeight;
		element.dispatchEvent(new Event('scroll'));
	}, to);

/** 대화 칸의 맨 아래에서 떨어진 거리 (px) */
const distanceFromBottom = (log: Locator) =>
	log.evaluate((element) => element.scrollHeight - element.scrollTop - element.clientHeight);

test.describe('값 갱신: 메시지', () => {
	test('보고 있는 대화에 새 답글이 오면 15초 안에 보이고, 입력 중인 글은 그대로다', async ({ page }) => {
		await page.clock.install();
		const api = await fakeApi(page);
		const messages = await openMessages(page);
		const textbox = messages.getByRole('textbox', { name: '메시지' });
		await textbox.fill('쓰는 중인 답글');

		api.messages.push(reply('m900', '새 답글이 도착했어요'));
		await page.clock.fastForward(16_000);
		await expect(messages.getByRole('log')).toContainText('새 답글이 도착했어요');
		await expect(textbox).toHaveValue('쓰는 중인 답글');
	});

	test('위로 올려 읽는 중이면 새 답글이 와도 스크롤 위치를 그대로 두고, 맨 아래면 따라 내려간다', async ({ page }) => {
		await page.clock.install();
		const api = await fakeApi(page);
		for (let index = 0; index < 40; index++) api.messages.push(reply(`m${100 + index}`, `지난 답글 ${index}`));
		const messages = await openMessages(page);
		const log = messages.getByRole('log');
		await expect(log).toContainText('지난 답글 39');
		await expect.poll(() => distanceFromBottom(log)).toBeLessThan(2);

		// 위로 올려 읽는 중: 새 답글이 와도 그 자리
		await scrollLog(log, 'top');
		api.messages.push(reply('m900', '읽는 중에 온 답글'));
		await page.clock.fastForward(16_000);
		await expect(log).toContainText('읽는 중에 온 답글');
		expect(await log.evaluate((element) => element.scrollTop)).toBe(0);

		// 맨 아래로 내리면 다음 답글은 따라 내려간다
		await scrollLog(log, 'bottom');
		api.messages.push(reply('m901', '맨 아래에서 받은 답글'));
		await page.clock.fastForward(16_000);
		await expect(log).toContainText('맨 아래에서 받은 답글');
		await expect.poll(() => distanceFromBottom(log)).toBeLessThan(2);
	});

	test('탭이 숨으면 묻지 않는다. 간격이 지난 뒤 다시 보이면 바로 묻고, 잠깐 옮겼다 오면 묻지 않는다', async ({
		page,
	}) => {
		await page.clock.install();
		const api = await fakeApi(page);
		const owner = countRequests(page, '/messages/threads/owner');
		const threads = countRequests(page, '/messages/threads');
		const messages = await openMessages(page);
		await expect.poll(() => owner.count).toBe(1);

		await setHidden(page, true);
		await page.clock.fastForward(5 * 60_000);
		expect(owner.count).toBe(1);
		const threadsBefore = threads.count;

		// 5분 숨었다 보이면 말풍선(15초)과 목록(1분) 모두 간격이 지났다: 바로 묻는다
		api.messages.push(reply('m900', '숨어 있는 동안 온 답글'));
		await setHidden(page, false);
		await expect(messages.getByRole('log')).toContainText('숨어 있는 동안 온 답글');
		expect(owner.count).toBe(2);
		await expect.poll(() => threads.count).toBe(threadsBefore + 1);

		// 5초만 숨었다 보이면 아직 간격 안이라 묻지 않는다 (남은 10초 뒤에 묻는다)
		await setHidden(page, true);
		await page.clock.fastForward(5_000);
		await setHidden(page, false);
		await page.clock.runFor(1_000);
		expect(owner.count).toBe(2);
		await page.clock.fastForward(10_000);
		await expect.poll(() => owner.count).toBe(3);
	});

	test('창을 최소화하면 묻지 않는다', async ({ page }) => {
		await page.clock.install();
		await fakeApi(page);
		const owner = countRequests(page, '/messages/threads/owner');
		const messages = await openMessages(page);
		await expect.poll(() => owner.count).toBe(1);
		await messages.getByRole('button', { name: '최소화', exact: true }).click();
		await page.clock.fastForward(5 * 60_000);
		expect(owner.count).toBe(1);
	});
});

test.describe('값 갱신: 댓글·메일', () => {
	test('메모: 글을 보는 동안 1분마다 댓글을 다시 묻고, 쓰던 댓글은 그대로다', async ({ page }) => {
		await page.clock.install();
		const api = await fakeApi(page);
		await enterDesktop(page, '/memo/cra-to-vite');
		const memo = appWindow(page, 'memo');
		const input = memo.getByRole('textbox', { name: '댓글 내용' });
		await expect(memo.locator('.memo-comments-note')).toContainText('아직 댓글이 없어요');
		await input.fill('쓰던 댓글');

		api.comments['cra-to-vite'] = [
			{
				id: 'c900',
				name: '🐻 느긋한 곰',
				ipPrefix: '203.0',
				isAdmin: false,
				body: '잘 읽었습니다',
				createdAt: new Date().toISOString(),
				mine: false,
			},
		];
		await page.clock.fastForward(61_000);
		await expect(memo.locator('.memo-comment-list')).toContainText('잘 읽었습니다');
		await expect(input).toHaveValue('쓰던 댓글');
	});

	test('관리자 메일: 창이 보이는 동안 2분마다 받은 편지함을 다시 묻는다', async ({ page }) => {
		await page.clock.install();
		const api = await fakeApi(page, { signedIn: true });
		await enterDesktop(page);
		await dockItem(page, 'mail').click();
		const mail = appWindow(page, 'mail');
		const inbox = mail.getByRole('region', { name: '받은 편지함' });
		await expect(inbox.locator('.mail-item')).toHaveCount(2);

		api.contact.inbox.unshift({
			id: 'mail-new',
			name: '지수',
			email: 'jisu@example.com',
			subject: '새로 온 연락',
			body: '안녕하세요',
			createdAt: new Date().toISOString(),
			replies: [],
		});
		await page.clock.fastForward(60_000);
		await expect(inbox.locator('.mail-item')).toHaveCount(2);
		await page.clock.fastForward(61_000);
		await expect(inbox.locator('.mail-item')).toHaveCount(3);
		await expect(inbox).toContainText('새로 온 연락');
	});
});

test.describe('값 갱신: 바탕화면 위젯', () => {
	test('GitHub 위젯과 GitHub 앱은 요청 하나를 나눠 쓰고 10분마다 묻는다. 탭이 숨으면 묻지 않는다', async ({ page }) => {
		await page.clock.install();
		const api = await fakeApi(page);
		const activity = countRequests(page, '/github/activity');
		const posts = countRequests(page, '/posts');
		await enterDesktop(page);
		await expect(page.locator('.widget-github-graph')).toBeVisible();
		await expect.poll(() => activity.count).toBe(1);
		await expect.poll(() => posts.count).toBe(1);

		// GitHub 앱을 열어도 위젯이 받은 지 10분이 지나지 않았으면 다시 묻지 않는다
		await dockItem(page, 'github').click();
		await expect(appWindow(page, 'github')).toBeVisible();
		await page.clock.runFor(1_000);
		expect(activity.count).toBe(1);

		api.github.activity!.contributions!.total = 2000;
		await page.clock.fastForward(10 * 60_000);
		await expect(page.locator('.widget-github-header')).toContainText('2,000회');
		expect(activity.count).toBe(2);
		await expect.poll(() => posts.count).toBe(2);

		await setHidden(page, true);
		await page.clock.fastForward(30 * 60_000);
		expect(activity.count).toBe(2);
		expect(posts.count).toBe(2);
	});
});
