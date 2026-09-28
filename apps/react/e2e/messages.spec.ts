import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Locator, Page } from '@playwright/test';

async function openMessages(page: Page) {
	await enterDesktop(page);
	await dockItem(page, 'messages').click();
	return appWindow(page, 'messages');
}

const textbox = (messages: Locator) => messages.getByRole('textbox', { name: '메시지' });
const transcript = (messages: Locator) => messages.getByRole('log');

async function post(messages: Locator, name: string, text: string, password = 'pw1234') {
	await messages.getByLabel('이름').fill(name);
	await messages.getByLabel('비밀번호', { exact: true }).fill(password);
	await textbox(messages).fill(text);
	await textbox(messages).press('Enter');
	await expect(transcript(messages)).toContainText(text);
}

/** 다른 사람(다른 IP)처럼 보이도록 브라우저 id를 바꾼다. 서버에서는 IP가 이 역할을 한다 */
async function becomeVisitor(page: Page, id: string) {
	await page.evaluate((visitor) => {
		localStorage.setItem('macfolio:messages:visitor', visitor);
		localStorage.removeItem('macfolio:messages:nickname');
	}, id);
}

test.describe('메시지', () => {
	test('처음에는 김정현의 방명록이 열리고, 바로 글을 쓸 수 있다', async ({ page }) => {
		const messages = await openMessages(page);
		await expect(messages.getByRole('region', { name: '김정현의 방명록' })).toBeVisible();
		await expect(transcript(messages)).toContainText('안녕하세요, 김정현입니다');
		await expect(textbox(messages)).toBeVisible();

		// 주인 글은 오른쪽 클릭 메뉴가 없다
		await messages.locator('.messages-bubble').first().click({ button: 'right' });
		await expect(messages.getByRole('menu')).toHaveCount(0);
	});

	test('방명록에 글을 써도 목록에 새 항목이 생기지 않는다', async ({ page }) => {
		let messages = await openMessages(page);
		const threads = messages.locator('.messages-thread');
		await expect(threads).toHaveCount(0);

		await post(messages, '민수', '반가워요!');
		await expect(messages.locator('.messages-bubble-row.right')).toHaveText(/반가워요!/);
		await expect(messages.getByText('전송됨')).toHaveCount(1);
		await expect(threads).toHaveCount(0);

		// 새로고침해도 이름은 남고 비밀번호는 남지 않는다
		messages = await openMessages(page);
		await expect(messages.getByLabel('이름')).toHaveValue('민수');
		await expect(messages.getByLabel('비밀번호', { exact: true })).toHaveValue('');
	});

	test('쓰기 버튼으로만 내 방이 생기고, 다시 누르면 내 방을 연다', async ({ page }) => {
		const messages = await openMessages(page);
		await messages.getByRole('button', { name: '새 메시지' }).first().click();
		await expect(messages.getByRole('region', { name: '새로운 메시지' })).toBeVisible();

		await post(messages, '민수', '내 방 첫 글');
		await expect(messages.getByRole('region', { name: '민수의 방명록' })).toBeVisible();
		await expect(messages.getByRole('button', { name: /^민수.*나/ })).toBeVisible();

		await messages.getByRole('button', { name: '김정현' }).click();
		await messages.getByRole('button', { name: '새 메시지' }).first().click();
		await expect(messages.getByRole('region', { name: '민수의 방명록' })).toBeVisible();
		await expect(messages.locator('.messages-thread')).toHaveCount(1);
	});

	test('새 메시지는 취소 버튼이나 Esc로 그만두고 이전 방으로 돌아간다', async ({ page }) => {
		const messages = await openMessages(page);
		const compose = messages.getByRole('button', { name: '새 메시지' }).first();

		await compose.click();
		await messages.getByRole('button', { name: '취소' }).click();
		await expect(messages.getByRole('region', { name: '김정현의 방명록' })).toBeVisible();

		await compose.click();
		await expect(messages.getByRole('region', { name: '새로운 메시지' })).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(messages.getByRole('region', { name: '김정현의 방명록' })).toBeVisible();
		await expect(messages.locator('.messages-thread')).toHaveCount(0);
	});

	test('다른 사람의 방에도 쓸 수 있고, 사람마다 구분되어 보인다', async ({ page }) => {
		let messages = await openMessages(page);
		await messages.getByRole('button', { name: '새 메시지' }).first().click();
		await post(messages, '민수', '민수의 첫 글');

		await becomeVisitor(page, 'visitor-b');
		messages = await openMessages(page);
		await messages.getByRole('button', { name: /^민수/ }).click();
		await expect(messages.getByRole('region', { name: '민수의 방명록' })).toBeVisible();
		await post(messages, '지영', '민수님 방에 남겨요');
		// 지영에게는 자기 글이라 오른쪽, 민수의 글은 왼쪽
		await expect(messages.locator('.messages-bubble-row.right')).toHaveText(/민수님 방에 남겨요/);
		await expect(messages.locator('.messages-bubble-row.left')).toHaveText(/민수의 첫 글/);
		// 글만 썼으므로 지영의 방은 생기지 않는다
		await expect(messages.locator('.messages-thread')).toHaveCount(1);

		await becomeVisitor(page, 'visitor-c');
		messages = await openMessages(page);
		await messages.getByRole('button', { name: /^민수/ }).click();
		const row = messages.locator('.messages-bubble-row.left', { hasText: '민수님 방에 남겨요' });
		await expect(row.locator('.messages-sender')).toHaveText('지영');
	});

	test('오른쪽 클릭으로 지우고, 비밀번호가 맞아야 삭제된다', async ({ page }) => {
		const messages = await openMessages(page);
		await post(messages, '민수', '지울 메시지');
		await post(messages, '민수', '남길 메시지');

		await messages.locator('.messages-bubble', { hasText: '지울 메시지' }).click({ button: 'right' });
		await messages.getByRole('menuitem', { name: '삭제…' }).click();

		await page.getByLabel('삭제 비밀번호').fill('wrong');
		await page.getByRole('button', { name: '삭제', exact: true }).click();
		await expect(page.getByRole('dialog').getByRole('alert')).toHaveText('비밀번호가 일치하지 않습니다.');

		await page.getByLabel('삭제 비밀번호').fill('pw1234');
		await page.getByRole('button', { name: '삭제', exact: true }).click();
		await expect(page.getByRole('dialog')).toBeHidden();
		await expect(transcript(messages)).not.toContainText('지울 메시지');
		await expect(transcript(messages)).toContainText('남길 메시지');
	});

	test('이름이 없으면 보내지 않고, 입력한 메시지는 남겨 둔다', async ({ page }) => {
		const messages = await openMessages(page);
		await messages.getByLabel('비밀번호', { exact: true }).fill('pw1234');
		await textbox(messages).fill('이름 없이');
		await textbox(messages).press('Enter');

		await expect(messages.getByRole('alert')).toHaveText('이름을 입력해주세요.');
		await expect(textbox(messages)).toHaveValue('이름 없이');
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

	test('창이 좁으면 목록과 대화를 한 화면씩 보여주고, 뒤로 가기로 목록에 돌아간다', async ({ page }) => {
		const messages = await openMessages(page);
		const handle = (await messages.locator('.resize-handle.bottom-right').boundingBox())!;
		await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
		await page.mouse.down();
		await page.mouse.move(handle.x - 420, handle.y + handle.height / 2, { steps: 8 });
		await page.mouse.up();

		await expect(messages.getByRole('complementary', { name: '대화 목록' })).toBeVisible();
		await expect(messages.getByRole('region', { name: '김정현의 방명록' })).toBeHidden();

		await messages.getByRole('button', { name: '김정현' }).click();
		await expect(messages.getByRole('region', { name: '김정현의 방명록' })).toBeVisible();
		await expect(messages.getByRole('complementary', { name: '대화 목록' })).toBeHidden();

		await messages.getByRole('button', { name: '대화 목록' }).click();
		await expect(messages.getByRole('complementary', { name: '대화 목록' })).toBeVisible();
	});
});
