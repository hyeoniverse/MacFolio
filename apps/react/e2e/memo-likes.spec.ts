import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import { readdirSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { fakeApi, type FakeComment } from './fakeApi';

const CRA = 'CRA에서 Vite로 옮기기';
const EDITOR = 'Markdown 블로그에 글쓰기 붙이기';
const MONITOR = '무료 서버가 회수되기 전에 - 사용률을 재고 위험하면 메일로';

async function openMemo(page: Page) {
	await enterDesktop(page);
	await dockItem(page, 'memo').click();
	return appWindow(page, 'memo');
}

const comment = (id: string, extra: Partial<FakeComment> = {}): FakeComment => ({
	id,
	name: '🐼 졸린 판다',
	ipPrefix: '1.2',
	isAdmin: false,
	body: `댓글 ${id}`,
	createdAt: '2026-09-29T00:00:00.000Z',
	mine: false,
	...extra,
});

test.describe('좋아요', () => {
	test('방문자는 로그인 없이 글에 좋아요를 누르고, 다시 누르면 취소한다', async ({ page }) => {
		const api = await fakeApi(page);
		api.postLikes['cra-to-vite'] = { count: 4, liked: false };
		const memo = await openMemo(page);
		await memo.locator('.memo-item', { hasText: CRA }).click();

		const like = memo.getByRole('button', { name: '이 글 좋아요 4개' });
		await expect(like).toHaveAttribute('aria-pressed', 'false');
		await expect(like).toContainText('좋아요 4');
		await like.click();
		const liked = memo.getByRole('button', { name: '이 글 좋아요 5개' });
		await expect(liked).toHaveAttribute('aria-pressed', 'true');
		await expect(liked.locator('i')).toHaveClass(/fa-solid/);
		expect(api.postLikes['cra-to-vite']).toEqual({ count: 5, liked: true });

		await liked.click();
		await expect(memo.getByRole('button', { name: '이 글 좋아요 4개' })).toHaveAttribute('aria-pressed', 'false');
		expect(api.postLikes['cra-to-vite']).toEqual({ count: 4, liked: false });

		// 다른 글로 가면 그 글의 좋아요
		await memo.locator('.memo-item', { hasText: EDITOR }).click();
		await expect(memo.getByRole('button', { name: '이 글 좋아요 0개' })).toBeVisible();
	});

	test('댓글에도 좋아요: 수는 0이면 숨기고, 누른 댓글은 빨간 하트', async ({ page }) => {
		const api = await fakeApi(page);
		api.comments['cra-to-vite'] = [comment('v1', { likes: 2 }), comment('v2')];
		const memo = await openMemo(page);
		await memo.locator('.memo-item', { hasText: CRA }).click();
		const comments = memo.getByRole('region', { name: '댓글' });

		const first = comments.getByRole('button', { name: '🐼 졸린 판다의 댓글 좋아요 2개' });
		await expect(first).toHaveText('2');
		const second = comments.getByRole('button', { name: '🐼 졸린 판다의 댓글 좋아요 0개' });
		await expect(second).toHaveText('');

		await second.click();
		await expect(comments.getByRole('button', { name: '🐼 졸린 판다의 댓글 좋아요 1개' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		expect(api.comments['cra-to-vite'][1]).toMatchObject({ likes: 1, liked: true });
	});

	test('서버가 없으면 좋아요 단추도 인기글도 없다', async ({ page }) => {
		const memo = await openMemo(page);
		await memo.locator('.memo-item', { hasText: CRA }).click();
		// 목록의 글 제목에도 '좋아요'·'인기글'이 있을 수 있어서 단추의 모양으로 찾는다
		await expect(memo.locator('.memo-like')).toHaveCount(0);
		await expect(memo.locator('.memo-popular-folder')).toHaveCount(0);
		await expect(memo.locator('.memo-folder')).not.toHaveCount(0);
	});
});

test.describe('인기글', () => {
	test('조회·댓글·좋아요 점수 순서로 순위와 반응을 보이고, 좋아요를 누르면 순위가 바로 바뀐다', async ({ page }) => {
		const api = await fakeApi(page);
		// 점수 = 조회 + 좋아요×3 + 댓글×5
		api.analyticsViews = { memo: { 'cra-to-vite': 42, 'post-editor': 7 } }; // 42, 7
		api.comments['post-editor'] = [comment('a'), comment('b'), comment('c')]; // 7 + 15 = 22
		api.postLikes['resource-monitor'] = { count: 7, liked: false }; // 21
		const memo = await openMemo(page);

		const folder = memo.getByRole('button', { name: /^인기글/ });
		await expect(folder.locator('.memo-count')).toHaveText('3');
		await folder.click();
		await expect(memo.locator('.memo-toolbar-heading h2').first()).toHaveText('인기글');

		const items = memo.locator('.memo-list .memo-item');
		await expect(items).toHaveCount(3);
		await expect(items.nth(0)).toContainText(`1${CRA}`);
		await expect(items.nth(0).locator('.memo-item-meta')).toHaveText('조회 42');
		await expect(items.nth(1)).toContainText(`2${EDITOR}`);
		await expect(items.nth(1).locator('.memo-item-meta')).toHaveText('조회 7 · 댓글 3');
		await expect(items.nth(2)).toContainText(`3${MONITOR}`);
		await expect(items.nth(2).locator('.memo-item-meta')).toHaveText('좋아요 7');
		// 날짜별 묶음·고정 묶음 없이 순위 그대로
		await expect(memo.locator('.memo-list .memo-section-title')).toHaveCount(0);

		// 3위 글에 좋아요 → 21 + 3 = 24 > 22: 2위로
		await items.nth(2).click();
		await memo.getByRole('button', { name: '이 글 좋아요 7개' }).click();
		await expect(items.nth(1)).toContainText(`2${MONITOR}`);
		await expect(items.nth(1).locator('.memo-item-meta')).toHaveText('좋아요 8');
		await expect(items.nth(2)).toContainText(`3${EDITOR}`);
	});

	test('반응이 있는 글이 많아도 10개까지, 순위는 검색으로 걸러도 그대로', async ({ page }) => {
		const api = await fakeApi(page);
		// 저장소의 글마다 조회수 1~N (파일 이름 순서대로)
		const slugs = readdirSync('src/apps/memo/content')
			.filter((name) => name.endsWith('.md'))
			.map((name) => name.slice(0, -3))
			.sort();
		expect(slugs.length).toBeGreaterThan(10);
		api.analyticsViews = { memo: Object.fromEntries(slugs.map((slug, index) => [slug, index + 1])) };
		api.analyticsViews.memo['cra-to-vite'] = 1000;
		const memo = await openMemo(page);
		const folder = memo.getByRole('button', { name: /^인기글/ });
		await expect(folder.locator('.memo-count')).toHaveText('10');
		await folder.click();
		const items = memo.locator('.memo-list .memo-item');
		await expect(items).toHaveCount(10);
		await expect(items.first()).toContainText(`1${CRA}`);

		// 검색어로 거르면 남은 글의 순위는 그대로
		await memo.getByRole('searchbox').first().fill('Vite');
		await expect(items.first().locator('.memo-item-rank')).toHaveText('1');
	});
});
