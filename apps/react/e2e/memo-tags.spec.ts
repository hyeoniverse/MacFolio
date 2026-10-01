import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Page } from '@playwright/test';
import { fakeApi, type FakeApiState, type FakePost } from './fakeApi';

/** 서버에 게시한 글 (본문에 #태그) */
const published = (slug: string, title: string, body: string): FakePost => {
	const content = { title, date: '2026-09-30', category: '개발기/MacFolio', summary: '', body };
	return { slug, ...content, deleted: false, published: content };
};

async function openMemo(page: Page, api: FakeApiState) {
	void api;
	await enterDesktop(page);
	await dockItem(page, 'memo').click();
	const memo = appWindow(page, 'memo');
	await expect(memo.locator('.memo-item').first()).toBeVisible();
	return memo;
}

test.describe('태그', () => {
	test('본문의 #태그가 사이드바에 모이고, 누르면 그 태그의 글만 본다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: false });
		api.posts = [
			published(
				'2026-09-30-a',
				'태그 글 하나',
				'오늘은 #리팩터링 과 #CSS 를 했다.\n\n```css\n.a { color: #edbb4d; }\n```'
			),
			published('2026-09-30-b', '태그 글 둘', '#리팩터링 이어서. Refs #14'),
		];
		const memo = await openMemo(page, api);

		// 글이 많은 태그가 앞. 코드 안의 색, 이슈 번호는 태그가 아니다 (저장소 글의 태그도 함께 있다)
		const browser = memo.getByRole('navigation', { name: '카테고리' }).getByRole('region', { name: '태그' });
		await expect(browser.getByRole('button').first()).toHaveText('#리팩터링');
		await expect(browser.getByRole('button', { name: '#CSS' })).toBeVisible();
		await expect(browser.getByRole('button', { name: /^#(14|edbb4d)$/ })).toHaveCount(0);

		// 태그를 누르면 그 태그의 글만, 제목은 #태그
		await browser.getByRole('button', { name: '#CSS' }).click();
		await expect(memo.locator('.memo-item')).toHaveText([/태그 글 하나/]);
		await expect(memo.locator('.memo-toolbar-heading h2').first()).toHaveText('#CSS');

		// 읽기 화면의 #태그도 누를 수 있다
		await memo.locator('.memo-item', { hasText: '태그 글 하나' }).click();
		await memo.locator('.memo-markdown .memo-tag', { hasText: '#리팩터링' }).click();
		await expect(memo.locator('.memo-toolbar-heading h2').first()).toHaveText('#리팩터링');
		await expect(memo.locator('.memo-item')).toHaveCount(2);

		// 고른 태그를 한 번 더 누르면 모든 글로
		await browser.getByRole('button', { name: '#리팩터링' }).click();
		await expect(memo.locator('.memo-toolbar-heading h2').first()).toHaveText('모든 글');
	});

	test('편집기에서 쓴 #태그는 바로 칠해지고 사이드바에도 생긴다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		const memo = await openMemo(page, api);
		await memo.getByRole('button', { name: '새 메모', exact: true }).first().click();
		await page.keyboard.type('태그 쓰기');
		await page.keyboard.press('Enter');
		await page.keyboard.type('오늘 배운 것 #새태그 정리, `#코드` 는 아님');
		await expect(memo.locator('.ProseMirror .memo-tag')).toHaveText(['#새태그']);
		await expect.poll(() => api.posts[0]?.body).toContain('#새태그');
		const browser = memo.getByRole('navigation', { name: '카테고리' }).getByRole('region', { name: '태그' });
		await expect(browser.getByRole('button', { name: '#새태그' })).toBeVisible();
	});
});
