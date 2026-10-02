import { test, expect, enterDesktop, dockItem } from './fixtures';

// 배포로 메모 코드 파일 이름이 바뀌어, 열려 있던 페이지가 옛 파일을 못 찾는 경우
const MEMO_CHUNK = /\/assets\/Memo-[^/]+\.js(\?.*)?$/;

test.describe('앱 코드를 못 불러올 때', () => {
	test('새로고침을 권하고, 닫으면 사라진다', async ({ page }) => {
		await page.route(MEMO_CHUNK, (route) => route.abort());
		await enterDesktop(page);

		await dockItem(page, 'memo').click();
		const alert = page.getByRole('alertdialog', { name: '새 버전이 있어요' });
		await expect(alert).toBeVisible();
		await expect(alert).toContainText('메모 앱을 열려면 페이지를 새로고침해 주세요.');
		await expect(alert.getByRole('button', { name: '새로고침' })).toBeFocused();

		await alert.getByRole('button', { name: '닫기' }).click();
		await expect(alert).toBeHidden();
	});

	test('새로고침하면 새 코드로 연다', async ({ page }) => {
		await page.route(MEMO_CHUNK, (route) => route.abort());
		await enterDesktop(page);
		await dockItem(page, 'memo').click();
		const alert = page.getByRole('alertdialog', { name: '새 버전이 있어요' });
		await expect(alert).toBeVisible();

		await page.unroute(MEMO_CHUNK);
		await alert.getByRole('button', { name: '새로고침' }).click();
		await expect(page.locator('.loading-container')).toBeVisible();
	});
});
