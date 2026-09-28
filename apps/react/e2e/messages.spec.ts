import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Page } from '@playwright/test';

async function openMessages(page: Page) {
	await enterDesktop(page);
	await dockItem(page, 'messages').click();
	return appWindow(page, 'messages');
}

test.describe('Messages 방명록', () => {
	test('처음에는 주인의 환영 메시지가 있고 지울 수 없다', async ({ page }) => {
		const messages = await openMessages(page);
		const welcome = messages.getByRole('article', { name: '김정현의 메시지' });
		await expect(welcome).toBeVisible();
		await expect(welcome.getByRole('button', { name: /삭제/ })).toHaveCount(0);
	});

	test('작성한 메시지가 새로고침 후에도 남고, 비밀번호가 맞아야 삭제된다', async ({ page }) => {
		let messages = await openMessages(page);
		await messages.getByLabel('닉네임').fill('방문자');
		await messages.getByLabel('비밀번호', { exact: true }).fill('pw1234');
		await messages.getByRole('textbox', { name: '메시지' }).fill('잘 보고 갑니다');
		await messages.getByRole('textbox', { name: '메시지' }).press('Enter');

		const mine = () => messages.getByRole('article', { name: '방문자의 메시지' });
		await expect(mine()).toContainText('잘 보고 갑니다');
		// 보낸 뒤 메시지 칸만 비우고 닉네임·비밀번호는 남긴다
		await expect(messages.getByRole('textbox', { name: '메시지' })).toHaveValue('');
		await expect(messages.getByLabel('닉네임')).toHaveValue('방문자');

		messages = await openMessages(page);
		await expect(mine()).toContainText('잘 보고 갑니다');

		// 틀린 비밀번호
		await mine().getByRole('button', { name: '방문자의 메시지 삭제' }).click();
		await page.getByLabel('삭제 비밀번호').fill('wrong');
		await page.getByRole('button', { name: '삭제', exact: true }).click();
		await expect(page.getByRole('alert')).toHaveText('비밀번호가 일치하지 않습니다.');
		await expect(mine()).toBeVisible();

		// 맞는 비밀번호
		await page.getByLabel('삭제 비밀번호').fill('pw1234');
		await page.getByRole('button', { name: '삭제', exact: true }).click();
		await expect(mine()).toHaveCount(0);
		await expect(page.getByRole('dialog')).toBeHidden();
	});

	test('필수 입력이 비어 있으면 보내지 않고 알려준다', async ({ page }) => {
		const messages = await openMessages(page);
		await messages.getByRole('textbox', { name: '메시지' }).fill('닉네임 없이');
		await messages.getByRole('button', { name: '보내기' }).click();

		await expect(messages.getByRole('alert')).toHaveText('닉네임을 입력해주세요.');
		await expect(messages.getByRole('article')).toHaveCount(1);
	});

	test('Shift+Enter는 줄바꿈이고 보내지 않는다', async ({ page }) => {
		const messages = await openMessages(page);
		const text = messages.getByRole('textbox', { name: '메시지' });
		await text.fill('첫 줄');
		await text.press('Shift+Enter');
		await text.pressSequentially('둘째 줄');
		await expect(text).toHaveValue('첫 줄\n둘째 줄');
		await expect(messages.getByRole('article')).toHaveCount(1);
	});
});
