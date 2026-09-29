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
		await expect(memo.getByRole('status').filter({ hasText: '임시 저장됨' })).toBeVisible();
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
		await expect(memo.getByRole('status').filter({ hasText: '제목과 본문을 쓰면 임시 저장됩니다.' })).toBeVisible();

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
		await expect(imageForm.getByRole('tab', { name: '내 파일' })).toHaveAttribute('aria-selected', 'true');
		await page.keyboard.press('Escape');
		await expect(imageForm).toBeHidden();

		// 사이드바를 가려 넓어지면 빠른 단추가 나온다: 표
		await memo.getByRole('button', { name: '사이드바 가리기' }).click();
		await memo.locator('.ProseMirror p').last().click();
		await memo.getByRole('button', { name: '표', exact: true }).click();
		await expect(memo.locator('.ProseMirror table')).toBeVisible();
		await expect.poll(() => api.posts[0]?.body).toContain('| ');

		// 이미지: 주소를 넣으면 미리 보고 설명과 캡션을 쓴다
		await memo.getByRole('button', { name: '이미지', exact: true }).click();
		await imageForm.getByRole('tab', { name: '주소' }).click();
		await imageForm.getByRole('textbox', { name: '이미지 주소' }).fill('https://images.test/a.png');
		await imageForm.getByRole('textbox', { name: '이미지 설명' }).fill('예시 그림');
		await imageForm.getByRole('textbox', { name: '캡션' }).fill('예시 캡션');
		await imageForm.getByRole('button', { name: '넣기' }).click();
		await expect(imageForm).toBeHidden();
		await expect.poll(() => api.posts[0]?.body).toContain('![예시 그림](https://images.test/a.png "예시 캡션")');
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
		// 1×1 PNG (미리 보기에 실제로 그려지는 그림)
		const png = Buffer.from(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
			'base64'
		);

		// 이미지 넣기 → 파일에서 고르기
		await memo.getByRole('button', { name: '서식', exact: true }).click();
		await page.getByRole('dialog', { name: '서식' }).getByRole('menuitem', { name: '이미지 넣기…' }).click();
		const imageForm = page.getByRole('dialog', { name: '이미지 넣기' });
		await imageForm
			.getByLabel('이미지 파일')
			.setInputFiles({ name: '스크린샷.png', mimeType: 'image/png', buffer: png });
		// 고르면 바로 넣지 않고 미리 보기와 설명(파일 이름으로 채워 둔다)·캡션을 쓴다
		await expect(imageForm.locator('.memo-image-preview')).toBeVisible();
		const alt = imageForm.getByRole('textbox', { name: '이미지 설명' });
		await expect(alt).toHaveValue('스크린샷');
		await alt.fill('편집기 화면');
		await imageForm.getByRole('textbox', { name: '캡션' }).fill('캡션 한 줄');
		await imageForm.getByRole('button', { name: '올려서 넣기' }).click();
		await expect(imageForm).toBeHidden();
		const figure = memo.locator('.ProseMirror > .memo-figure');
		await expect(figure.locator('img')).toHaveAttribute('src', /^http:\/\/api\.test\/files\//);
		await expect(figure.locator('.memo-caption')).toHaveText('캡션 한 줄');
		await expect
			.poll(() => api.posts[0]?.body)
			.toMatch(/본문\n\n!\[편집기 화면\]\(http:\/\/api\.test\/files\/fakeupload\d+ "캡션 한 줄"\)\n$/);

		// 이미지 뒤로 바로 이어 쓴다 (앞 문단으로 가지 않는다)
		await page.keyboard.type('이미지 다음 줄');
		await expect.poll(() => api.posts[0]?.body).toMatch(/"캡션 한 줄"\)\n\n이미지 다음 줄\n$/);

		// 이미지를 고르면 이미지 단추로 설명·캡션을 고친다
		await figure.locator('img').click();
		await memo.getByRole('button', { name: '서식', exact: true }).click();
		await page.getByRole('dialog', { name: '서식' }).getByRole('menuitem', { name: '이미지 편집…' }).click();
		const imageEdit = page.getByRole('dialog', { name: '이미지 편집' });
		await expect(imageEdit.getByRole('textbox', { name: '이미지 설명' })).toHaveValue('편집기 화면');
		await imageEdit.getByRole('textbox', { name: '캡션' }).fill('고친 캡션');
		await imageEdit.getByRole('button', { name: '적용' }).click();
		await expect(figure.locator('.memo-caption')).toHaveText('고친 캡션');
		await expect.poll(() => api.posts[0]?.body).toContain('"고친 캡션")');

		// 파일 첨부: 이름을 글자로 한 링크, 제목에 크기 (글 끝 새 문단에)
		await memo.locator('.ProseMirror p', { hasText: '이미지 다음 줄' }).click();
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
		await expect.poll(() => api.posts[0]?.body).toMatch(/!\[붙여넣기\]\(http:\/\/api\.test\/files\/fakeupload\d+\)/);
		expect(api.uploads.map((upload) => upload.name)).toEqual(['스크린샷.png', '보고서.pdf', '붙여넣기.png']);
	});

	test('Unsplash에서 찾아 넣으면 설명과 출처 캡션이 채워지고, Unsplash에 알린다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		const memo = await openMemo(page, api);
		await memo.getByRole('button', { name: '새 메모', exact: true }).first().click();
		await page.keyboard.type('사진 시험');
		await page.keyboard.press('Enter');
		await page.keyboard.type('본문');
		await page.keyboard.press('Enter');

		await memo.getByRole('button', { name: '서식', exact: true }).click();
		await page.getByRole('dialog', { name: '서식' }).getByRole('menuitem', { name: '이미지 넣기…' }).click();
		const imageForm = page.getByRole('dialog', { name: '이미지 넣기' });
		// 키가 없는 서비스는 무엇을 채워야 하는지 알려 준다
		await imageForm.getByRole('tab', { name: 'Pexels' }).click();
		await expect(imageForm).toContainText('PEXELS_API_KEY');

		await imageForm.getByRole('tab', { name: 'Unsplash' }).click();
		await imageForm
			.getByRole('searchbox', { name: 'Unsplash에서 찾기' })
			.or(imageForm.getByRole('textbox', { name: 'Unsplash에서 찾기' }))
			.fill('고양이');
		await imageForm.getByRole('button', { name: '찾기' }).click();
		const grid = imageForm.getByRole('list', { name: '찾은 사진' });
		await expect(grid.getByRole('listitem')).toHaveCount(2);
		await imageForm.getByRole('button', { name: '더 보기' }).click();
		await expect(grid.getByRole('listitem')).toHaveCount(4);
		await expect(imageForm.getByRole('button', { name: '더 보기' })).toHaveCount(0);
		expect(api.stock.searches).toEqual(['unsplash 고양이 1', 'unsplash 고양이 2']);

		await grid.getByRole('listitem', { name: '고양이 사진 1, 사진가1' }).first().click();
		// 설명 칸의 안내는 입력칸 아래에 따로
		await expect(imageForm.getByRole('textbox', { name: '이미지 설명' })).toHaveAccessibleDescription(
			'화면 읽기 프로그램이 이미지 대신 읽어 주는 글입니다.'
		);
		await expect(imageForm.getByRole('textbox', { name: '이미지 설명' })).toHaveValue('고양이 사진 1');
		await expect(imageForm.getByRole('link', { name: '사진가1' })).toBeVisible();
		await imageForm.getByRole('button', { name: '넣기' }).click();

		const figure = memo.locator('.ProseMirror > .memo-figure');
		await expect(figure.locator('img')).toHaveAttribute('src', 'https://images.test/p1n1.jpg');
		await expect(figure.locator('.memo-caption').getByRole('link', { name: 'Unsplash' })).toBeVisible();
		// Markdown으로 쓸 때 캡션의 [와 &는 \\로 이스케이프된다 (다시 읽으면 같은 캡션)
		await expect
			.poll(() => api.posts[0]?.body.replace(/\\(?=[[&])/g, ''))
			.toContain(
				'![고양이 사진 1](https://images.test/p1n1.jpg "사진: [사진가1](https://unsplash.com/@p1?utm_source=macfolio&utm_medium=referral), [Unsplash](https://unsplash.com/?utm_source=macfolio&utm_medium=referral)")'
			);
		expect(api.stock.downloads).toEqual(['p1n1']);
	});

	test('Unsplash·Pexels 검색 칸: 영어 검색 안내는 입력칸 아래 안내 문장으로', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		api.stock.providers.pexels = true;
		const memo = await openMemo(page, api);
		await memo.getByRole('button', { name: '새 메모', exact: true }).first().click();
		await page.keyboard.type('검색 안내');
		await memo.getByRole('button', { name: '서식', exact: true }).click();
		await page.getByRole('dialog', { name: '서식' }).getByRole('menuitem', { name: '이미지 넣기…' }).click();
		const imageForm = page.getByRole('dialog', { name: '이미지 넣기' });
		for (const provider of ['Unsplash', 'Pexels']) {
			await imageForm.getByRole('tab', { name: provider }).click();
			const search = imageForm.getByRole('textbox', { name: `${provider}에서 찾기` });
			await expect(search).toHaveAttribute('placeholder', '찾을 사진');
			await expect(search).toHaveAccessibleDescription('영어로 검색하면 더 많은 사진을 찾을 수 있습니다.');
		}
	});

	test('표 손잡이: 열·행 전체를 골라 메뉴로 추가·삭제하고, Backspace로 칸을 비운다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		const memo = await openMemo(page, api);
		await memo.getByRole('button', { name: '새 메모', exact: true }).first().click();
		await page.keyboard.type('손잡이 시험');
		await page.keyboard.press('Enter');
		await page.keyboard.type('위 문단');
		await memo.getByRole('button', { name: '서식', exact: true }).click();
		await page.getByRole('dialog', { name: '서식' }).getByRole('menuitem', { name: '표 넣기' }).click();
		for (const text of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']) {
			await page.keyboard.type(text);
			if (text !== 'i') await page.keyboard.press('Tab');
		}
		const table = memo.locator('.ProseMirror table');
		// 커서가 있는 표는 칸 선이, 지금 칸은 옅은 배경이 보인다
		await expect(table).toHaveClass(/memo-table-active/);
		await expect(table.locator('.memo-cell-current')).toHaveCount(1);

		// 손잡이는 크기가 늘 같은 둥근 알약: 열은 지금 칸 위 가운데, 행은 표 왼쪽 (표를 가리지 않는다)
		await table.locator('td', { hasText: 'e' }).click();
		const colHandle = memo.getByRole('button', { name: '이 열 편집' });
		const rowHandle = memo.getByRole('button', { name: '이 행 편집' });
		const cell = (await table.locator('td', { hasText: 'e' }).boundingBox())!;
		const bar = (await colHandle.boundingBox())!;
		const tableBox = (await table.boundingBox())!;
		expect(bar.width).toBe(26);
		expect(bar.height).toBe(12);
		expect(Math.abs(bar.x + bar.width / 2 - (cell.x + cell.width / 2))).toBeLessThan(2);
		expect(bar.y + bar.height).toBeLessThanOrEqual(tableBox.y);
		const rowBox = (await rowHandle.boundingBox())!;
		expect([rowBox.width, rowBox.height]).toEqual([12, 26]);
		expect(rowBox.x + rowBox.width).toBeLessThanOrEqual(tableBox.x);

		// 열 막대를 누르면 열 전체를 고르고 메뉴가 열린다
		await colHandle.click();
		await expect(table.locator('.selectedCell')).toHaveCount(3);
		await expect(memo.locator('.memo-table-selection')).toBeVisible();
		// 고르면 알약이 열 폭만큼 펼쳐진 막대(⌄)가 된다
		await expect.poll(async () => Math.round((await colHandle.boundingBox())!.width)).toBe(Math.round(cell.width));
		const colMenu = page.getByRole('dialog', { name: '열 편집' });
		await expect(colMenu.getByRole('menuitem')).toHaveText(['앞에 열 추가', '뒤에 열 추가', '1개의 열 삭제']);
		// 메뉴를 닫고 Backspace: 고른 칸이 빈다
		await page.keyboard.press('Escape');
		await page.keyboard.press('Backspace');
		await expect(table.locator('tr').nth(1).locator('td').nth(1)).toHaveText('');
		await expect.poll(() => api.posts[0]?.body).toMatch(/\| a +\| +\| c +\|/);

		// 열 추가·삭제
		await colHandle.click();
		await colMenu.getByRole('menuitem', { name: '뒤에 열 추가' }).click();
		await expect(table.locator('tr').first().locator('th')).toHaveCount(4);
		await colMenu.getByRole('menuitem', { name: '1개의 열 삭제' }).click();
		await expect(colMenu).toBeHidden();
		await expect(table.locator('tr').first().locator('th')).toHaveCount(3);

		// 행: 본문 행을 골라 아래에 추가하고 지운다
		await table.locator('td', { hasText: 'g' }).click();
		await rowHandle.click();
		const rowMenu = page.getByRole('dialog', { name: '행 편집' });
		await expect(rowMenu.getByRole('menuitem')).toHaveText(['위에 행 추가', '아래에 행 추가', '1개의 행 삭제']);
		await rowMenu.getByRole('menuitem', { name: '아래에 행 추가' }).click();
		await expect(table.locator('tr')).toHaveCount(4);
		await rowMenu.getByRole('menuitem', { name: '1개의 행 삭제' }).click();
		await expect(table.locator('tr')).toHaveCount(3);

		// 머리글 행은 지우지 않는다
		await table.locator('th', { hasText: 'a' }).click();
		await rowHandle.click();
		await expect(rowMenu.getByRole('menuitem', { name: '1개의 행 삭제' })).toBeDisabled();
		await page.keyboard.press('Escape');

		// 표 밖으로 나가면 손잡이가 사라진다
		await memo.locator('.ProseMirror > p').first().click();
		await expect(colHandle).toHaveCount(0);
		await expect(table).not.toHaveClass(/memo-table-active/);
	});

	test('표: 행·열 전체를 고른 뒤 손잡이를 끌어 옮긴다 (맨 위로 옮기면 머리글이 된다)', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		const memo = await openMemo(page, api);
		await memo.getByRole('button', { name: '새 메모', exact: true }).first().click();
		await page.keyboard.type('옮기기');
		await page.keyboard.press('Enter');
		await page.keyboard.type('위 문단');
		await memo.getByRole('button', { name: '서식', exact: true }).click();
		await page.getByRole('dialog', { name: '서식' }).getByRole('menuitem', { name: '표 넣기' }).click();
		for (const text of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']) {
			await page.keyboard.type(text);
			if (text !== 'i') await page.keyboard.press('Tab');
		}
		const table = memo.locator('.ProseMirror table');
		const dragBy = async (handle: import('@playwright/test').Locator, dx: number, dy: number) => {
			const box = (await handle.boundingBox())!;
			const x = box.x + box.width / 2;
			const y = box.y + box.height / 2;
			await page.mouse.move(x, y);
			await page.mouse.down();
			await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 5 });
			await page.mouse.move(x + dx, y + dy, { steps: 5 });
			await page.mouse.up();
		};

		// 첫 열(a·d·g)을 골라 오른쪽 끝으로 끈다
		await table.locator('th', { hasText: 'a' }).click();
		const colHandle = memo.getByRole('button', { name: '이 열 편집' });
		await colHandle.click();
		await page.keyboard.press('Escape');
		const width = (await table.locator('th').first().boundingBox())!.width;
		await dragBy(colHandle, width * 2.2, 0);
		await expect(table.locator('tr').first().locator('th')).toHaveText(['b', 'c', 'a']);
		await expect(table.locator('tr').nth(1).locator('td')).toHaveText(['e', 'f', 'd']);
		// 끌기 뒤에는 메뉴가 열리지 않는다
		await expect(page.getByRole('dialog', { name: '열 편집' })).toHaveCount(0);

		// 마지막 행(h…)을 골라 한 칸 위로
		await table.locator('td', { hasText: 'h' }).click();
		const rowHandle = memo.getByRole('button', { name: '이 행 편집' });
		await rowHandle.click();
		await page.keyboard.press('Escape');
		const height = (await table.locator('tr').nth(1).boundingBox())!.height;
		await dragBy(rowHandle, 0, -height * 1.3);
		await expect(table.locator('tr').nth(1).locator('td')).toHaveText(['h', 'i', 'g']);
		await expect(table.locator('tr').nth(2).locator('td')).toHaveText(['e', 'f', 'd']);

		// 맨 위로 끌면 그 행이 머리글이 되고, 원래 머리글은 본문 행이 된다
		await dragBy(rowHandle, 0, -height * 1.5);
		await expect(table.locator('tr').first().locator('th')).toHaveText(['h', 'i', 'g']);
		await expect(table.locator('tr').nth(1).locator('td')).toHaveText(['b', 'c', 'a']);
		await expect
			.poll(() => api.posts[0]?.body)
			.toMatch(/\| h +\| i +\| g +\|\n\| -+ \| -+ \| -+ \|\n\| b +\| c +\| a +\|\n\| e +\| f +\| d +\|/);
	});

	test('표: 고른 범위의 대각선 꼭짓점을 끌어 범위를 늘리고 줄인다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		const memo = await openMemo(page, api);
		await memo.getByRole('button', { name: '새 메모', exact: true }).first().click();
		await page.keyboard.type('범위');
		await page.keyboard.press('Enter');
		await page.keyboard.type('위 문단');
		await memo.getByRole('button', { name: '서식', exact: true }).click();
		await page.getByRole('dialog', { name: '서식' }).getByRole('menuitem', { name: '표 넣기' }).click();
		for (const text of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']) {
			await page.keyboard.type(text);
			if (text !== 'i') await page.keyboard.press('Tab');
		}
		const table = memo.locator('.ProseMirror table');
		await table.locator('td', { hasText: 'e' }).click();
		await memo.getByRole('button', { name: '이 열 편집' }).click();
		await page.keyboard.press('Escape');
		await expect(table.locator('.selectedCell')).toHaveCount(3);

		const dragTo = async (corner: string, text: string) => {
			const dot = (await memo.getByRole('button', { name: corner }).boundingBox())!;
			const cell = (await table.locator('td, th', { hasText: new RegExp(`^${text}$`) }).boundingBox())!;
			await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2);
			await page.mouse.down();
			await page.mouse.move(cell.x + cell.width / 2, cell.y + cell.height / 2, { steps: 6 });
			await page.mouse.up();
		};
		// 꼭짓점은 고른 범위의 왼쪽 위와 오른쪽 아래에 있다
		const outline = (await memo.locator('.memo-table-selection').boundingBox())!;
		const end = (await memo.getByRole('button', { name: '고른 범위 오른쪽 아래 끌기' }).boundingBox())!;
		expect(Math.abs(end.x + end.width / 2 - (outline.x + outline.width))).toBeLessThan(2);
		expect(Math.abs(end.y + end.height / 2 - (outline.y + outline.height))).toBeLessThan(2);

		// 오른쪽 아래를 i까지: b~i (2열 × 3행)
		await dragTo('고른 범위 오른쪽 아래 끌기', 'i');
		await expect(table.locator('.selectedCell')).toHaveCount(6);
		// 왼쪽 위를 a까지: 표 전체
		await dragTo('고른 범위 왼쪽 위 끌기', 'a');
		await expect(table.locator('.selectedCell')).toHaveCount(9);
		// 다시 오른쪽 아래를 e까지 줄이면 a~e (2 × 2)
		await dragTo('고른 범위 오른쪽 아래 끌기', 'e');
		await expect(table.locator('.selectedCell')).toHaveCount(4);
		// Backspace로 고른 칸을 비운다
		await page.keyboard.press('Backspace');
		await expect(table.locator('tr').first().locator('th')).toHaveText(['', '', 'c']);
	});

	test('표 앞뒤에 커서를 두고, 뒤에서 Backspace를 두 번 누르면 표가 지워진다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		const memo = await openMemo(page, api);
		await memo.getByRole('button', { name: '새 메모', exact: true }).first().click();
		await page.keyboard.type('표 지우기');
		await page.keyboard.press('Enter');
		// 본문 맨 앞의 표: 앞에 문단이 없다
		await memo.getByRole('button', { name: '서식', exact: true }).click();
		await page.getByRole('dialog', { name: '서식' }).getByRole('menuitem', { name: '표 넣기' }).click();
		await page.keyboard.type('칸');
		const editor = memo.locator('.ProseMirror');
		await expect(editor.locator('> table')).toBeVisible();

		// 첫 행에서 ↑: 표 앞 틈 커서, 거기서 쓰면 표 앞에 문단이 생긴다
		await page.keyboard.press('ArrowUp');
		await expect(editor.locator('.ProseMirror-gapcursor')).toHaveCount(1);
		await page.keyboard.type('표 앞 글');
		await expect(editor.locator('> p').first()).toHaveText('표 앞 글');
		await expect(editor.locator('> p').first()).toBeVisible();
		expect(await editor.evaluate((el) => el.firstElementChild?.nextElementSibling?.tagName)).toBe('TABLE');

		// 표 뒤 문단 맨 앞에서 Backspace: 한 번은 표를 고르고, 한 번 더 누르면 지운다
		await editor.locator('> p').last().click();
		// 편집기가 클릭한 자리를 읽을 때까지 (사람은 누르고 바로 키를 치지 않는다)
		await page.waitForTimeout(100);
		await page.keyboard.press('Backspace');
		await expect(editor.locator('table.ProseMirror-selectednode')).toHaveCount(1);
		await page.keyboard.press('Backspace');
		await expect(editor.locator('table')).toHaveCount(0);
		await expect.poll(() => api.posts[0]?.body).not.toContain('|');
	});

	test('편집기의 코드 블록에도 읽기 화면과 같은 복사 단추가 있다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		const memo = await openMemo(page, api);
		await memo.locator('.memo-item', { hasText: 'Markdown 블로그에 글쓰기 붙이기' }).click();
		await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
		const block = memo.locator('.ProseMirror .memo-code').first();
		const copy = block.getByRole('button', { name: '코드 복사' });
		await copy.click();
		await expect(copy).toHaveText('복사됨');
		expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
			(await block.locator('code').textContent())!
		);
		// 복사해도 글은 바뀌지 않는다
		expect(api.posts).toEqual([]);
	});

	test('새 메모: 사이드바의 새로운 폴더 옆 단추로 시작하면 목록 맨 위에 새로운 메모가 생기고, 쓴 것 없이 떠나면 사라진다', async ({
		page,
	}) => {
		const api = await fakeApi(page, { signedIn: true });
		const memo = await openMemo(page, api);
		// 사이드바 위쪽: 새 메모가 새로운 폴더 왼쪽에
		const bar = memo.locator('.memo-sidebar-bar');
		const compose = bar.getByRole('button', { name: '새 메모', exact: true });
		const folder = bar.getByRole('button', { name: '새로운 폴더' });
		expect((await compose.boundingBox())!.x).toBeLessThan((await folder.boundingBox())!.x);

		await compose.click();
		const placeholder = memo.locator('.memo-new-item');
		await expect(placeholder).toHaveCount(1);
		await expect(placeholder).toContainText('새로운 메모');
		await expect(placeholder).toContainText('추가 텍스트 없음');
		// 쓰는 대로 목록에 보인다
		await page.keyboard.type('쓰다 만 제목');
		await expect(placeholder.locator('strong')).toHaveText('쓰다 만 제목');

		// 본문 없이 다른 글로 옮겨 가면 접히며 사라진다 (저장하지 않는다)
		await memo.locator('.memo-item', { hasText: 'CRA에서 Vite로' }).click();
		await expect(placeholder).toHaveClass(/leaving/);
		await expect(placeholder).toHaveCount(0);
		expect(api.posts).toEqual([]);
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
				body: '본문\n\n[보고서.pdf](http://api.test/files/fakeupload000001 "첨부 파일 · 2 KB")\n\n```ts\nconst answer = 42;\n```',
				deleted: false,
			},
			{ slug: 'cra-to-vite', title: '', date: '2026-09-28', category: '기타', summary: '', body: '', deleted: true },
		];
		// 게시한 내용으로 둔다
		api.posts[0].published = { ...api.posts[0] };
		const memo = await openMemo(page, api);
		// 서버에만 있는 글도 목록에 있고, 열면 게시한 내용이 보인다
		await memo.locator('.memo-item', { hasText: '서버에만 있는 글' }).click();
		await expect(memo.locator('.memo-item', { hasText: 'CRA에서 Vite로' })).toHaveCount(0);
		await expect(memo.getByRole('heading', { level: 1 })).toHaveText('서버에만 있는 글');
		// 코드 블록의 복사 단추
		await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
		const copy = memo.locator('.memo-markdown').getByRole('button', { name: '코드 복사' });
		await copy.click();
		await expect(copy).toHaveText('복사됨');
		expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('const answer = 42;');
		// 첨부 파일은 편집 화면과 같은 모양의 링크
		await expect(memo.locator(".memo-markdown a[title^='첨부 파일']")).toHaveText('보고서.pdf');
		await expect(memo.getByRole('textbox', { name: '제목' })).toHaveCount(0);
		await expect(memo.locator('.ProseMirror')).toHaveCount(0);
		await expect(memo.getByRole('button', { name: '새 메모', exact: true })).toHaveCount(0);
		await expect(memo.getByTitle('관리자로 로그인했습니다')).toHaveCount(0);
	});
});
