import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Locator, Page } from '@playwright/test';
import { fakeApi, type FakeApiState } from './fakeApi';

/** 폴더 줄의 글 수 (예: '보관8' → 8) */
async function countOf(folder: Locator) {
	return Number((await folder.textContent())?.match(/(\d+)\s*$/)?.[1] ?? NaN);
}

/** 관리자로 로그인한 채 메모를 연다 (가짜 API). 정리 내용은 가짜 서버에 저장된다 */
async function openMemo(page: Page, api?: FakeApiState) {
	if (!api) await fakeApi(page, { signedIn: true });
	await enterDesktop(page);
	await dockItem(page, 'memo').click();
	const memo = appWindow(page, 'memo');
	await expect(memo).toBeVisible();
	return memo;
}

/**
 * 메모 편집(폴더, 끌어 옮기기, 고정)은 관리자만 할 수 있다. 가짜 API로 관리자로 들어와서 확인한다.
 * 편집한 정리 내용은 서버(가짜 API)에 저장되고, 새로고침하면 서버에서 다시 읽는다.
 */
test.describe('메모 편집 (관리자)', () => {
	test('새로운 폴더를 만들고 지운다 (서버에 저장된다)', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		const memo = await openMemo(page, api);
		const folders = memo.getByRole('navigation', { name: '카테고리' });

		await memo.getByRole('button', { name: '새로운 폴더' }).click();
		const input = memo.getByRole('textbox', { name: '새로운 폴더 이름' });
		await input.fill('개발기');
		await input.press('Enter');
		await expect(memo.getByRole('alert')).toHaveText('이미 있는 폴더예요.');

		await input.fill('읽을거리');
		await input.press('Enter');
		const folder = folders.getByRole('button', { name: /^읽을거리/ });
		await expect(folder).toHaveAttribute('aria-current', 'true');
		await expect(memo.getByText('메모 없음')).toBeVisible();

		// 서버에 저장되어 새로고침해도 남는다
		await expect.poll(() => api.organization.folders).toEqual(['읽을거리']);
		await enterDesktop(page);
		await dockItem(page, 'memo').click();
		await expect(folder).toBeVisible();

		// ••• 메뉴에서 지운다
		await folder.hover();
		await folders.getByRole('button', { name: '폴더 동작 (읽을거리)' }).click();
		await page.getByRole('menuitem', { name: '폴더 삭제' }).click();
		await expect(folder).toBeHidden();
	});

	test('폴더를 고른 채 새로운 폴더를 누르면 그 폴더 아래에 만든다', async ({ page }) => {
		const memo = await openMemo(page);
		const folders = memo.getByRole('navigation', { name: '카테고리' });
		await folders.getByRole('button', { name: /^개발기/ }).click();
		await memo.getByRole('button', { name: '새로운 폴더' }).click();
		await memo.getByRole('textbox', { name: '새로운 폴더 이름' }).fill('읽을거리');
		await memo.getByRole('textbox', { name: '새로운 폴더 이름' }).press('Enter');

		await expect(folders.getByRole('button', { name: /^읽을거리/ })).toHaveAttribute('aria-current', 'true');
		// 개발기를 접으면 함께 숨는다 (개발기 아래에 있다)
		await folders.getByRole('button', { name: '하위 폴더 접기 (개발기)' }).click();
		await expect(folders.getByRole('button', { name: /^읽을거리/ })).toBeHidden();
	});

	test('글과 폴더를 끌어서 다른 폴더로 옮긴다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		const memo = await openMemo(page, api);
		const folders = memo.getByRole('navigation', { name: '카테고리' });
		// 블로그 글은 모두 개발기/MacFolio에 있다
		const total = await countOf(folders.getByRole('button', { name: /^MacFolio/ }));
		await memo.getByRole('button', { name: '새로운 폴더' }).click();
		await memo.getByRole('textbox', { name: '새로운 폴더 이름' }).fill('보관');
		await memo.getByRole('textbox', { name: '새로운 폴더 이름' }).press('Enter');

		// 글을 '보관'으로
		await folders.getByRole('button', { name: /^모든 글/ }).click();
		await memo
			.locator('.memo-item', { hasText: 'CRA에서 Vite로 옮기기' })
			.dragTo(folders.getByRole('button', { name: /^보관/ }));
		await expect(folders.getByRole('button', { name: /^보관/ })).toContainText('1');
		await folders.getByRole('button', { name: /^보관/ }).click();
		await expect(memo.locator('.memo-item')).toHaveText([/CRA에서 Vite로 옮기기/]);

		// 폴더 'MacFolio'를 '보관' 안으로: 안의 글도 따라온다
		await folders.getByRole('button', { name: /^MacFolio/ }).dragTo(folders.getByRole('button', { name: /^보관/ }));
		await expect.poll(() => countOf(folders.getByRole('button', { name: /^보관/ }))).toBe(total);

		// 서버에 저장되어 새로고침해도 정리한 대로
		await expect.poll(() => api.organization.moves.length).toBe(1);
		await enterDesktop(page);
		await dockItem(page, 'memo').click();
		await expect.poll(() => countOf(folders.getByRole('button', { name: /^보관/ }))).toBe(total);
	});

	test('폴더 메뉴: 이름 변경, 우클릭, 글이 있는 폴더는 지울 수 없다', async ({ page }) => {
		const memo = await openMemo(page);
		const folders = memo.getByRole('navigation', { name: '카테고리' });
		const total = await countOf(folders.getByRole('button', { name: /^MacFolio/ }));

		// 우클릭으로 메뉴를 연다. 블로그 글의 폴더는 지울 수 없다
		await folders.getByRole('button', { name: /^MacFolio/ }).click({ button: 'right' });
		const menu = page.getByRole('menu', { name: 'MacFolio 폴더 메뉴' });
		await expect(menu.getByRole('menuitem', { name: '폴더 삭제' })).toBeDisabled();

		await menu.getByRole('menuitem', { name: '폴더 이름 변경' }).click();
		const input = folders.getByRole('textbox', { name: '폴더 이름' });
		await input.fill('포트폴리오');
		await input.press('Enter');
		await expect.poll(() => countOf(folders.getByRole('button', { name: /^포트폴리오/ }))).toBe(total);
		await expect(folders.getByRole('button', { name: /^MacFolio/ })).toHaveCount(0);

		// 메뉴의 새로운 폴더는 그 폴더 안에 만든다
		await folders.getByRole('button', { name: '폴더 동작 (포트폴리오)' }).click();
		await page.getByRole('menuitem', { name: '새로운 폴더' }).click();
		await folders.getByRole('textbox', { name: '새로운 폴더 이름' }).fill('초안');
		await folders.getByRole('textbox', { name: '새로운 폴더 이름' }).press('Enter');
		await folders.getByRole('button', { name: '하위 폴더 접기 (포트폴리오)' }).click();
		await expect(folders.getByRole('button', { name: /^초안/ })).toBeHidden();
	});

	test('폴더는 3단까지만 만들고 옮길 수 있다', async ({ page }) => {
		const memo = await openMemo(page);
		const folders = memo.getByRole('navigation', { name: '카테고리' });
		const newFolder = memo.getByRole('button', { name: '새로운 폴더', exact: true });

		// 개발기(1단) / MacFolio(2단) / 초안(3단)
		await folders.getByRole('button', { name: /^MacFolio/ }).click();
		await newFolder.click();
		await folders.getByRole('textbox', { name: '새로운 폴더 이름' }).fill('초안');
		await folders.getByRole('textbox', { name: '새로운 폴더 이름' }).press('Enter');

		// 3단 폴더를 고르면 그 안에는 만들 수 없다
		await expect(folders.getByRole('button', { name: /^초안/ })).toHaveAttribute('aria-current', 'true');
		await expect(newFolder).toBeDisabled();
		await folders.getByRole('button', { name: '폴더 동작 (초안)' }).click();
		await expect(page.getByRole('menuitem', { name: '새로운 폴더' })).toBeDisabled();
		await page.keyboard.press('Escape');

		// 3단 높이의 개발기를 다른 폴더 안으로는 옮길 수 없다
		await folders.getByRole('button', { name: /^모든 글/ }).click();
		await newFolder.click();
		await folders.getByRole('textbox', { name: '새로운 폴더 이름' }).fill('보관');
		await folders.getByRole('textbox', { name: '새로운 폴더 이름' }).press('Enter');
		await folders.getByRole('button', { name: /^개발기/ }).dragTo(folders.getByRole('button', { name: /^보관/ }));
		await expect(folders.getByRole('button', { name: /^보관/ })).toContainText('0');
		await expect(folders.getByRole('button', { name: /^개발기/ })).toBeVisible();
	});

	test('메모를 고정하면 맨 위 고정됨 묶음에 들어가고, 풀 수 있다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		const memo = await openMemo(page, api);
		const title = '테스트를 붙이자 보인 버그들';

		// 우클릭 메뉴로 고정
		await memo.locator('.memo-item', { hasText: title }).click({ button: 'right' });
		await page.getByRole('menuitem', { name: '메모 고정' }).click();
		const pinned = memo.getByRole('list', { name: '고정됨' });
		await expect(pinned.locator('.memo-item')).toHaveText([new RegExp(title)]);

		// 갤러리에서도 고정된 메모 묶음에 있다
		await memo.getByRole('button', { name: '갤러리로 보기' }).click();
		await expect(memo.getByRole('list', { name: '고정된 메모' })).toContainText(title);
		await memo.getByRole('button', { name: '목록으로 보기' }).click();

		// 서버에 저장되어 새로고침해도 고정되어 있고, 본문 위 고정 단추로 푼다
		await expect.poll(() => api.organization.pins).toEqual({ 'bugs-found-by-tests': true });
		await enterDesktop(page);
		await dockItem(page, 'memo').click();
		await memo.locator('.memo-item', { hasText: title }).click();
		const pin = memo.getByRole('button', { name: '메모 고정 해제' }).first();
		await expect(pin).toHaveAttribute('aria-pressed', 'true');
		await pin.click();
		await expect(memo.getByRole('list', { name: '고정됨' })).toHaveCount(0);
		await expect.poll(() => api.organization.pins).toEqual({ 'bugs-found-by-tests': false });
	});

	test('방문자도 관리자가 정리한 대로 보지만, 편집할 수는 없다', async ({ page }) => {
		await fakeApi(page, {
			signedIn: false,
			organization: { folders: ['읽을거리'], posts: { 'cra-to-vite': '읽을거리' }, pins: { 'read-only-memo': true } },
		});
		await enterDesktop(page);
		await dockItem(page, 'memo').click();
		const memo = appWindow(page, 'memo');
		const folders = memo.getByRole('navigation', { name: '카테고리' });

		await expect(folders.getByRole('button', { name: /^읽을거리/ })).toContainText('1');
		await expect(memo.getByRole('list', { name: '고정됨' })).toContainText('메모 편집을 관리자만 하게 한 이유');
		await expect(memo.getByRole('button', { name: '새로운 폴더' })).toHaveCount(0);
		await expect(memo.getByRole('button', { name: /메모 고정/ })).toHaveCount(0);
	});

	test('저장에 실패하면 알리고 서버 내용으로 되돌린다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		const memo = await openMemo(page, api);
		// 세션이 끝난 상태 (서버는 저장을 거절한다)
		api.signedIn = false;
		await memo.getByRole('button', { name: '새로운 폴더' }).click();
		await memo.getByRole('textbox', { name: '새로운 폴더 이름' }).fill('읽을거리');
		await memo.getByRole('textbox', { name: '새로운 폴더 이름' }).press('Enter');

		await expect(page.getByRole('status').filter({ hasText: '저장하지 못함' })).toBeVisible();
		await expect(
			memo.getByRole('navigation', { name: '카테고리' }).getByRole('button', { name: /^읽을거리/ })
		).toHaveCount(0);
	});
	test('편집하면 바로 서버에 저장한다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		const memo = await openMemo(page, api);
		await memo.locator('.memo-item', { hasText: 'CRA에서 Vite로 옮기기' }).click({ button: 'right' });
		await page.getByRole('menuitem', { name: '메모 고정' }).click();
		await expect.poll(() => api.saves, { timeout: 1000 }).toBe(1);
		expect(api.organization.pins).toEqual({ 'cra-to-vite': true });
	});
});
