import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Locator, Page } from '@playwright/test';

async function openMessages(page: Page) {
	await enterDesktop(page);
	await dockItem(page, 'messages').click();
	return appWindow(page, 'messages');
}

const textbox = (messages: Locator) => messages.getByRole('textbox', { name: '메시지' });
const transcript = (messages: Locator) => messages.getByRole('log');

async function send(messages: Locator, text: string) {
	await textbox(messages).fill(text);
	await textbox(messages).press('Enter');
	await expect(transcript(messages)).toContainText(text);
}

async function startThread(messages: Locator, name: string, text: string, password = 'pw1234') {
	await messages.getByRole('button', { name: /메시지 보내기|내 대화 시작하기/ }).click();
	await expect(messages.getByText('받는 사람:')).toBeVisible();
	await messages.getByLabel('이름').fill(name);
	await messages.getByLabel('비밀번호', { exact: true }).fill(password);
	await send(messages, text);
}

test.describe('메시지', () => {
	test('처음에는 김정현의 고정 대화가 열리고, 읽기만 할 수 있다', async ({ page }) => {
		const messages = await openMessages(page);
		await expect(messages.getByRole('region', { name: '김정현와의 대화' })).toBeVisible();
		await expect(transcript(messages)).toContainText('안녕하세요, 김정현입니다');
		await expect(textbox(messages)).toHaveCount(0);
		await expect(messages.getByRole('button', { name: '메시지 보내기' })).toBeVisible();

		// 주인 메시지는 오른쪽 클릭 메뉴가 없다
		await messages.locator('.messages-bubble').first().click({ button: 'right' });
		await expect(messages.getByRole('menu')).toHaveCount(0);
	});

	test('대화를 시작하면 내 대화가 목록에 생기고, 새로고침 후에도 이어 쓸 수 있다', async ({ page }) => {
		let messages = await openMessages(page);
		await startThread(messages, '민수', '안녕하세요!');

		await expect(messages.getByRole('region', { name: '민수와의 대화' })).toBeVisible();
		const myThread = messages.getByRole('button', { name: /민수.*나/ });
		await expect(myThread).toHaveAttribute('aria-current', 'true');
		await expect(myThread).toContainText('안녕하세요!');

		await send(messages, '두 번째 메시지');
		// 전송됨은 마지막 메시지에만
		await expect(messages.getByText('전송됨')).toHaveCount(1);

		messages = await openMessages(page);
		await expect(messages.getByRole('region', { name: '민수와의 대화' })).toBeVisible();
		await send(messages, '새로고침 후에도');
		await expect(messages.locator('.messages-bubble')).toHaveText(['안녕하세요!', '두 번째 메시지', '새로고침 후에도']);
	});

	test('다른 방문자의 대화는 읽을 수 있지만 쓸 수 없다', async ({ page }) => {
		let messages = await openMessages(page);
		await startThread(messages, '민수', '민수의 메시지');
		// 다른 브라우저에서 온 방문자처럼 작성 권한을 지운다
		await page.evaluate(() => localStorage.removeItem('macfolio:messages:access'));

		messages = await openMessages(page);
		await startThread(messages, '지영', '지영의 메시지');

		await messages.getByRole('button', { name: /^민수/ }).click();
		await expect(transcript(messages)).toContainText('민수의 메시지');
		await expect(textbox(messages)).toHaveCount(0);
		await expect(messages.getByText('공개 대화예요. 누구나 읽을 수 있어요.')).toBeVisible();

		await messages.getByRole('button', { name: '내 대화로 가기' }).click();
		await expect(messages.getByRole('region', { name: '지영와의 대화' })).toBeVisible();
	});

	test('오른쪽 클릭으로 지우고, 비밀번호가 맞아야 삭제된다', async ({ page }) => {
		const messages = await openMessages(page);
		await startThread(messages, '민수', '지울 메시지');
		await send(messages, '남길 메시지');

		await messages.locator('.messages-bubble', { hasText: '지울 메시지' }).click({ button: 'right' });
		await messages.getByRole('menuitem', { name: '삭제…' }).click();

		await page.getByLabel('삭제 비밀번호').fill('wrong');
		await page.getByRole('button', { name: '삭제', exact: true }).click();
		await expect(page.getByRole('dialog').getByRole('alert')).toHaveText('비밀번호가 일치하지 않습니다.');

		await page.getByLabel('삭제 비밀번호').fill('pw1234');
		await page.getByRole('button', { name: '삭제', exact: true }).click();
		await expect(page.getByRole('dialog')).toBeHidden();
		await expect(messages.locator('.messages-bubble')).toHaveText(['남길 메시지']);
	});

	test('이름이 없으면 대화를 시작하지 않고, 입력한 메시지는 남겨 둔다', async ({ page }) => {
		const messages = await openMessages(page);
		await messages.getByRole('button', { name: '메시지 보내기' }).click();
		await messages.getByLabel('비밀번호', { exact: true }).fill('pw1234');
		await textbox(messages).fill('이름 없이');
		await textbox(messages).press('Enter');

		await expect(messages.getByRole('alert')).toHaveText('이름을 입력해주세요.');
		await expect(textbox(messages)).toHaveValue('이름 없이');
		await expect(messages.getByRole('button', { name: /이름 없이/ })).toHaveCount(0);
	});

	test('Shift+Enter는 줄바꿈이고 보내지 않는다', async ({ page }) => {
		const messages = await openMessages(page);
		await startThread(messages, '민수', '첫 메시지');
		await textbox(messages).fill('첫 줄');
		await textbox(messages).press('Shift+Enter');
		await textbox(messages).pressSequentially('둘째 줄');
		await expect(textbox(messages)).toHaveValue('첫 줄\n둘째 줄');
		await expect(messages.locator('.messages-bubble')).toHaveCount(1);
	});
});
