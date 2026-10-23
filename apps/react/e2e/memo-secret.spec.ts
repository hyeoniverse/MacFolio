import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Page } from '@playwright/test';
import { fakeApi, type FakeApiState, type FakeContent } from './fakeApi';

// 비밀 글: 관리자가 서버에만 있는 글을 비밀로 지정하면 관리자에게만 보인다.
// 방문자 쪽 숨김은 서버가 한다 (apps/api/test/secret-posts.e2e.test.ts). 여기서는 화면의 지정·해제와 표시를 본다

async function openMemo(page: Page) {
	await enterDesktop(page);
	await dockItem(page, 'memo').click();
	const memo = appWindow(page, 'memo');
	await expect(memo.locator('.memo-item').first()).toBeVisible();
	return memo;
}

/** 방문자가 받는 글 목록 (가짜 서버의 GET /posts) */
const publicPosts = (page: Page) =>
	page.evaluate(async () => (await fetch('http://api.test/posts')).json() as Promise<{ slug: string }[]>);

const content = (title: string): FakeContent => ({
	title,
	date: '2026-09-28',
	category: '개발기/MacFolio',
	summary: '',
	body: `${title} 본문`,
});

/** 서버에만 있는 게시한 글 */
const serverPost = (slug: string, title: string, secret = false) => ({
	slug,
	...content(title),
	deleted: false,
	published: content(title),
	draft: null,
	secret,
});

const find = (api: FakeApiState, slug: string) => api.posts.find((post) => post.slug === slug);

test.describe('비밀 글', () => {
	test('관리자가 서버 글을 비밀로 지정하면 목록·본문에 표시가 붙고 방문자 목록에서 빠진다. 풀면 돌아온다', async ({
		page,
	}) => {
		const api = await fakeApi(page, { signedIn: true });
		api.posts = [serverPost('2026-09-28-abc123', '나만 볼 일기')];
		const memo = await openMemo(page);
		const title = '나만 볼 일기';
		const item = memo.locator('.memo-item', { hasText: title });
		await item.click();
		await expect(memo.locator('.ProseMirror')).toBeVisible();
		expect(await publicPosts(page)).toEqual([expect.objectContaining({ slug: '2026-09-28-abc123' })]);

		await item.click({ button: 'right' });
		await page
			.getByRole('menu', { name: `${title} 메뉴` })
			.getByRole('menuitem', { name: '비밀 글로 지정' })
			.click();
		await expect(item.getByRole('img', { name: '비밀 글' })).toBeVisible();
		await expect(memo.locator('.memo-writer-meta .memo-secret-badge')).toHaveText('비밀 글');
		expect(find(api, '2026-09-28-abc123')?.secret).toBe(true);
		expect(await publicPosts(page)).toEqual([]);
		// 다른 사람에게 열리지 않는 글이라 링크 공유가 없다
		await expect(memo.getByRole('button', { name: '링크 공유' })).toHaveCount(0);

		// 검색 조건 '비밀 메모'로 모아 본다
		await memo.getByRole('button', { name: '검색 조건' }).first().click();
		await page.getByRole('menu', { name: '검색 조건' }).getByRole('menuitem', { name: '비밀 메모' }).click();
		await expect(memo.locator('.memo-item')).toHaveCount(1);
		await memo.getByRole('button', { name: '비밀 조건 지우기' }).click();

		await item.click({ button: 'right' });
		await page
			.getByRole('menu', { name: `${title} 메뉴` })
			.getByRole('menuitem', { name: '비밀 글 해제' })
			.click();
		await expect(item.getByRole('img', { name: '비밀 글' })).toHaveCount(0);
		await expect(memo.locator('.memo-secret-badge')).toHaveCount(0);
		expect(await publicPosts(page)).toEqual([expect.objectContaining({ slug: '2026-09-28-abc123' })]);
	});

	test('저장소 글은 비밀로 지정할 수 없고, 메뉴가 그 이유를 알린다', async ({ page }) => {
		await fakeApi(page, { signedIn: true });
		const memo = await openMemo(page);
		const title = 'CRA에서 Vite로 옮기기';
		await memo.locator('.memo-item', { hasText: title }).click({ button: 'right' });
		const secret = page.getByRole('menu', { name: `${title} 메뉴` }).getByRole('menuitem', { name: '비밀 글로 지정' });
		await expect(secret).toBeDisabled();
		await expect(secret).toHaveAttribute('title', /공개 저장소/);
	});

	test('방문자에게는 비밀 글이 목록에 없다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: false });
		api.posts = [serverPost('2026-09-28-abc123', '나만 볼 일기', true), serverPost('2026-09-28-def456', '공개한 글')];
		const memo = await openMemo(page);
		await expect(memo.locator('.memo-item', { hasText: '공개한 글' })).toBeVisible();
		await expect(memo.locator('.memo-item', { hasText: '나만 볼 일기' })).toHaveCount(0);
		await expect(memo.locator('.memo-item-secret, .memo-secret-badge')).toHaveCount(0);
	});
});
