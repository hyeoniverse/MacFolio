import { test, expect, enterDesktop, appWindow, dockItem } from './fixtures';
import { fakeApi } from './fakeApi';

const pathOf = (url: string) => new URL(url).pathname;

test.describe('앱 항목 주소와 공유', () => {
	test('글 주소로 들어오면 메모 앱이 그 글로 열리고, 글을 바꾸면 주소 막대도 바뀐다', async ({ page }) => {
		await enterDesktop(page, '/memo/cra-to-vite');
		const memo = appWindow(page, 'memo');
		await expect(memo.getByRole('article').getByRole('heading', { level: 1 })).toHaveText('CRA에서 Vite로 옮기기');
		expect(pathOf(page.url())).toBe('/memo/cra-to-vite');

		// 다른 글을 고르면 주소도 그 글로
		await memo.locator('.memo-item', { hasText: 'Markdown 블로그에 글쓰기 붙이기' }).click();
		await expect.poll(() => pathOf(page.url())).toMatch(/^\/memo\/[^/]+$/);
		expect(pathOf(page.url())).not.toBe('/memo/cra-to-vite');

		// 창을 닫으면 사이트 주소로
		await memo.getByRole('button', { name: '닫기', exact: true }).click();
		await expect.poll(() => pathOf(page.url())).toBe('/');
	});

	test('공유 단추는 글 주소를 복사하고 알린다', async ({ page, context }) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await enterDesktop(page, '/memo/cra-to-vite');
		const memo = appWindow(page, 'memo');
		await memo.getByRole('button', { name: '링크 공유' }).click();
		await expect(
			page.getByRole('status').filter({ hasText: '‘CRA에서 Vite로 옮기기’ 링크를 복사했습니다.' })
		).toBeVisible();
		expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
			`${new URL(page.url()).origin}/memo/cra-to-vite`
		);
	});

	test('관리자가 고치는 중에는 공유가 ••• 메뉴에 있다 (도구 막대는 서식 도구로 꽉 찬다)', async ({ page, context }) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await fakeApi(page, { signedIn: true });
		await enterDesktop(page, '/memo/cra-to-vite');
		const memo = appWindow(page, 'memo');
		await expect(memo.locator('.ProseMirror')).toBeVisible();
		await expect(memo.locator('.memo-reader-toolbar').getByRole('button', { name: '링크 공유' })).toHaveCount(0);
		await memo.getByRole('searchbox', { name: '글 검색' }).focus();
		await memo.getByRole('button', { name: '도구 더 보기' }).click();
		await page.getByRole('menu', { name: '도구 더 보기' }).getByRole('menuitem', { name: '링크 공유' }).click();
		expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
			`${new URL(page.url()).origin}/memo/cra-to-vite`
		);
	});

	test('프로젝트 주소로 들어오면 Safari가 그 탭으로 열리고, 공유하면 그 주소를 복사한다', async ({ page, context }) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await enterDesktop(page, '/safari/sproutfarm');
		const safari = appWindow(page, 'safari');
		await expect(safari.getByRole('tab', { selected: true })).toContainText('SproutFarm');
		expect(pathOf(page.url())).toBe('/safari/sproutfarm');

		// 다른 탭으로 가면 주소도 바뀐다
		await safari.getByRole('tab', { name: /QRU/ }).click();
		await expect.poll(() => pathOf(page.url())).toBe('/safari/qru');

		await safari.getByRole('button', { name: '링크 공유' }).click();
		await expect(page.getByRole('status').filter({ hasText: '링크를 복사했습니다.' })).toBeVisible();
		expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${new URL(page.url()).origin}/safari/qru`);
	});

	test('주소 막대는 맨 앞 창을 따른다', async ({ page }) => {
		await enterDesktop(page, '/memo/cra-to-vite');
		expect(pathOf(page.url())).toBe('/memo/cra-to-vite');
		// Safari를 앞으로 가져오면: 아직 탭을 고르지 않았으니 사이트 주소
		await dockItem(page, 'safari').click();
		await expect.poll(() => pathOf(page.url())).toBe('/');
		// 탭을 고르면 그 탭의 주소, 메모를 다시 앞으로 가져오면 글 주소
		await appWindow(page, 'safari').getByRole('tab', { name: /QRU/ }).click();
		await expect.poll(() => pathOf(page.url())).toBe('/safari/qru');
		await dockItem(page, 'memo').click();
		await expect.poll(() => pathOf(page.url())).toBe('/memo/cra-to-vite');
	});

	test('사이트 주소로 들어오면 처음 보이는 창이 주소를 바꾸지 않는다', async ({ page }) => {
		await enterDesktop(page);
		await expect(appWindow(page, 'safari')).toBeVisible();
		await page.waitForTimeout(300);
		expect(pathOf(page.url())).toBe('/');
	});

	test('없는 항목의 주소는 앱만 연다', async ({ page }) => {
		await enterDesktop(page, '/safari/없는-프로젝트');
		await expect(appWindow(page, 'safari').getByRole('tab', { selected: true })).toBeVisible();
	});
});
