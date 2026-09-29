import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Page } from '@playwright/test';
import { fakeApi, type FakeApiState } from './fakeApi';

async function openMemo(page: Page) {
	await enterDesktop(page);
	await dockItem(page, 'memo').click();
	const memo = appWindow(page, 'memo');
	await expect(memo.locator('.memo-item').first()).toBeVisible();
	return memo;
}

/** 방문자가 받는 글 목록 (가짜 서버의 GET /posts) */
const publicPosts = (page: Page) =>
	page.evaluate(
		async () =>
			(await fetch('http://api.test/posts')).json() as Promise<{ slug: string; title: string; deleted: boolean }[]>
	);

const find = (api: FakeApiState, slug: string) => api.posts.find((post) => post.slug === slug);

test.describe('임시 저장·게시·버전 (관리자)', () => {
	test('고치면 임시 저장만 되고, 게시해야 방문자에게 보인다. 버리면 게시한 내용으로 돌아간다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		const memo = await openMemo(page);
		const item = memo.locator('.memo-item', { hasText: 'CRA에서 Vite로' });
		await item.click();

		const title = memo.getByRole('textbox', { name: '제목' });
		const publish = memo.getByRole('button', { name: '게시', exact: true });
		// 고친 것이 없으면 게시할 것도 없다
		await expect(publish).toBeDisabled();

		await title.fill('CRA에서 Vite로 (고치는 중)');
		await expect(memo.getByRole('status').filter({ hasText: '임시 저장됨' })).toBeVisible();
		expect(find(api, 'cra-to-vite')).toMatchObject({ published: null, draft: { title: 'CRA에서 Vite로 (고치는 중)' } });
		// 목록에는 게시하지 않은 변경 표시, 방문자는 아직 원래 글
		await expect(item.getByRole('img', { name: '게시하지 않은 변경' })).toBeVisible();
		expect(await publicPosts(page)).toEqual([]);

		await publish.click();
		await expect(memo.getByRole('status').filter({ hasText: '게시됨' })).toBeVisible();
		await expect(publish).toBeDisabled();
		await expect(item.getByRole('img', { name: '게시하지 않은 변경' })).toHaveCount(0);
		expect(await publicPosts(page)).toEqual([
			expect.objectContaining({ slug: 'cra-to-vite', title: 'CRA에서 Vite로 (고치는 중)', deleted: false }),
		]);

		// 다시 고치다가 버리면 게시한 내용으로
		await title.fill('버릴 제목');
		await expect(memo.getByRole('status').filter({ hasText: '임시 저장됨' })).toBeVisible();
		page.once('dialog', (dialog) => dialog.accept());
		await memo.getByRole('button', { name: '변경 사항 버리기' }).click();
		await expect(title).toHaveValue('CRA에서 Vite로 (고치는 중)');
		await expect(memo.getByRole('button', { name: '변경 사항 버리기' })).toHaveCount(0);
		expect(find(api, 'cra-to-vite')?.draft).toBeNull();
	});

	test('새 메모는 임시 저장으로 시작하고, 미래 날짜로 게시하면 예약되어 방문자에게 그날까지 보이지 않는다', async ({
		page,
	}) => {
		const api = await fakeApi(page, { signedIn: true });
		const memo = await openMemo(page);
		await memo.getByRole('button', { name: '새 메모', exact: true }).first().click();
		await page.keyboard.type('예약할 글');
		await page.keyboard.press('Enter');
		await page.keyboard.type('다음 달에 공개한다.');
		await expect(memo.getByRole('status').filter({ hasText: '임시 저장됨' })).toBeVisible();

		const item = memo.locator('.memo-item', { hasText: '예약할 글' });
		await expect(item.locator('.memo-status-badge')).toHaveText('임시 저장');
		// 게시하기 전에는 댓글·이전 글도 없다
		await expect(memo.getByRole('region', { name: '댓글' })).toHaveCount(0);
		// 게시한 적 없는 글에는 버릴 곳이 없다 (지우기로)
		await expect(memo.getByRole('button', { name: '변경 사항 버리기' })).toHaveCount(0);

		// 다음 달 15일로 바꾸면 '게시'가 '예약'이 된다
		await memo.getByRole('button', { name: /^날짜 .*, 바꾸기$/ }).click();
		const calendar = page.getByRole('dialog', { name: '날짜 고르기' });
		await calendar.getByRole('button', { name: '다음 달' }).click();
		await calendar.locator('[role=gridcell]', { hasText: /^15$/ }).click();
		const schedule = memo.getByRole('button', { name: '예약', exact: true });
		await expect(schedule).toBeEnabled();
		await schedule.click();
		await expect(memo.getByRole('status').filter({ hasText: /^예약됨 · .*에 공개$/ })).toBeVisible();

		const slug = api.posts[0].slug;
		expect(find(api, slug)?.published?.title).toBe('예약할 글');
		await expect(item.locator('.memo-status-badge')).toHaveText('예약');
		// 날짜로 묶으면 '예정'
		await expect(memo.locator('.memo-list').getByText('예정', { exact: true })).toBeVisible();
		// 방문자에게는 가리는 표시만
		expect(await publicPosts(page)).toEqual([expect.objectContaining({ slug, deleted: true, title: '' })]);
	});

	test('버전 기록: 게시한 버전과 저장소 원본을 미리 보고, 되돌리면 임시 저장으로 들어간다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		const memo = await openMemo(page);
		await memo.locator('.memo-item', { hasText: 'CRA에서 Vite로' }).click();
		const title = memo.getByRole('textbox', { name: '제목' });
		const publish = memo.getByRole('button', { name: '게시', exact: true });

		await title.fill('첫 판');
		await publish.click();
		await expect(memo.getByRole('status').filter({ hasText: '게시됨' })).toBeVisible();
		await title.fill('둘째 판');
		await publish.click();
		await expect(publish).toBeDisabled();

		await memo.getByRole('button', { name: '버전 기록', exact: true }).click();
		const panel = page.getByRole('dialog', { name: '버전 기록' });
		const versions = panel.getByRole('list', { name: '버전' }).getByRole('button');
		await expect(versions).toHaveCount(3);
		await expect(versions.nth(0)).toContainText('둘째 판');
		await expect(versions.nth(1)).toContainText('첫 판');
		await expect(versions.nth(2)).toContainText('원본');

		// 원본 미리 보기
		await versions.nth(2).click();
		await expect(panel.getByRole('heading', { level: 1 })).toHaveText('CRA에서 Vite로 옮기기');
		await panel.getByRole('button', { name: '버전 목록' }).click();

		// 첫 판으로 되돌리면 편집기 내용이 바뀌고 임시 저장된다 (게시는 따로)
		await versions.nth(1).click();
		await expect(panel.getByRole('heading', { level: 1 })).toHaveText('첫 판');
		await panel.getByRole('button', { name: '이 버전으로 되돌리기' }).click();
		await expect(panel).toBeHidden();
		await expect(title).toHaveValue('첫 판');
		await expect.poll(() => find(api, 'cra-to-vite')?.draft?.title).toBe('첫 판');
		expect(find(api, 'cra-to-vite')?.published?.title).toBe('둘째 판');
		await expect(publish).toBeEnabled();
	});
});

