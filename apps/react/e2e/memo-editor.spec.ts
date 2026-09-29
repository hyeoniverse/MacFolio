import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Page } from '@playwright/test';
import { fakeApi, type FakeApiState } from './fakeApi';

async function openMemo(page: Page, api: FakeApiState) {
	void api;
	await enterDesktop(page);
	await dockItem(page, 'memo').click();
	const memo = appWindow(page, 'memo');
	await expect(memo.locator('.memo-item').first()).toBeVisible();
	return memo;
}

test.describe('글쓰기·편집 (관리자)', () => {
	test('새 메모를 쓰면 서버에 저장되고 목록 맨 위에 열린다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		const memo = await openMemo(page, api);
		await expect(memo.getByTitle('관리자로 로그인했습니다')).toBeVisible();

		await memo.getByRole('button', { name: '새 메모', exact: true }).first().click();
		const editor = memo.getByRole('form', { name: '새 메모' });
		// 필수 항목을 비우고 저장하면 요청을 보내지 않고 그 칸을 알려 준다 (제목으로 옮겨 간다)
		await editor.getByRole('button', { name: '저장' }).click();
		await expect(editor.getByRole('alert')).toContainText('제목을 입력해주세요.');
		await expect(editor.getByRole('alert')).toContainText('본문을 입력해주세요.');
		await expect(editor.getByRole('textbox', { name: '제목' })).toHaveAttribute('aria-invalid', 'true');
		await expect(editor.getByRole('textbox', { name: '제목' })).toBeFocused();
		expect(api.posts).toEqual([]);
		// 요약은 선택 사항이라고 따로 알려 준다
		await expect(editor).toContainText('요약은 선택 사항입니다. 비워 두면 본문의 앞부분이 목록에 보입니다.');

		await editor.getByRole('textbox', { name: '본문' }).fill('## 첫 문단\n\n본문입니다.');
		// 고친 칸은 표시가 사라진다
		await expect(editor.getByRole('textbox', { name: '본문' })).toHaveAttribute('aria-invalid', 'false');

		await editor.getByRole('textbox', { name: '제목' }).fill('새로 쓴 글');
		// 미리 보기로 Markdown을 확인한다
		await editor.getByRole('button', { name: '미리 보기' }).click();
		await expect(editor.getByRole('heading', { name: '첫 문단' })).toBeVisible();
		await editor.getByRole('button', { name: '저장' }).click();

		const article = memo.getByRole('article', { name: '새로 쓴 글' });
		await expect(article.getByRole('heading', { level: 1 })).toHaveText('새로 쓴 글');
		await expect(memo.locator('.memo-item').filter({ hasText: '새로 쓴 글' })).toBeVisible();
		expect(api.posts).toEqual([expect.objectContaining({ title: '새로 쓴 글', deleted: false })]);

		// 새로고침해도 서버에서 다시 읽어 남아 있다
		await openMemo(page, api);
		await expect(memo.locator('.memo-item').filter({ hasText: '새로 쓴 글' })).toBeVisible();
	});

	test('저장소의 글을 고치면 같은 주소로 서버에 저장되고, 지우면 목록에서 사라진다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		const memo = await openMemo(page, api);
		await memo.locator('.memo-item', { hasText: 'CRA에서 Vite로 옮기기' }).click();
		await memo.getByRole('button', { name: '메모 편집', exact: true }).first().click();

		const editor = memo.getByRole('form', { name: '메모 편집' });
		await expect(editor.getByRole('textbox', { name: '제목' })).toHaveValue('CRA에서 Vite로 옮기기');
		await editor.getByRole('textbox', { name: '제목' }).fill('CRA에서 Vite로 옮기기 (고침)');
		await editor.press('Meta+s');
		await expect(memo.getByRole('article', { name: 'CRA에서 Vite로 옮기기 (고침)' })).toBeVisible();
		expect(api.posts).toEqual([
			expect.objectContaining({ slug: 'cra-to-vite', title: 'CRA에서 Vite로 옮기기 (고침)' }),
		]);

		// 우클릭 메뉴로 지운다
		page.once('dialog', (dialog) => dialog.accept());
		await memo.locator('.memo-item', { hasText: '(고침)' }).click({ button: 'right' });
		await page.getByRole('menuitem', { name: '메모 삭제' }).click();
		await expect(memo.locator('.memo-item', { hasText: 'CRA에서 Vite로' })).toHaveCount(0);
		expect(api.posts).toEqual([expect.objectContaining({ slug: 'cra-to-vite', deleted: true })]);
	});

	test('방문자는 서버의 글을 보지만 쓰기·편집 단추는 없다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: false });
		api.posts = [
			{
				slug: '2026-09-30-abc',
				title: '서버에만 있는 글',
				date: '2026-09-30',
				category: '개발기/MacFolio',
				summary: '',
				body: '본문',
				deleted: false,
			},
			{ slug: 'cra-to-vite', title: '', date: '2026-09-28', category: '기타', summary: '', body: '', deleted: true },
		];
		const memo = await openMemo(page, api);
		await expect(memo.locator('.memo-item').first()).toContainText('서버에만 있는 글');
		await expect(memo.locator('.memo-item', { hasText: 'CRA에서 Vite로' })).toHaveCount(0);
		await expect(memo.getByRole('button', { name: '새 메모', exact: true })).toHaveCount(0);
		await expect(memo.getByRole('button', { name: '메모 편집', exact: true })).toHaveCount(0);
		await expect(memo.getByTitle('관리자로 로그인했습니다')).toHaveCount(0);
	});
});
