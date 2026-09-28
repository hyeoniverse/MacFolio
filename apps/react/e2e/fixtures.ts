import { test as base, expect, type Page } from '@playwright/test';

/** 페이지에서 처리되지 않은 에러가 나면 테스트를 실패시킨다. */
export const test = base.extend<{ pageErrors: Error[] }>({
	pageErrors: [
		async ({ page }, use) => {
			const errors: Error[] = [];
			page.on('pageerror', (error) => errors.push(error));
			await use(errors);
			expect(errors, '페이지에서 처리되지 않은 에러가 발생했습니다').toEqual([]);
		},
		{ auto: true },
	],
});

export { expect };

/** 로딩 화면을 클릭해 넘기고 데스크톱에 들어간다. */
export async function enterDesktop(page: Page) {
	await page.goto('/');
	const loading = page.locator('.loading-container');
	await loading.click();
	await expect(loading).toBeHidden({ timeout: 10_000 });
}

export const dockItem = (page: Page, name: string) =>
	page.locator('.dock').getByRole('button', { name, exact: true });

export const appWindow = (page: Page, name: string) => page.locator(`[data-app="${name}"]`);

export async function zIndexOf(page: Page, name: string) {
	return appWindow(page, name).evaluate((el) => Number(getComputedStyle(el).zIndex));
}
