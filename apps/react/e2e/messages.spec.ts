import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import { fakeApi } from './fakeApi';
import type { Locator, Page } from '@playwright/test';

async function openMessages(page: Page) {
	await enterDesktop(page);
	await dockItem(page, 'messages').click();
	return appWindow(page, 'messages');
}

const textbox = (messages: Locator) => messages.getByRole('textbox', { name: '메시지' });
const transcript = (messages: Locator) => messages.getByRole('log');

/** 이름·비밀번호 없이 보낸다. 이름은 브라우저 id로 정해진다 */
async function post(messages: Locator, text: string) {
	await textbox(messages).fill(text);
	await textbox(messages).press('Enter');
	await expect(transcript(messages)).toContainText(text);
}

/** 다른 사람처럼 보이도록 브라우저 id를 바꾼다. 서버에서는 방문자 쿠키가 이 역할을 한다 */
async function becomeVisitor(page: Page, id: string) {
	await page.evaluate((visitor) => localStorage.setItem('macfolio:messages:visitor', visitor), id);
}

/** 입력창 위에 보이는 이 브라우저의 이름 (예: 🦊 날쌘 여우) */
const myName = async (messages: Locator) => (await messages.locator('.messages-as strong').textContent())!;

const compose = (messages: Locator) => messages.getByRole('button', { name: '새 피드백' }).first();
const items = (messages: Locator) => messages.locator('.messages-thread');

