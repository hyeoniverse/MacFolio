import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Page } from '@playwright/test';

async function openMemo(page: Page) {
	await enterDesktop(page);
	await dockItem(page, 'memo').click();
	const memo = appWindow(page, 'memo');
	await expect(memo).toBeVisible();
	return memo;
}

test.describe('메모 (블로그)', () => {
	test('글 목록이 최신순으로 보이고, 첫 글의 본문이 열린다', async ({ page }) => {
		const memo = await openMemo(page);
		const items = memo.getByRole('region', { name: '글 목록' }).locator('.memo-item');
		await expect(items).not.toHaveCount(0);

		const firstTitle = (await items.first().locator('strong').textContent())!;
		await expect(memo.getByRole('article')).toHaveAccessibleName(firstTitle);
		await expect(memo.getByRole('article').getByRole('heading', { level: 1 })).toHaveText(firstTitle);
	});

	test('글을 고르면 Markdown 본문(제목, 표, 코드)이 렌더링된다', async ({ page }) => {
		const memo = await openMemo(page);
		await memo.locator('.memo-item', { hasText: 'CRA에서 Vite로 옮기기' }).click();

		const article = memo.getByRole('article', { name: 'CRA에서 Vite로 옮기기' });
		await expect(article.getByRole('heading', { name: '왜 옮겼나' })).toBeVisible();
		await expect(article.getByRole('table')).toContainText('dev 서버 시작');
		await expect(article.locator('code').first()).toBeVisible();
	});

	test('카테고리와 검색어로 글을 거른다', async ({ page }) => {
		const memo = await openMemo(page);
		const items = memo.locator('.memo-item');
		const total = await items.count();

		const folders = memo.getByRole('navigation', { name: '카테고리' });
		await folders.getByRole('button', { name: /^개발기/ }).click();
		await expect(items).not.toHaveCount(0);

		await memo.getByRole('searchbox', { name: '글 검색' }).fill('Fast Refresh');
		await expect(items).toHaveCount(1);
		await expect(items.first()).toContainText('CRA에서 Vite로 옮기기');

		await memo.getByRole('searchbox', { name: '글 검색' }).fill('존재하지 않는 검색어');
		await expect(memo.getByText('검색 결과가 없습니다.')).toBeVisible();

		await memo.getByRole('searchbox', { name: '글 검색' }).fill('');
		await folders.getByRole('button', { name: /^모든 글/ }).click();
		await expect(items).toHaveCount(total);
	});

	test('본문 이미지는 본문 폭에 맞춰 보이고, 클릭하면 크게 본다', async ({ page }) => {
		const memo = await openMemo(page);
		await memo.locator('.memo-item', { hasText: 'CRA에서 Vite로 옮기기' }).click();

		const image = memo.getByRole('img', { name: 'CRA와 Vite의 빌드 시간 비교 그래프' });
		await image.scrollIntoViewIfNeeded();
		await expect(image).toBeVisible();
		// 글 파일 기준 상대 경로가 실제로 불러와졌다
		expect(await image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
		const imageBox = (await image.boundingBox())!;
		const readerBox = (await memo.locator('.memo-markdown').boundingBox())!;
		expect(imageBox.width).toBeLessThanOrEqual(readerBox.width + 1);
		await expect(memo.locator('.memo-caption')).toHaveText('dev 서버 시작과 프로덕션 빌드 시간 (초)');

		await memo.getByRole('button', { name: /크게 보기/ }).click();
		const lightbox = page.getByRole('dialog', { name: 'CRA와 Vite의 빌드 시간 비교 그래프' });
		await expect(lightbox).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(lightbox).toBeHidden();

		await memo.getByRole('button', { name: /크게 보기/ }).click();
		await lightbox.click();
		await expect(lightbox).toBeHidden();
	});

	test('본문의 링크는 새 탭으로 열린다', async ({ page }) => {
		const memo = await openMemo(page);
		const links = memo.getByRole('article').locator('.memo-markdown a');
		for (const link of await links.all()) {
			await expect(link).toHaveAttribute('target', '_blank');
			await expect(link).toHaveAttribute('rel', /noopener/);
		}
	});

	test('예전 메모(방명록) 데이터는 지운다', async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => localStorage.setItem('macfolio:memos', '{"folders":{},"memos":{}}'));
		await openMemo(page);
		expect(await page.evaluate(() => localStorage.getItem('macfolio:memos'))).toBeNull();
	});

	test('사이드바를 여닫을 수 있다', async ({ page }) => {
		const memo = await openMemo(page);
		const folders = memo.getByRole('navigation', { name: '카테고리' });
		await expect(folders.getByRole('button', { name: /모든 글/ })).toBeVisible();

		await memo.getByRole('button', { name: '사이드바 가리기' }).click();
		await expect(folders.getByRole('button', { name: /모든 글/ })).toBeHidden();
		await expect(memo.getByRole('region', { name: '글 목록' })).toBeVisible();

		await memo.getByRole('button', { name: '사이드바 보기' }).click();
		await expect(folders.getByRole('button', { name: /모든 글/ })).toBeVisible();
	});
});
