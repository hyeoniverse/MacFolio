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
	test('방문자는 이름·비밀번호 없이 자동으로 정한 이름으로 쓰고, 자기 댓글만 확인한 뒤 지운다', async ({ page }) => {
		const api = await fakeApi(page);
		api.comments['cra-to-vite'] = [
			{
				id: 'v1',
				name: '🐼 졸린 판다',
				ipPrefix: '1.2',
				isAdmin: false,
				body: '다른 사람 댓글',
				createdAt: '2026-09-29T00:00:00.000Z',
				mine: false,
			},
		];
		const comments = await openPost(page);
		const form = comments.getByRole('form', { name: '댓글 쓰기' });
		await expect(form).toContainText('🦊 날쌘 여우 이름으로 씁니다.');
		await expect(form.getByRole('textbox', { name: '이름' })).toHaveCount(0);
		await expect(form.getByLabel('비밀번호')).toHaveCount(0);

		// 내용이 없으면 등록하지 않고 이유를 보여 준다 (메시지 앱과 같은 규칙)
		await form.getByRole('button', { name: '등록' }).click();
		await expect(form.getByRole('alert')).toContainText('내용을 입력해주세요.');

		await form.getByRole('textbox', { name: '댓글 내용' }).fill('잘 봤어요');
		await form.getByRole('button', { name: '등록' }).click();
		const comment = comments.getByRole('listitem').filter({ hasText: '잘 봤어요' });
		await expect(comment).toContainText('🦊 날쌘 여우(127.0)');
		await expect(comments.getByRole('heading', { name: /댓글/ })).toContainText('2');

		// 남의 댓글에는 지우기 단추가 없다
		const other = comments.getByRole('listitem').filter({ hasText: '다른 사람 댓글' });
		await expect(other.getByRole('button', { name: /댓글 삭제/ })).toHaveCount(0);

		// 내 댓글은 한 번 더 물어본 뒤 지운다. 취소하면 그대로
		await comment.getByRole('button', { name: '🦊 날쌘 여우의 댓글 삭제' }).click();
		const confirm = comment.getByRole('group', { name: '댓글 삭제 확인' });
		await expect(confirm).toContainText('이 댓글을 지울까요?');
		await confirm.getByRole('button', { name: '취소' }).click();
		await expect(confirm).toHaveCount(0);
		await comment.getByRole('button', { name: '🦊 날쌘 여우의 댓글 삭제' }).click();
		await comment.getByRole('button', { name: '삭제', exact: true }).click();
		await expect(comment).toHaveCount(0);
		expect(api.comments['cra-to-vite'].map((item) => item.id)).toEqual(['v1']);
	});

	test('관리자는 작성자로 쓰고, 방문자 댓글도 확인한 뒤 지운다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		api.comments['cra-to-vite'] = [
			{
				id: 'v1',
				name: '🐼 졸린 판다',
				ipPrefix: '1.2',
				isAdmin: false,
				body: '홍보합니다',
				createdAt: '2026-09-29T00:00:00.000Z',
				mine: false,
			},
		];
		const comments = await openPost(page);
		const form = comments.getByRole('form', { name: '댓글 쓰기' });
		await expect(form).toContainText('김정현(작성자)으로 씁니다');

		await form.getByRole('textbox', { name: '댓글 내용' }).fill('읽어 주셔서 감사합니다');
		await form.getByRole('button', { name: '등록' }).click();
		const own = comments.getByRole('listitem').filter({ hasText: '읽어 주셔서 감사합니다' });
		await expect(own).toContainText('작성자');

		const spam = comments.getByRole('listitem').filter({ hasText: '홍보합니다' });
		await spam.getByRole('button', { name: '🐼 졸린 판다의 댓글 삭제' }).click();
		await spam.getByRole('button', { name: '삭제', exact: true }).click();
		await expect(spam).toHaveCount(0);
	});

	test('서버가 없으면 댓글 대신 안내만 보인다', async ({ page }) => {
		const comments = await openPost(page);
		await expect(comments).toContainText('댓글은 서버를 연결한 뒤 쓸 수 있어요.');
		await expect(comments.getByRole('form', { name: '댓글 쓰기' })).toHaveCount(0);
	});
});
