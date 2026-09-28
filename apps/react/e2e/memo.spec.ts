import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';

test('Memo: 작성한 메모가 유지되고, 비밀번호가 맞아야 삭제된다', async ({ page }) => {
	const storedTitles = () =>
		page.evaluate(() =>
			Object.values(JSON.parse(localStorage.getItem('macfolio:memos') ?? '{"memos":{}}').memos).map(
				(memo) => (memo as { title: string }).title
			)
		);

	await enterDesktop(page);
	await dockItem(page, 'memo').click();
	const memo = appWindow(page, 'memo');
	await expect(memo.locator('.folder-list')).toContainText('모든 메모');

	// 작성
	await memo.locator('button:has(svg[class*="pen"])').click();
	await memo.locator('.create-memo-title').fill('E2E 테스트');
	await memo.locator('.create-memo-content').fill('내용입니다');
	await memo.locator('button:has(.fa-check)').click();
	await page.getByPlaceholder('삭제 시 이용할 비밀번호를 입력해주세요').fill('pw1234');
	await page.getByRole('button', { name: '확인' }).click();
	await expect.poll(storedTitles).toContain('E2E 테스트');

	// 새로고침 후에도 유지
	await enterDesktop(page);
	await dockItem(page, 'memo').click();
	await expect(memo.locator('.notes-list')).toContainText('E2E 테스트');

	// 틀린 비밀번호로는 삭제되지 않음
	await memo.locator('.notes-list').getByText('E2E 테스트').click();
	await memo.locator('button:has(svg[class*="trash"])').click();
	await page.getByPlaceholder('비밀번호를 입력해주세요', { exact: true }).fill('wrong');
	await page.getByRole('button', { name: '삭제' }).click();
	await expect.poll(storedTitles).toContain('E2E 테스트');
	await page.getByRole('button', { name: '확인' }).first().click();

	// 맞는 비밀번호로 삭제
	await memo.locator('.notes-list').getByText('E2E 테스트').click();
	await memo.locator('button:has(svg[class*="trash"])').click();
	await page.getByPlaceholder('비밀번호를 입력해주세요', { exact: true }).fill('pw1234');
	await page.getByRole('button', { name: '삭제' }).click();
	await expect.poll(storedTitles).not.toContain('E2E 테스트');
});
