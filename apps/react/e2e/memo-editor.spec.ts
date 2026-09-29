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
		await expect(imageForm.getByRole('button', { name: '파일에서 고르기…' })).toBeFocused();
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

	test('표: Tab·Enter로 칸을 옮기며 행을 늘리고, 표 편집 메뉴로 열 추가·정렬·삭제한다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		const memo = await openMemo(page, api);
		await memo.getByRole('button', { name: '새 메모', exact: true }).first().click();
		await page.keyboard.type('표 시험');
		await page.keyboard.press('Enter');
		await page.keyboard.type('위 문단');

		await memo.getByRole('button', { name: '서식', exact: true }).click();
		const panel = page.getByRole('dialog', { name: '서식' });
		await panel.getByRole('menuitem', { name: '표 넣기' }).click();
		const table = memo.locator('.ProseMirror table');
		await expect(table.locator('tr')).toHaveCount(3);

		// 머리글에서 Tab으로 옆 칸, 마지막 행에서 Enter를 누르면 행이 늘어난다
		await page.keyboard.type('이름');
		await page.keyboard.press('Tab');
		await page.keyboard.type('값');
		await page.keyboard.press('Enter');
		await page.keyboard.type('하나');
		await page.keyboard.press('Enter');
		await page.keyboard.type('둘');
		await page.keyboard.press('Enter');
		await expect(table.locator('tr')).toHaveCount(4);
		await page.keyboard.type('셋');

		// 표 안에서 가가 메뉴는 '표 편집…'
		await memo.getByRole('button', { name: '서식', exact: true }).click();
		await panel.getByRole('menuitem', { name: '표 편집…' }).click();
		const tableMenu = page.getByRole('dialog', { name: '표 편집' });
		// 커서가 있는 열(값) 오른쪽에 열을 넣고, 새 열로 가서 지운다
		await tableMenu.getByRole('menuitem', { name: '오른쪽에 열 추가' }).click();
		await expect(table.locator('tr').first().locator('th')).toHaveCount(4);
		await table.locator('th').nth(2).click();
		await tableMenu.getByRole('menuitem', { name: '열 삭제' }).click();
		await expect(table.locator('tr').first().locator('th')).toHaveCount(3);
		// 정렬은 열 전체에
		await table.locator('th', { hasText: '값' }).click();
		await tableMenu.getByRole('button', { name: '가운데 정렬' }).click();
		await expect(tableMenu.getByRole('button', { name: '가운데 정렬' })).toHaveAttribute('aria-pressed', 'true');
		// 마지막 행 아래에 행을 넣고, 넣은 행을 지운다
		await table.locator('td', { hasText: '셋' }).click();
		await tableMenu.getByRole('menuitem', { name: '아래에 행 추가' }).click();
		await expect(table.locator('tr')).toHaveCount(5);
		await table.locator('tr').last().locator('td').first().click();
		await tableMenu.getByRole('menuitem', { name: '행 삭제' }).click();
		await expect(table.locator('tr')).toHaveCount(4);
		await page.keyboard.press('Escape');

		// Enter는 같은 열의 아래 칸으로: 값 아래에 하나·둘·셋
		await expect
			.poll(() => api.posts[0]?.body)
			.toMatch(
				/\| 이름 +\| +값 +\| +\|\n\| :?-+ \| :-+: \| :?-+ \|\n\| +\| +하나 +\| +\|\n\| +\| +둘 +\| +\|\n\| +\| +셋 +\| +\|\n/
			);

		// 머리글 행은 지울 수 없다
		await table.locator('th').first().click();
		await memo.getByRole('button', { name: '서식', exact: true }).click();
		await panel.getByRole('menuitem', { name: '표 편집…' }).click();
		await expect(tableMenu.getByRole('menuitem', { name: '행 삭제' })).toBeDisabled();
		await expect(tableMenu.getByRole('menuitem', { name: '위에 행 추가' })).toBeDisabled();

		// 표 삭제
		await tableMenu.getByRole('menuitem', { name: '표 삭제' }).click();
		await expect(tableMenu).toBeHidden();
		await expect(table).toHaveCount(0);
		await expect.poll(() => api.posts[0]?.body).not.toContain('|');
	});

	test('이미지를 파일에서 골라 올리고, 파일을 첨부하고, 붙여넣은 이미지도 올린다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		const memo = await openMemo(page, api);
		await memo.getByRole('button', { name: '새 메모', exact: true }).first().click();
		await page.keyboard.type('파일 시험');
		await page.keyboard.press('Enter');
		await page.keyboard.type('본문');
		const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

		// 이미지 넣기 → 파일에서 고르기
		await memo.getByRole('button', { name: '서식', exact: true }).click();
		await page.getByRole('dialog', { name: '서식' }).getByRole('menuitem', { name: '이미지 넣기…' }).click();
		const imageForm = page.getByRole('dialog', { name: '이미지 넣기' });
		await imageForm
			.getByLabel('이미지 파일')
			.setInputFiles({ name: '스크린샷.png', mimeType: 'image/png', buffer: png });
		await expect(imageForm).toBeHidden();
		await expect(memo.locator('.ProseMirror .memo-figure img')).toHaveAttribute('src', /^http:\/\/api\.test\/files\//);
		await expect.poll(() => api.posts[0]?.body).toMatch(/!\[스크린샷\]\(http:\/\/api\.test\/files\/fakeupload\d+\)/);

		// 파일 첨부: 이름을 글자로 한 링크, 제목에 크기 (이미지 뒤 새 문단에)
		await page.keyboard.press('End');
		await page.keyboard.press('Enter');
		await memo
			.getByLabel('첨부할 파일')
			.first()
			.setInputFiles({
				name: '보고서.pdf',
				mimeType: 'application/pdf',
				buffer: Buffer.alloc(2048, 1),
			});
		await expect(memo.locator(".ProseMirror a[title^='첨부 파일']")).toHaveText('보고서.pdf');
		await expect
			.poll(() => api.posts[0]?.body)
			.toMatch(/\[보고서\.pdf\]\(http:\/\/api\.test\/files\/fakeupload\d+ "첨부 파일 · 2 KB"\)/);

		// 스크린샷을 붙여넣으면 올려서 그 자리에 넣는다
		await memo.locator('.ProseMirror').evaluate(
			(editor, bytes) => {
				const data = new DataTransfer();
				data.items.add(new File([new Uint8Array(bytes)], '붙여넣기.png', { type: 'image/png' }));
				editor.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
			},
			[...png]
		);
		await expect(memo.locator('.ProseMirror .memo-figure img')).toHaveCount(2);
		expect(api.uploads.map((upload) => upload.name)).toEqual(['스크린샷.png', '보고서.pdf', '붙여넣기.png']);
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
				body: '본문\n\n[보고서.pdf](http://api.test/files/fakeupload000001 "첨부 파일 · 2 KB")',
				deleted: false,
			},
			{ slug: 'cra-to-vite', title: '', date: '2026-09-28', category: '기타', summary: '', body: '', deleted: true },
		];
		const memo = await openMemo(page, api);
		await expect(memo.locator('.memo-item').first()).toContainText('서버에만 있는 글');
		await expect(memo.locator('.memo-item', { hasText: 'CRA에서 Vite로' })).toHaveCount(0);
		await expect(memo.getByRole('heading', { level: 1 })).toHaveText('서버에만 있는 글');
		// 첨부 파일은 편집 화면과 같은 모양의 링크
		await expect(memo.locator(".memo-markdown a[title^='첨부 파일']")).toHaveText('보고서.pdf');
		await expect(memo.getByRole('textbox', { name: '제목' })).toHaveCount(0);
		await expect(memo.locator('.ProseMirror')).toHaveCount(0);
		await expect(memo.getByRole('button', { name: '새 메모', exact: true })).toHaveCount(0);
		await expect(memo.getByTitle('관리자로 로그인했습니다')).toHaveCount(0);
	});
});
