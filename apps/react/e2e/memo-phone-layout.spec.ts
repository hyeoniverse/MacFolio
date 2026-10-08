import { test, expect, enterDesktop, appWindow } from './fixtures';
import type { Page } from '@playwright/test';
import { fakeApi } from './fakeApi';

const box = async (page: Page, selector: string) => (await page.locator(selector).first().boundingBox())!;

/** 휴대폰 화면(모바일 셸)의 메모 글 화면: 떠 있는 위 단추 줄은 상태 표시줄 아래, 본문은 화면 끝까지, 아래 막대는 본문 위에 뜬다 */
async function expectPhoneReader(page: Page) {
	const memo = appWindow(page, 'memo');
	await memo.locator('.memo-item').first().click();
	await expect(memo.locator('.memo-phone-top')).toBeVisible();
	// 넓은 창의 도구 막대(상태 표시줄에 가리던 것)는 보이지 않는다
	await expect(memo.locator('.memo-reader .memo-toolbar')).toBeHidden();
	const status = await box(page, '.mobile-statusbar');
	const top = await box(page, '[data-app="memo"] .memo-phone-top');
	expect(top.y).toBeGreaterThanOrEqual(status.y + status.height);
	// 본문은 화면 맨 아래까지 이어지고, 아래 막대는 그 위에 겹쳐 뜬다
	const viewport = page.viewportSize()!;
	const scroll = await box(page, '[data-app="memo"] .memo-reader .memo-scroll');
	const bottom = await box(page, '[data-app="memo"] .memo-reader .memo-phone-bottom');
	expect(Math.round(scroll.y + scroll.height)).toBe(viewport.height);
	expect(bottom.y + bottom.height).toBeLessThanOrEqual(viewport.height);
	expect(bottom.y).toBeGreaterThan(scroll.y + scroll.height - 120);
	// 목록·폴더 칸은 옆에 없다 (한 칸씩)
	await expect(memo.locator('.memo-list')).toBeHidden();
}

test.describe('메모: 휴대폰 화면이면 폭과 상관없이 한 칸씩', () => {
	test.describe('767px 바로 아래 (메모 칸이 700px보다 넓다)', () => {
		test.use({ viewport: { width: 760, height: 820 } });
		test('글 화면은 휴대폰 모양: 위 단추 줄이 상태 표시줄에 가리지 않고, 아래 막대는 본문 위에 뜬다', async ({
			page,
		}) => {
			await fakeApi(page, { signedIn: true });
			await enterDesktop(page);
			await page.locator('[data-launch="memo"]').click();
			await expectPhoneReader(page);
		});
	});

	test.describe('넓지만 낮은 가로 휴대폰', () => {
		test.use({ viewport: { width: 900, height: 430 } });
		test('글 화면은 휴대폰 모양', async ({ page }) => {
			await fakeApi(page, { signedIn: true });
			await enterDesktop(page);
			await page.locator('[data-launch="memo"]').click();
			await expectPhoneReader(page);
		});
	});

	test.describe('휴대폰', () => {
		test.use({ viewport: { width: 390, height: 844 } });
		test('새 메모에 긴 글을 써도 쓰는 줄은 아래 서식 막대에 가리지 않는다', async ({ page }) => {
			await fakeApi(page, { signedIn: true });
			await enterDesktop(page);
			await page.locator('[data-launch="memo"]').click();
			const memo = appWindow(page, 'memo');
			await expect(memo.locator('.memo-item').first()).toBeVisible();
			await memo.getByRole('button', { name: '새 메모' }).first().click();
			await page.keyboard.type('제목');
			await page.keyboard.press('Enter');
			for (let line = 0; line < 30; line++) await page.keyboard.press('Enter');
			await page.keyboard.type('끝 줄');
			const last = memo.locator('.ProseMirror p', { hasText: '끝 줄' });
			await expect(last).toBeVisible();
			const bar = await box(page, '[data-app="memo"] .memo-reader .memo-phone-bottom');
			const lineBottom = () => last.evaluate((element) => element.getBoundingClientRect().bottom);
			await expect.poll(lineBottom).toBeLessThanOrEqual(bar.y);
		});
	});
});