test.describe('방문자', () => {
	test('게시한 적 없는 글과 예약 글은 보이지 않는다 (예약한 저장소 글도 가린다)', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: false });
		const content = (title: string, date: string) => ({
			title,
			date,
			category: '개발기/MacFolio',
			summary: '',
			body: '본문',
		});
		api.posts = [
			{
				slug: 'draft-only',
				...content('임시 저장만 한 글', '2026-09-29'),
				deleted: false,
				published: null,
				draft: content('임시 저장만 한 글', '2026-09-29'),
			},
			{
				slug: 'cra-to-vite',
				...content('예약한 고침', '2999-01-01'),
				deleted: false,
				published: content('예약한 고침', '2999-01-01'),
				draft: null,
			},
			{
				slug: 'shown',
				...content('게시한 글', '2026-09-01'),
				deleted: false,
				published: content('게시한 글', '2026-09-01'),
				draft: null,
			},
		];
		const memo = await openMemo(page);
		await expect(memo.locator('.memo-item', { hasText: '게시한 글' })).toBeVisible();
		await expect(memo.locator('.memo-item', { hasText: '임시 저장만 한 글' })).toHaveCount(0);
		await expect(memo.locator('.memo-item', { hasText: '예약한 고침' })).toHaveCount(0);
		await expect(memo.locator('.memo-item', { hasText: 'CRA에서 Vite로' })).toHaveCount(0);
		await expect(memo.locator('.memo-status-badge, .memo-status-dot')).toHaveCount(0);
	});
});