test.describe('메시지 (감상·의견·피드백)', () => {
	test('처음에는 김정현의 안내가 열리고, 누구나 답글을 달 수 있다', async ({ page }) => {
		const messages = await openMessages(page);
		await expect(messages.getByRole('region', { name: '김정현의 안내' })).toBeVisible();
		await expect(transcript(messages)).toContainText('안녕하세요, 김정현입니다');
		await expect(items(messages)).toHaveCount(0);

		// 주인 글은 오른쪽 클릭 메뉴가 없다
		await messages.locator('.messages-bubble').first().click({ button: 'right' });
		await expect(page.getByRole('menu', { name: '메시지 메뉴' })).toHaveCount(0);

		// 이름·비밀번호 칸은 없고, 입력창 위에 자동으로 정한 이름이 보인다
		await expect(messages.getByLabel('이름')).toHaveCount(0);
		await expect(messages.getByLabel('비밀번호')).toHaveCount(0);
		await expect(messages.locator('.messages-as')).toHaveText(/^\S+ .+ \S+ 이름으로 남겨요$/);
		await post(messages, '반가워요!');
		await expect(messages.locator('.messages-bubble-row.right')).toHaveText(/반가워요!/);
		await expect(messages.getByText('전송됨')).toHaveCount(1);
		// 답글은 목록에 항목을 만들지 않는다
		await expect(items(messages)).toHaveCount(0);
	});

	test('쓰기 버튼으로 남긴 피드백마다 목록에 항목이 생긴다', async ({ page }) => {
		let messages = await openMessages(page);
		await compose(messages).click();
		await expect(messages.getByRole('region', { name: '새 피드백' })).toBeVisible();
		await post(messages, '디자인이 예뻐요');
		const name = await myName(messages);
		await expect(messages.getByRole('region', { name: `${name}의 피드백` })).toBeVisible();

		await compose(messages).click();
		await post(messages, '음악 앱에 건의가 있어요');
		await expect(items(messages)).toHaveCount(2);
		// 미리보기는 피드백 본문, 최근 활동 순
		await expect(items(messages).first()).toContainText('음악 앱에 건의가 있어요');
		await expect(items(messages).first()).toContainText('나');

		// 새로고침해도 남고, 같은 브라우저면 이름도 같다
		messages = await openMessages(page);
		await expect(items(messages)).toHaveCount(2);
		await expect(messages.locator('.messages-as strong')).toHaveText(name);
		await expect(items(messages).first()).toContainText(name);
	});

	test('새 피드백은 취소 버튼이나 Esc로 그만두고 보던 항목으로 돌아간다', async ({ page }) => {
		const messages = await openMessages(page);
		await compose(messages).click();
		await messages.getByRole('button', { name: '취소' }).click();
		await expect(messages.getByRole('region', { name: '김정현의 안내' })).toBeVisible();

		await compose(messages).click();
		await expect(messages.getByRole('region', { name: '새 피드백' })).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(messages.getByRole('region', { name: '김정현의 안내' })).toBeVisible();
		await expect(items(messages)).toHaveCount(0);
	});

	test('다른 사람의 피드백에 답글을 달 수 있고, 사람마다 구분되어 보인다', async ({ page }) => {
		let messages = await openMessages(page);
		await compose(messages).click();
		await post(messages, '모바일에서 깨져요');
		const first = await myName(messages);

		await becomeVisitor(page, 'visitor-b');
		messages = await openMessages(page);
		await items(messages).first().click();
		await expect(messages.getByRole('region', { name: `${first}의 피드백` })).toBeVisible();
		const second = await myName(messages);
		expect(second).not.toBe(first);
		await post(messages, '저도 그래요');
		// 지영에게는 자기 글이 오른쪽, 민수의 글은 왼쪽
		await expect(messages.locator('.messages-bubble-row.right')).toHaveText(/저도 그래요/);
		await expect(messages.locator('.messages-bubble-row.left')).toHaveText(/모바일에서 깨져요/);
		// 답글만 달았으므로 항목은 그대로 하나
		await expect(items(messages)).toHaveCount(1);
		await expect(items(messages).first()).toContainText('모바일에서 깨져요');

		await becomeVisitor(page, 'visitor-c');
		messages = await openMessages(page);
		await items(messages).first().click();
		const row = messages.locator('.messages-bubble-row.left', { hasText: '저도 그래요' });
		await expect(row.locator('.messages-sender')).toHaveText(second);
	});

	test('내가 쓴 글은 오른쪽 클릭으로 확인한 뒤 지우고, 남의 글에는 메뉴가 없다', async ({ page }) => {
		let messages = await openMessages(page);
		await post(messages, '지울 메시지');
		await post(messages, '남길 메시지');

		await messages.locator('.messages-bubble', { hasText: '지울 메시지' }).click({ button: 'right' });
		// 메뉴는 창에 잘리지 않게 body에 그린다 (공통 메뉴)
		const menu = page.getByRole('menu', { name: '메시지 메뉴' });
		await expect(menu.getByRole('menuitem', { name: '삭제…' })).toBeFocused();
		await menu.getByRole('menuitem', { name: '삭제…' }).click();

		const dialog = page.getByRole('alertdialog', { name: '메시지를 삭제할까요?' });
		await expect(dialog).toContainText('삭제한 메시지는 되돌릴 수 없습니다.');
		await expect(dialog.getByLabel('비밀번호')).toHaveCount(0);
		await dialog.getByRole('button', { name: '삭제', exact: true }).click();
		await expect(dialog).toBeHidden();
		await expect(transcript(messages)).not.toContainText('지울 메시지');
		await expect(transcript(messages)).toContainText('남길 메시지');

		// 다른 브라우저에서는 이 글을 지울 수 없다 (메뉴도, 키보드용 삭제 단추도 없다)
		await becomeVisitor(page, 'visitor-b');
		messages = await openMessages(page);
		await messages.locator('.messages-bubble', { hasText: '남길 메시지' }).click({ button: 'right' });
		await expect(page.getByRole('menu', { name: '메시지 메뉴' })).toHaveCount(0);
		await expect(messages.getByRole('button', { name: '메시지 삭제' })).toHaveCount(0);
	});

	test('내용이 없으면 보내지 않는다', async ({ page }) => {
		const messages = await openMessages(page);
		const before = await messages.locator('.messages-bubble').count();
		await textbox(messages).fill('   ');
		await textbox(messages).press('Enter');
		await expect(messages.locator('.messages-bubble')).toHaveCount(before);
	});

	test('Shift+Enter는 줄바꿈이고 보내지 않는다', async ({ page }) => {
		const messages = await openMessages(page);
		const before = await messages.locator('.messages-bubble').count();
		await textbox(messages).fill('첫 줄');
		await textbox(messages).press('Shift+Enter');
		await textbox(messages).pressSequentially('둘째 줄');
		await expect(textbox(messages)).toHaveValue('첫 줄\n둘째 줄');
		await expect(messages.locator('.messages-bubble')).toHaveCount(before);
	});

	test('예전 형식으로 저장된 목록은 지운다', async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() =>
			localStorage.setItem(
				'macfolio:messages',
				JSON.stringify({
					threads: [{ id: 'old', ownerId: 'x', title: '예전 방', createdAt: '2026-09-01T00:00:00Z' }],
					messages: [],
				})
			)
		);
		const messages = await openMessages(page);
		await expect(items(messages)).toHaveCount(0);
		expect(await page.evaluate(() => localStorage.getItem('macfolio:messages'))).toBeNull();
	});

	test('창이 좁으면 목록과 대화를 한 화면씩 보여주고, 뒤로 가기로 목록에 돌아간다', async ({ page }) => {
		const messages = await openMessages(page);
		const handle = (await messages.locator('.resize-handle.bottom-right').boundingBox())!;
		await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
		await page.mouse.down();
		await page.mouse.move(handle.x - 420, handle.y + handle.height / 2, { steps: 8 });
		await page.mouse.up();

		await expect(messages.getByRole('complementary', { name: '대화 목록' })).toBeVisible();
		await expect(messages.getByRole('region', { name: '김정현의 안내' })).toBeHidden();

		await messages.getByRole('button', { name: '김정현' }).click();
		await expect(messages.getByRole('region', { name: '김정현의 안내' })).toBeVisible();
		await expect(messages.getByRole('complementary', { name: '대화 목록' })).toBeHidden();

		await messages.getByRole('button', { name: '대화 목록' }).click();
		await expect(messages.getByRole('complementary', { name: '대화 목록' })).toBeVisible();
	});

	test('서버가 있으면 서버에 저장하고, 이름은 서버가 정한 이름(블로그 댓글과 같은 이름)', async ({ page }) => {
		const api = await fakeApi(page);
		const messages = await openMessages(page);
		await expect(messages.locator('.messages-as')).toHaveText('🦊 날쌘 여우 이름으로 남겨요');
		await expect(transcript(messages)).toContainText('안녕하세요, 김정현입니다');

		await post(messages, '반가워요!');
		expect(api.messages).toMatchObject([{ threadId: 'owner', text: '반가워요!', nickname: '🦊 날쌘 여우' }]);

		await compose(messages).click();
		await post(messages, '디자인이 예뻐요');
		await expect(messages.getByRole('region', { name: '🦊 날쌘 여우의 피드백' })).toBeVisible();
		await expect(items(messages)).toHaveCount(1);
		expect(api.messageThreads).toHaveLength(1);

		// 내 글을 지우면 서버에서도 지운다
		await messages.locator('.messages-bubble', { hasText: '디자인이 예뻐요' }).click({ button: 'right' });
		await page.getByRole('menu', { name: '메시지 메뉴' }).getByRole('menuitem', { name: '삭제…' }).click();
		await page.getByRole('alertdialog').getByRole('button', { name: '삭제', exact: true }).click();
		await expect(transcript(messages)).not.toContainText('디자인이 예뻐요');
		expect(api.messages.map((m) => m.text)).toEqual(['반가워요!']);
	});
});
