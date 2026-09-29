import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Page } from '@playwright/test';
import { fakeApi } from './fakeApi';

async function openMemo(page: Page) {
	await enterDesktop(page);
	await dockItem(page, 'memo').click();
	const memo = appWindow(page, 'memo');
	await expect(memo.locator('.memo-item').first()).toBeVisible();
	return memo;
}

test.describe('검색 칸과 글 안에서 찾기', () => {
	test('검색 조건: ⌄ 메뉴에서 고르면 칸에 붙고 목록을 거른다. ×나 Backspace로 뗀다', async ({ page }) => {
		const memo = await openMemo(page);
		const search = memo.getByRole('searchbox', { name: '글 검색' });
		await memo.getByRole('button', { name: '검색 조건' }).first().click();
		const menu = page.getByRole('menu', { name: '검색 조건' });
		// 방문자에게는 게시 상태 조건이 없다
		await expect(menu.getByRole('menuitem', { name: '예약된 메모' })).toHaveCount(0);
		await menu.getByRole('menuitem', { name: '표가 있는 메모' }).click();

		await expect(memo.locator('.memo-search-chip:visible')).toHaveText('표');
		await expect(memo.locator('.memo-item', { hasText: 'CRA에서 Vite로' })).toBeVisible();
		await expect(memo.locator('.memo-item', { hasText: '테스트를 붙이자' })).toHaveCount(0);

		await memo.getByRole('button', { name: '표 조건 지우기' }).click();
		await expect(memo.locator('.memo-search-chip:visible')).toHaveCount(0);
		await expect(memo.locator('.memo-item', { hasText: '테스트를 붙이자' })).toBeVisible();

		// 빈 칸에서 Backspace
		await memo.getByRole('button', { name: '검색 조건' }).first().click();
		await menu.getByRole('menuitem', { name: '코드가 있는 메모' }).click();
		await expect(memo.locator('.memo-search-chip:visible')).toHaveText('코드');
		await search.focus();
		await page.keyboard.press('Backspace');
		await expect(memo.locator('.memo-search-chip:visible')).toHaveCount(0);
	});

	test('검색 칸에 초점이 가면 도구가 ••• 로 접히고 검색 칸이 왼쪽으로 넓어진다', async ({ page }) => {
		await fakeApi(page, { signedIn: true });
		const memo = await openMemo(page);
		await memo.locator('.memo-item', { hasText: 'CRA에서 Vite로' }).click();
		const toolbar = memo.locator('.memo-reader-toolbar');
		const search = toolbar.getByRole('searchbox', { name: '글 검색' });
		const before = (await search.boundingBox())!;
		const more = toolbar.getByRole('button', { name: '도구 더 보기' });
		await expect(toolbar.getByRole('button', { name: '정렬과 그룹화' })).toBeVisible();

		await search.focus();
		await expect(toolbar).toHaveClass(/searching/);
		// 오른쪽 끝은 그대로, 왼쪽으로 넓어진다
		await expect.poll(async () => (await search.boundingBox())!.x).toBeLessThan(before.x - 100);
		await page.waitForTimeout(400);
		const after = (await search.boundingBox())!;
		expect(Math.abs(after.x + after.width - (before.x + before.width))).toBeLessThan(2);
		// 도구는 폭 0으로 접히고 누를 수 없다 (inert)
		const tools = toolbar.locator('.memo-toolbar-tools');
		await expect(tools).toHaveAttribute('inert', '');
		expect((await tools.boundingBox())!.width).toBeLessThan(2);

		// ••• 에 도구가 모여 있다. 눌러도 검색 칸은 접히지 않는다
		await more.click();
		const menu = page.getByRole('menu', { name: '도구 더 보기' });
		await expect(menu.getByRole('menuitem', { name: '새 메모' })).toBeVisible();
		await expect(toolbar).toHaveClass(/searching/);
		await menu.getByRole('menuitemcheckbox', { name: '갤러리로 보기' }).click();
		await expect(memo.getByRole('region', { name: '갤러리' })).toBeVisible();
	});

	test('검색 칸에서 나오면 도구가 다시 펼쳐진다', async ({ page }) => {
		const memo = await openMemo(page);
		const toolbar = memo.locator('.memo-reader-toolbar');
		const search = toolbar.getByRole('searchbox', { name: '글 검색' });
		await search.focus();
		await expect(toolbar).toHaveClass(/searching/);
		await page.keyboard.press('Escape');
		await expect(toolbar).not.toHaveClass(/searching/);
		await expect(toolbar.getByRole('button', { name: '정렬과 그룹화' })).toBeVisible();
	});

	test('읽기 화면: ⌘F로 찾기 막대를 열고, 찾은 곳을 옮겨 다니고, 옵션을 바꾼다', async ({ page }) => {
		const memo = await openMemo(page);
		await memo.locator('.memo-item', { hasText: 'CRA에서 Vite로' }).click();
		await page.keyboard.press('ControlOrMeta+f');
		const bar = memo.getByRole('search', { name: '메모에서 찾기' });
		const input = bar.getByRole('textbox', { name: '찾기' });
		await expect(input).toBeFocused();
		// 대치는 편집할 때만
		await expect(bar.getByText('대치')).toHaveCount(0);

		await input.fill('vite');
		const count = bar.getByRole('status');
		await expect(count).toHaveText(/^1\/\d+$/);
		const total = Number((await count.textContent())!.split('/')[1]);
		expect(total).toBeGreaterThan(2);
		await page.keyboard.press('Enter');
		await expect(count).toHaveText(`2/${total}`);
		await page.keyboard.press('Shift+Enter');
		await page.keyboard.press('Shift+Enter');
		// 순환 검색: 처음에서 이전이면 마지막으로
		await expect(count).toHaveText(`${total}/${total}`);
		expect(await page.evaluate(() => CSS.highlights.get('memo-find-current')?.size)).toBe(1);
		expect(await page.evaluate(() => CSS.highlights.get('memo-find')?.size)).toBe(total - 1);

		// 옵션은 체크 표시로 (기본: 대/소문자 무시, 순환 검색, 다음을 포함)
		await bar.getByRole('button', { name: '찾기 옵션' }).click();
		const options = page.getByRole('menu', { name: '찾기 옵션' });
		await expect(options.getByRole('menuitemcheckbox', { checked: true })).toHaveText([
			'영문 대/소문자 무시',
			'순환 검색',
			'다음을 포함',
		]);
		await page.keyboard.press('Escape');
		// 영문 대/소문자 무시를 끄면 'vite'(소문자)만
		await bar.getByRole('button', { name: '찾기 옵션' }).click();
		await page
			.getByRole('menu', { name: '찾기 옵션' })
			.getByRole('menuitemcheckbox', { name: '영문 대/소문자 무시' })
			.click();
		await expect(count).not.toHaveText(`1/${total}`);

		// 최근 검색에 남는다
		await bar.getByRole('button', { name: '찾기 옵션' }).click();
		await expect(page.getByRole('menu', { name: '찾기 옵션' }).getByRole('menuitem', { name: 'vite' })).toBeVisible();
		await page.keyboard.press('Escape');

		await bar.getByRole('button', { name: '완료' }).click();
		await expect(bar).toBeHidden();
		expect(await page.evaluate(() => CSS.highlights.has('memo-find'))).toBe(false);
	});

	test('편집기: 검색 칸 메뉴의 "이 메모에서 찾기"로 열고, 하나씩·모두 대치한다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		const memo = await openMemo(page);
		await memo.locator('.memo-item', { hasText: 'CRA에서 Vite로' }).click();
		await expect(memo.locator('.ProseMirror')).toBeVisible();
		await memo.getByRole('button', { name: '검색 조건' }).first().click();
		await page.getByRole('menu', { name: '검색 조건' }).getByRole('menuitem', { name: '이 메모에서 찾기…' }).click();

		const bar = memo.getByRole('search', { name: '메모에서 찾기' });
		await bar.getByRole('textbox', { name: '찾기' }).fill('webpack');
		const count = bar.getByRole('status');
		await expect(count).toHaveText(/^1\/\d+$/);
		const total = Number((await count.textContent())!.split('/')[1]);
		await expect(memo.locator('.ProseMirror .memo-find-match')).toHaveCount(total);
		await expect(memo.locator('.ProseMirror .memo-find-current')).toHaveCount(1);

		await bar.getByText('대치', { exact: true }).click();
		await bar.getByRole('textbox', { name: '대치할 글' }).fill('웹팩');
		await bar.getByRole('button', { name: '대치', exact: true }).click();
		await expect(count).toHaveText(`1/${total - 1}`);
		await bar.getByRole('button', { name: '모두' }).click();
		await expect(count).toHaveText('없음');
		await expect.poll(() => api.posts[0]?.body ?? '').toContain('웹팩');
		expect(api.posts[0].body).not.toMatch(/webpack/i);
		expect((api.posts[0].body.match(/웹팩/g) ?? []).length).toBe(total);
	});
});
