import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import { fakeApi } from './fakeApi';
import { layoutPost } from './memoLayoutPost';

async function enterHome(page: Page, path: string) {
	await page.goto(path);
	const loading = page.locator('.loading-container');
	await expect(loading).toContainText('탭하여');
	await loading.tap();
	await expect(loading).toBeHidden({ timeout: 20_000 });
}

test.describe('휴대폰 메모: 목차와 이미지 배치', () => {
	test('목차는 접힌 채 시작하고, 탭하면 열리고 바깥을 탭하면 닫힌다. 항목을 누르면 그 제목으로 간다. 떠 있는 목차 버튼은 없다', async ({
		page,
	}) => {
		await fakeApi(page, { signedIn: false });
		await enterHome(page, '/memo/merge-strategies');
		const toc = page.getByRole('navigation', { name: '목차' });
		const toggle = toc.getByRole('button', { name: '목차', exact: true });
		const list = toc.locator('.memo-toc-list');
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await expect(list).toBeHidden();
		await toggle.tap();
		await expect(list).toBeVisible();
		await page.locator('.memo-reader-body h1').tap();
		await expect(list).toBeHidden();

		await toggle.tap();
		const item = toc.locator('li button').nth(2);
		const name = (await item.textContent())!.trim();
		await item.tap();
		await expect(
			page.locator('.memo-reader-body .memo-markdown').getByRole('heading', { name }).first()
		).toBeInViewport();
		// 잠깐 연 목록은 고르면 닫힌다
		await expect(list).toBeHidden();
		await expect(page.getByRole('button', { name: '목차 보기' })).toHaveCount(0);
	});

	test('목차를 길게 누르면 펼친 채 고정되고, 항목을 골라도 남는다', async ({ page }) => {
		await fakeApi(page, { signedIn: false });
		await enterHome(page, '/memo/merge-strategies');
		const toc = page.getByRole('navigation', { name: '목차' });
		const toggle = toc.getByRole('button', { name: '목차', exact: true });
		const list = toc.locator('.memo-toc-list');
		const box = (await toggle.boundingBox())!;
		const at = {
			clientX: box.x + box.width / 2,
			clientY: box.y + box.height / 2,
			pointerType: 'touch',
			isPrimary: true,
		};
		await toggle.dispatchEvent('pointerdown', at);
		await page.waitForTimeout(650);
		await toggle.dispatchEvent('pointerup', at);
		// 손을 떼면 오는 click은 무시한다 (고정을 바로 풀지 않게)
		await toggle.dispatchEvent('click', { detail: 1 });
		await expect(toggle).toHaveAttribute('aria-pressed', 'true');
		await expect(list).toBeVisible();
		await toc.locator('li button').nth(1).tap();
		await expect(list).toBeVisible();
		// 고정한 뒤 탭하면 풀고 접는다
		await toggle.tap();
		await expect(toggle).toHaveAttribute('aria-pressed', 'false');
		await expect(list).toBeHidden();
	});

	test('띄운 이미지는 휴대폰에서 띄우지 않고 본문 폭으로 보인다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: false });
		api.posts = [layoutPost()];
		await enterHome(page, '/memo/layout-test');
		const body = page.locator('.memo-reader-body .memo-markdown');
		const figure = body.locator('.memo-figure[data-layout="float-left"]');
		await expect(figure).toBeVisible();
		expect(await figure.evaluate((el) => getComputedStyle(el).float)).toBe('none');
		const [area, rect] = await Promise.all([body.boundingBox(), figure.boundingBox()]);
		expect(Math.abs(rect!.width - area!.width)).toBeLessThan(2);
	});
});
