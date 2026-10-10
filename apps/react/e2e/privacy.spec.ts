import { test, expect, enterDesktop, dockItem, appWindow, storeMessagesOnServer } from './fixtures';
import type { Page } from '@playwright/test';
import { fakeApi } from './fakeApi';

/** 바깥 Turnstile 스크립트 대신: 그리면 곧 확인이 끝났다고 알리는 가짜 (토큰은 그릴 때마다 새로) */
async function fakeTurnstile(page: Page) {
	await page.route('https://challenges.cloudflare.com/turnstile/**', (route) =>
		route.fulfill({
			contentType: 'application/javascript',
			// '사람 확인 완료'는 토큰을 넘긴 뒤에 보인다 (보이면 보낼 수 있다)
			body: `let n = 0; const boxes = {}; window.turnstile = { render(el, o) { const id = 'w' + (++n); const token = 'human-' + n; boxes[id] = el; setTimeout(() => { if (!boxes[id]) return; o.callback(token); el.textContent = '사람 확인 완료'; }, 50); return id; }, remove(id) { if (boxes[id]) boxes[id].textContent = ''; delete boxes[id]; } };`,
		})
	);
}

async function openPrivacy(page: Page) {
	await dockItem(page, 'settings').click();
	const settings = appWindow(page, 'settings');
	await settings.getByRole('button', { name: '개인정보 보호 및 보안' }).click();
	return settings;
}

test.describe('개인정보 보호 및 보안', () => {
	test('방문자에게는 어디에 사람 확인이 켜져 있는지 보이고, 바꿀 수는 없다. 더 알아보기는 개인정보 처리 방침', async ({
		page,
	}) => {
		await fakeApi(page);
		await enterDesktop(page);
		const settings = await openPrivacy(page);
		const checks = settings.getByRole('region', { name: '사람 확인' });
		await expect(checks.getByRole('switch', { name: '메일 사람 확인' })).toBeChecked();
		await expect(checks.getByRole('switch', { name: '댓글 사람 확인' })).not.toBeChecked();
		await expect(checks.getByRole('switch', { name: '메시지 사람 확인' })).not.toBeChecked();
		for (const name of ['메일', '댓글', '메시지'])
			await expect(checks.getByRole('switch', { name: `${name} 사람 확인` })).toBeDisabled();
		await expect(checks).toContainText('관리자만 바꿀 수 있습니다');

		await settings.getByRole('button', { name: '더 알아보기…' }).click();
		const finder = appWindow(page, 'finder');
		await expect(finder.getByRole('article', { name: 'privacy.md' }).getByRole('heading', { level: 1 })).toHaveText(
			'개인정보: 무엇을 모으고 얼마나 두나'
		);
	});

	test('관리자는 곳마다 켜고 끈다 (서버에 저장)', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		await enterDesktop(page);
		const settings = await openPrivacy(page);
		const comment = settings.getByRole('switch', { name: '댓글 사람 확인' });
		await expect(comment).toBeEnabled();
		await comment.click();
		await expect(comment).toBeChecked();
		await settings.getByRole('switch', { name: '메일 사람 확인' }).click();
		await expect(settings.getByRole('switch', { name: '메일 사람 확인' })).not.toBeChecked();
		expect(api.securityUpdates).toEqual([{ comment: true }, { contact: false }]);
		await expect(settings.getByRole('region', { name: '사람 확인' })).toContainText(
			'관리자가 쓰는 글은 확인하지 않습니다'
		);
	});

	test('서버에 Turnstile 키가 없으면 켜 두어도 확인하지 않는다고 알린다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		api.security = { ...api.security, available: false, turnstileSiteKey: null };
		await enterDesktop(page);
		const settings = await openPrivacy(page);
		await expect(settings.getByRole('region', { name: '사람 확인' })).toContainText('서버에 Turnstile 키가 없어');
	});

	test('댓글에 켜면 방문자의 댓글 칸에 사람 확인이 생기고, 토큰과 함께 쓴다 (다음 댓글은 새 토큰)', async ({
		page,
	}) => {
		const api = await fakeApi(page);
		api.security.comment = true;
		await fakeTurnstile(page);
		await enterDesktop(page);
		await dockItem(page, 'memo').click();
		const memo = appWindow(page, 'memo');
		await memo.locator('.memo-item', { hasText: 'CRA에서 Vite로 옮기기' }).click();
		const form = memo.getByRole('form', { name: '댓글 쓰기' });
		await expect(form).toContainText('사람 확인 완료');

		await form.getByRole('textbox', { name: '댓글 내용' }).fill('잘 봤어요');
		await form.getByRole('button', { name: '등록' }).click();
		await expect(memo.locator('.memo-comment-body', { hasText: '잘 봤어요' })).toBeVisible();
		await form.getByRole('textbox', { name: '댓글 내용' }).fill('하나 더');
		await form.getByRole('button', { name: '등록' }).click();
		await expect(memo.locator('.memo-comment-body', { hasText: '하나 더' })).toBeVisible();
		// 토큰은 한 번만 쓸 수 있어서, 댓글마다 다른 토큰을 보낸다
		expect(api.humanTokens).toHaveLength(2);
		expect(new Set(api.humanTokens).size).toBe(2);
		expect(api.humanTokens.every((token) => token.startsWith('human-'))).toBe(true);
		// 다음 댓글을 쓸 수 있게 새 확인이 끝나 있다
		await expect(form).toContainText('사람 확인 완료');
	});

	test('꺼져 있으면 댓글 칸에 사람 확인이 없다', async ({ page }) => {
		await fakeApi(page);
		await enterDesktop(page);
		await dockItem(page, 'memo').click();
		const memo = appWindow(page, 'memo');
		await memo.locator('.memo-item', { hasText: 'CRA에서 Vite로 옮기기' }).click();
		await expect(memo.getByRole('form', { name: '댓글 쓰기' }).locator('.memo-comment-turnstile')).toHaveCount(0);
	});

	test('메시지에 켜면 새 피드백도 토큰과 함께 보낸다', async ({ page }) => {
		const api = await fakeApi(page);
		api.security.message = true;
		await storeMessagesOnServer(page);
		await fakeTurnstile(page);
		await enterDesktop(page);
		await dockItem(page, 'messages').click();
		const messages = appWindow(page, 'messages');
		await messages.getByRole('button', { name: '새 피드백' }).first().click();
		await expect(messages.locator('.messages-turnstile')).toContainText('사람 확인 완료');
		await messages.getByRole('textbox', { name: '메시지' }).fill('모바일에서 깨져요');
		await messages.getByRole('textbox', { name: '메시지' }).press('Enter');
		await expect(messages.getByRole('log')).toContainText('모바일에서 깨져요');
		expect(api.humanTokens).toHaveLength(1);
	});
});
