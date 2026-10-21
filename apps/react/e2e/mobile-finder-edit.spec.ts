import type { Locator, Page } from '@playwright/test';
import { test, expect, appWindow } from './fixtures';
import { fakeApi } from './fakeApi';
import { fakeFiles } from './fakeFiles';

// 휴대폰 파일 앱의 관리자 편집: ••• 의 새 폴더, 길게 눌러 이름 변경·휴지통으로 이동 (데스크톱 Finder와 같은 구조를 저장한다)

async function openFiles(page: Page) {
	await page.goto('/');
	const loading = page.locator('.loading-container');
	await loading.tap();
	await expect(loading).toBeHidden({ timeout: 20_000 });
	const home = page.locator('.mobile-home');
	const pages = home.locator('.mobile-page');
	for (let index = 0; index < (await pages.count()); index++) {
		if ((await pages.nth(index).locator('.mobile-app[aria-label="파일"]').count()) === 0) continue;
		await home.getByRole('tab', { name: `${index + 1}쪽` }).click();
		break;
	}
	await home.getByRole('button', { name: '파일', exact: true }).tap();
	const files = appWindow(page, 'finder');
	await files.getByRole('navigation', { name: '파일 탭' }).getByRole('button', { name: '둘러보기' }).tap();
	return files;
}

/** 손가락으로 길게 누른다 (누른 채 0.7초) */
async function longPress(item: Locator) {
	const box = (await item.boundingBox())!;
	const at = { pointerType: 'touch', isPrimary: true, clientX: box.x + box.width / 2, clientY: box.y + 20 };
	await item.dispatchEvent('pointerdown', at);
	await item.page().waitForTimeout(700);
	await item.dispatchEvent('pointerup', at);
	await item.dispatchEvent('click');
}

test.describe('휴대폰 파일 앱 편집', () => {
	test('관리자는 그림에 새 폴더를 만들고, 길게 눌러 이름을 바꾸고 휴지통으로 보낸다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		await fakeFiles(page);
		const files = await openFiles(page);
		// 즐겨찾기의 그림 (사진 위젯의 그림 폴더를 여기서 만든다)
		await files.getByRole('region', { name: '즐겨찾기' }).getByRole('button', { name: '그림' }).tap();
		await expect(files.locator('.files-phone-bar-title')).toHaveText('그림');

		await files.getByRole('button', { name: '보기 옵션' }).tap();
		await page.getByRole('menuitem', { name: '새 폴더' }).tap();
		const name = files.getByRole('textbox', { name: '이름' });
		await expect(name).toHaveValue('이름 없는 폴더');
		await name.fill('위젯');
		await name.press('Enter');
		const folder = files.getByRole('button', { name: /^위젯/ });
		await expect(folder).toBeVisible();
		await expect
			.poll(() => api.finderLayout.folders.map(({ name, parent }) => `${parent}/${name}`))
			.toEqual(['pictures/위젯']);

		// 길게 누르면 메뉴 (열지 않는다)
		await longPress(folder);
		await expect(files.locator('.files-phone-bar-title')).toHaveText('그림');
		await page.getByRole('menuitem', { name: '이름 변경' }).tap();
		await files.getByRole('textbox', { name: '이름' }).fill('바탕 사진');
		await files.getByRole('textbox', { name: '이름' }).press('Enter');
		await expect.poll(() => api.finderLayout.folders.map((item) => item.name)).toEqual(['바탕 사진']);

		await longPress(files.getByRole('button', { name: /^바탕 사진/ }));
		await page.getByRole('menuitem', { name: '휴지통으로 이동' }).tap();
		await expect(files.getByRole('button', { name: /^바탕 사진/ })).toHaveCount(0);
		await expect.poll(() => api.finderLayout.folders.map((item) => item.parent)).toEqual(['trash']);
	});

	test('방문자는 메뉴가 흐리고 관리자 로그인 안내가 보인다', async ({ page }) => {
		const api = await fakeApi(page);
		await fakeFiles(page);
		const files = await openFiles(page);
		await files.getByRole('region', { name: '즐겨찾기' }).getByRole('button', { name: '데스크탑' }).tap();
		await files.getByRole('button', { name: '보기 옵션' }).tap();
		await expect(page.getByRole('menuitem', { name: '새 폴더' })).toBeDisabled();
		await expect(page.getByRole('menu')).toContainText('관리자로 로그인하면 편집할 수 있습니다.');
		await page.keyboard.press('Escape');

		await longPress(files.getByRole('button', { name: /^이력서/ }));
		await expect(page.getByRole('menuitem', { name: '휴지통으로 이동' })).toBeDisabled();
		expect(api.layoutSaves).toBe(0);
	});
});
