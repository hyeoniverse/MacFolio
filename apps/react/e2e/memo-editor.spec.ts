import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Page } from '@playwright/test';
import { fakeApi, type FakeApiState } from './fakeApi';

async function openMemo(page: Page, api: FakeApiState) {
	void api;
	await enterDesktop(page);
	await dockItem(page, 'memo').click();
	const memo = appWindow(page, 'memo');
	await expect(memo.locator('.memo-item').first()).toBeVisible();
	return memo;
}

test.describe('바로 고치기 (관리자)', () => {
	test('글을 열면 편집 단추 없이 제목·본문·날짜·폴더를 바로 고치고, 멈추면 저장된다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true, organization: { folders: ['읽을거리'] } });
		const memo = await openMemo(page, api);
		await expect(memo.getByTitle('관리자로 로그인했습니다')).toBeVisible();
		await memo.locator('.memo-item', { hasText: 'CRA에서 Vite로 옮기기' }).click();
		await expect(memo.getByRole('button', { name: '메모 편집', exact: true })).toHaveCount(0);

		// 열기만 해서는 저장하지 않는다
		const title = memo.getByRole('textbox', { name: '제목' });
		await expect(title).toHaveValue('CRA에서 Vite로 옮기기');
		await expect(memo.locator('.ProseMirror')).toBeVisible();
		await page.waitForTimeout(1200);
		expect(api.posts).toEqual([]);

		await title.fill('CRA에서 Vite로 옮기기 (고침)');
		await expect(memo.getByRole('status').filter({ hasText: '저장됨' })).toBeVisible();
		expect(api.posts).toEqual([
			expect.objectContaining({ slug: 'cra-to-vite', title: 'CRA에서 Vite로 옮기기 (고침)' }),
		]);

		// 본문: 보이는 그대로 고치고 Markdown으로 저장된다
		await memo.locator('.ProseMirror p').last().click();
		await page.keyboard.press('End');
		await page.keyboard.type(' 한 줄 더.');
		await expect.poll(() => api.posts[0]?.body).toContain('한 줄 더.');

		// 날짜: 사이트 모양의 달력
		await memo.getByRole('button', { name: /^날짜 .*, 바꾸기$/ }).click();
		const calendar = page.getByRole('dialog', { name: '날짜 고르기' });
		await calendar.getByRole('button', { name: '이전 달' }).click();
		await calendar.getByRole('gridcell', { name: '2026년 8월 15일' }).click();
		await expect(calendar).toBeHidden();
		await expect.poll(() => api.posts[0]?.date).toBe('2026-08-15');

		// 제목을 누르면 월을, 한 번 더 누르면 연도를 한 번에 고른다
		await memo.getByRole('button', { name: /^날짜 .*, 바꾸기$/ }).click();
		await calendar.getByRole('button', { name: '2026년 8월, 월 고르기' }).click();
		await calendar.getByRole('button', { name: '2026년, 연도 고르기' }).click();
		await calendar.getByRole('group', { name: '연도' }).getByRole('button', { name: '2023년' }).click();
		await calendar.getByRole('group', { name: '월' }).getByRole('button', { name: '2023년 3월' }).click();
		await calendar.getByRole('gridcell', { name: '2023년 3월 1일' }).click();
		await expect.poll(() => api.posts[0]?.date).toBe('2023-03-01');

		// 폴더: 메뉴에서 고른다
		await memo.getByRole('button', { name: /^폴더 .*, 바꾸기$/ }).click();
		await page.getByRole('menuitemcheckbox', { name: '읽을거리' }).click();
		await expect.poll(() => api.posts[0]?.category).toBe('읽을거리');
	});

	test('새 메모: 누르자마자 빈 메모의 제목에 커서가 가고, 제목과 본문을 쓰면 저장된다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		const memo = await openMemo(page, api);
		await memo.getByRole('button', { name: '새 메모', exact: true }).first().click();

		const title = memo.getByRole('textbox', { name: '제목' });
		await expect(title).toBeFocused();
		await expect(memo.getByRole('status').filter({ hasText: '제목과 본문을 쓰면 저장됩니다.' })).toBeVisible();

		// 제목만 쓰면 저장하지 않고 이유를 보여 준다
		await page.keyboard.type('새로 쓴 글');
		await expect(memo.getByRole('status').filter({ hasText: '본문을 입력해주세요.' })).toBeVisible();
		expect(api.posts).toEqual([]);

		// 제목에서 Enter를 누르면 본문으로
		await page.keyboard.press('Enter');
		await page.keyboard.type('## 소제목');
		await page.keyboard.press('Enter');
		await page.keyboard.type('본문입니다.');
		await expect
			.poll(() => api.posts)
			.toEqual([expect.objectContaining({ title: '새로 쓴 글', body: expect.stringContaining('## 소제목') })]);
		await expect(memo.locator('.memo-item').filter({ hasText: '새로 쓴 글' })).toBeVisible();

		// 이어서 쓰면 같은 글을 고친다 (새로 만들지 않는다)
		await page.keyboard.type(' 더 씁니다.');
		await expect.poll(() => api.posts[0]?.body).toContain('더 씁니다.');
		expect(api.posts).toHaveLength(1);

		// 새로고침해도 서버에서 다시 읽어 남아 있다
		await openMemo(page, api);
		await expect(memo.locator('.memo-item').filter({ hasText: '새로 쓴 글' })).toBeVisible();
	});

	test('가가 메뉴와 빠른 단추로 머리말·굵게·체크리스트·표·이미지를 넣는다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		const memo = await openMemo(page, api);
		await memo.getByRole('button', { name: '새 메모', exact: true }).first().click();
		await page.keyboard.type('서식 시험');
		await page.keyboard.press('Enter');
		await page.keyboard.type('머리말이 될 줄');

		// 가가 → 머리말 (커서는 본문에 남는다)
		await memo.getByRole('button', { name: '서식', exact: true }).click();
		const panel = page.getByRole('dialog', { name: '서식' });
		await expect(panel.getByRole('menuitemradio', { name: '본문', exact: true })).toBeChecked();
		// 문단 모양을 고르면 메뉴가 닫힌다
		await panel.getByRole('menuitemradio', { name: '머리말', exact: true }).click();
		await expect(panel).toBeHidden();
		await memo.getByRole('button', { name: '서식', exact: true }).click();
		await expect(panel.getByRole('menuitemradio', { name: '머리말', exact: true })).toBeChecked();
		await page.keyboard.press('Escape');
		await expect(panel).toBeHidden();

		await page.keyboard.press('Enter');
		await memo.getByRole('button', { name: '서식', exact: true }).click();
		await panel.getByRole('button', { name: '굵게' }).click();
		await expect(panel.getByRole('button', { name: '굵게' })).toHaveAttribute('aria-pressed', 'true');
		await page.keyboard.press('Escape');
		await page.keyboard.type('굵은 글');

		// 좁은 도구 막대에서는 가가 메뉴에서: 체크리스트 → 앞의 동그라미를 누르면 체크된다
		await page.keyboard.press('Enter');
		await expect(memo.getByRole('button', { name: '체크리스트', exact: true })).toBeHidden();
		await memo.getByRole('button', { name: '서식', exact: true }).click();
		await panel.getByRole('menuitemradio', { name: '체크리스트', exact: true }).click();
		await page.keyboard.type('할 일 하나');
		const task = memo.locator('.ProseMirror li[data-item-type="task"]');
		await expect(task).toHaveAttribute('data-checked', 'false');
		await task.click({ position: { x: 8, y: 10 } });
		await expect(task).toHaveAttribute('data-checked', 'true');
		await expect.poll(() => api.posts[0]?.body).toBe('### 머리말이 될 줄\n\n**굵은 글**\n\n- [x] 할 일 하나\n');

		// 가가 메뉴의 이미지 넣기
		await memo.getByRole('button', { name: '서식', exact: true }).click();
		await panel.getByRole('menuitem', { name: '이미지 넣기…' }).click();
		const imageForm = page.getByRole('dialog', { name: '이미지 넣기' });
		await expect(imageForm.getByRole('textbox', { name: '이미지 주소' })).toBeFocused();
		await page.keyboard.press('Escape');
		await expect(imageForm).toBeHidden();

		// 사이드바를 가려 넓어지면 빠른 단추가 나온다: 표
		await memo.getByRole('button', { name: '사이드바 가리기' }).click();
		await memo.locator('.ProseMirror p').last().click();
		await memo.getByRole('button', { name: '표', exact: true }).click();
		await expect(memo.locator('.ProseMirror table')).toBeVisible();
		await expect.poll(() => api.posts[0]?.body).toContain('| ');

		// 이미지: 주소와 설명을 넣는다
		await memo.getByRole('button', { name: '이미지', exact: true }).click();
		await imageForm.getByRole('textbox', { name: '이미지 주소' }).fill('https://example.com/a.png');
		await imageForm.getByRole('textbox', { name: '이미지 설명' }).fill('예시 그림');
		await imageForm.getByRole('button', { name: '넣기' }).click();
		await expect(imageForm).toBeHidden();
		await expect.poll(() => api.posts[0]?.body).toContain('![예시 그림](https://example.com/a.png)');
	});

	test('휴지통 단추나 우클릭으로 지우면 목록에서 사라진다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		const memo = await openMemo(page, api);
		page.on('dialog', (dialog) => dialog.accept());

		await memo.locator('.memo-item', { hasText: 'CRA에서 Vite로 옮기기' }).click();
		await memo.getByRole('button', { name: '메모 삭제', exact: true }).first().click();
		await expect(memo.locator('.memo-item', { hasText: 'CRA에서 Vite로' })).toHaveCount(0);

		await memo.locator('.memo-item', { hasText: '테스트를 붙이자 보인 버그들' }).click({ button: 'right' });
		await page.getByRole('menuitem', { name: '메모 삭제' }).click();
		await expect(memo.locator('.memo-item', { hasText: '테스트를 붙이자' })).toHaveCount(0);
		expect(api.posts.map((post) => [post.slug, post.deleted])).toEqual([
			['cra-to-vite', true],
			['bugs-found-by-tests', true],
		]);
	});

	test('방문자는 서버의 글을 보지만 고칠 수 없다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: false });
		api.posts = [
			{
				slug: '2026-09-30-abc',
				title: '서버에만 있는 글',
				date: '2026-09-30',
				category: '개발기/MacFolio',
				summary: '',
				body: '본문',
				deleted: false,
			},
			{ slug: 'cra-to-vite', title: '', date: '2026-09-28', category: '기타', summary: '', body: '', deleted: true },
		];
		const memo = await openMemo(page, api);
		await expect(memo.locator('.memo-item').first()).toContainText('서버에만 있는 글');
		await expect(memo.locator('.memo-item', { hasText: 'CRA에서 Vite로' })).toHaveCount(0);
		await expect(memo.getByRole('heading', { level: 1 })).toHaveText('서버에만 있는 글');
		await expect(memo.getByRole('textbox', { name: '제목' })).toHaveCount(0);
		await expect(memo.locator('.ProseMirror')).toHaveCount(0);
		await expect(memo.getByRole('button', { name: '새 메모', exact: true })).toHaveCount(0);
		await expect(memo.getByTitle('관리자로 로그인했습니다')).toHaveCount(0);
	});
});
