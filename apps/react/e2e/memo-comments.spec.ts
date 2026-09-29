import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Page } from '@playwright/test';
import { fakeApi } from './fakeApi';

const TITLE = 'CRA에서 Vite로 옮기기';

async function openPost(page: Page) {
	await enterDesktop(page);
	await dockItem(page, 'memo').click();
	const memo = appWindow(page, 'memo');
	await memo.locator('.memo-item', { hasText: TITLE }).click();
	return memo.getByRole('region', { name: '댓글' });
}

test.describe('댓글', () => {
	test('방문자는 이름·비밀번호로 쓰고, 같은 비밀번호로 지운다', async ({ page }) => {
		const api = await fakeApi(page);
		const comments = await openPost(page);
		await expect(comments).toContainText('첫 댓글을 남겨 주세요.');

		// 규칙을 어기면 등록하지 않고 이유를 보여 준다 (메시지 앱과 같은 규칙)
		const form = comments.getByRole('form', { name: '댓글 쓰기' });
		await form.getByRole('button', { name: '등록' }).click();
		await expect(form.getByRole('alert')).toContainText('이름을 입력해주세요.');
		await form.getByRole('textbox', { name: '이름' }).fill('김정현');
		await form.getByRole('textbox', { name: '댓글 내용' }).fill('잘 봤어요');
		await form.getByLabel('비밀번호').fill('1234');
		await form.getByRole('button', { name: '등록' }).click();
		await expect(form.getByRole('alert')).toContainText('다른 이름을 입력해주세요.');

		await form.getByRole('textbox', { name: '이름' }).fill('민수');
		await form.getByRole('button', { name: '등록' }).click();
		const comment = comments.getByRole('listitem').filter({ hasText: '잘 봤어요' });
		await expect(comment).toContainText('민수(127.0)');
		await expect(comments.getByRole('heading', { name: /댓글/ })).toContainText('1');
		expect(api.comments['cra-to-vite']).toHaveLength(1);

		// 틀린 비밀번호로는 지울 수 없다
		await comment.getByRole('button', { name: '민수의 댓글 삭제' }).click();
		await comment.getByLabel('댓글 비밀번호').fill('0000');
		await comment.getByRole('button', { name: '삭제', exact: true }).last().click();
		await expect(comment.getByRole('alert')).toHaveText('비밀번호가 맞지 않습니다.');

		await comment.getByLabel('댓글 비밀번호').fill('1234');
		await comment.getByRole('button', { name: '삭제', exact: true }).last().click();
		await expect(comment).toHaveCount(0);
		expect(api.comments['cra-to-vite']).toHaveLength(0);
	});

	test('관리자는 비밀번호 없이 작성자로 쓰고, 방문자 댓글도 바로 지운다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		api.comments['cra-to-vite'] = [
			{
				id: 'v1',
				name: '광고',
				ipPrefix: '1.2',
				isAdmin: false,
				body: '홍보합니다',
				createdAt: '2026-09-29T00:00:00.000Z',
				password: 'x',
			},
		];
		const comments = await openPost(page);
		const form = comments.getByRole('form', { name: '댓글 쓰기' });
		await expect(form).toContainText('김정현(작성자)으로 씁니다');
		await expect(form.getByRole('textbox', { name: '이름' })).toHaveCount(0);

		await form.getByRole('textbox', { name: '댓글 내용' }).fill('읽어 주셔서 감사합니다');
		await form.getByRole('button', { name: '등록' }).click();
		const own = comments.getByRole('listitem').filter({ hasText: '읽어 주셔서 감사합니다' });
		await expect(own).toContainText('작성자');

		await comments.getByRole('button', { name: '광고의 댓글 삭제' }).click();
		await expect(comments.getByRole('listitem').filter({ hasText: '홍보합니다' })).toHaveCount(0);
	});

	test('서버가 없으면 댓글 대신 안내만 보인다', async ({ page }) => {
		const comments = await openPost(page);
		await expect(comments).toContainText('댓글은 서버를 연결한 뒤 쓸 수 있어요.');
		await expect(comments.getByRole('form', { name: '댓글 쓰기' })).toHaveCount(0);
	});
});
