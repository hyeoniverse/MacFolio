import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Page } from '@playwright/test';

async function openMemo(page: Page) {
	await enterDesktop(page);
	await dockItem(page, 'memo').click();
	const memo = appWindow(page, 'memo');
	await expect(memo).toBeVisible();
	return memo;
}

test.describe('메모 (블로그)', () => {
	test('글 목록이 최신순으로 보이고, 첫 글의 본문이 열린다', async ({ page }) => {
		const memo = await openMemo(page);
		const items = memo.getByRole('region', { name: '글 목록' }).locator('.memo-item');
		await expect(items).not.toHaveCount(0);

		const firstTitle = (await items.first().locator('strong').textContent())!;
		await expect(memo.getByRole('article')).toHaveAccessibleName(firstTitle);
		await expect(memo.getByRole('article').getByRole('heading', { level: 1 })).toHaveText(firstTitle);
	});

	test('본문 위 도구 막대: 목록/갤러리 단추와 검색 칸 사이에 간격이 있다', async ({ page }) => {
		const memo = await openMemo(page);
		const toolbar = memo.locator('.memo-reader-toolbar');
		const toggle = await toolbar.getByRole('button', { name: '갤러리로 보기' }).boundingBox();
		const search = await toolbar.locator('.memo-search').boundingBox();
		expect(search!.x - (toggle!.x + toggle!.width)).toBeGreaterThanOrEqual(8);
	});

	test('글을 고르면 Markdown 본문(제목, 표, 코드)이 렌더링된다', async ({ page }) => {
		const memo = await openMemo(page);
		await memo.locator('.memo-item', { hasText: 'CRA에서 Vite로 옮기기' }).click();

		const article = memo.getByRole('article', { name: 'CRA에서 Vite로 옮기기' });
		await expect(article.getByRole('heading', { name: '왜 옮겼나' })).toBeVisible();
		await expect(article.getByRole('table')).toContainText('dev 서버 시작');
		await expect(article.locator('code').first()).toBeVisible();
	});

	test('카테고리와 검색어로 글을 거른다', async ({ page }) => {
		const memo = await openMemo(page);
		const items = memo.locator('.memo-item');
		const total = await items.count();

		const folders = memo.getByRole('navigation', { name: '카테고리' });
		await folders.getByRole('button', { name: /^개발기/ }).click();
		await expect(items).not.toHaveCount(0);

		await memo.getByRole('searchbox', { name: '글 검색' }).fill('Fast Refresh');
		await expect(items).toHaveCount(1);
		await expect(items.first()).toContainText('CRA에서 Vite로 옮기기');

		await memo.getByRole('searchbox', { name: '글 검색' }).fill('존재하지 않는 검색어');
		await expect(memo.getByText('검색 결과가 없습니다.')).toBeVisible();

		await memo.getByRole('searchbox', { name: '글 검색' }).fill('');
		await folders.getByRole('button', { name: /^모든 글/ }).click();
		await expect(items).toHaveCount(total);
	});

	test('본문 이미지는 본문 폭에 맞춰 보이고, 클릭하면 크게 본다', async ({ page }) => {
		const memo = await openMemo(page);
		await memo.locator('.memo-item', { hasText: 'CRA에서 Vite로 옮기기' }).click();

		const image = memo.getByRole('img', { name: 'CRA와 Vite의 빌드 시간 비교 그래프' });
		await image.scrollIntoViewIfNeeded();
		await expect(image).toBeVisible();
		// 글 파일 기준 상대 경로가 실제로 불러와졌다
		expect(await image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
		const imageBox = (await image.boundingBox())!;
		const readerBox = (await memo.locator('.memo-markdown').boundingBox())!;
		expect(imageBox.width).toBeLessThanOrEqual(readerBox.width + 1);
		await expect(memo.locator('.memo-caption')).toHaveText('dev 서버 시작과 프로덕션 빌드 시간 (초)');

		await memo.getByRole('button', { name: 'CRA와 Vite의 빌드 시간 비교 그래프 크게 보기' }).click();
		const lightbox = page.getByRole('dialog', { name: 'CRA와 Vite의 빌드 시간 비교 그래프' });
		await expect(lightbox).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(lightbox).toBeHidden();

		await memo.getByRole('button', { name: 'CRA와 Vite의 빌드 시간 비교 그래프 크게 보기' }).click();
		await lightbox.click();
		await expect(lightbox).toBeHidden();
	});

	test('본문의 바깥 링크는 새 탭으로, 다른 글 링크는 메모 앱 안에서 그 글로', async ({ page }) => {
		await enterDesktop(page, '/memo/r2-backup-setup');
		const memo = appWindow(page, 'memo');
		const article = memo.getByRole('article');
		await expect(article.getByRole('heading', { level: 1 })).toHaveText(/R2에 DB 백업 걸기/);

		// 바깥 링크는 새 탭
		const outside = article.getByRole('link', { name: 'healthchecks.io' }).first();
		await expect(outside).toHaveAttribute('target', '_blank');
		await expect(outside).toHaveAttribute('rel', /noopener/);

		// 다른 글 링크: 새 탭 없이 같은 메모 앱에서 그 글이 열리고, 주소 막대도 그 글로
		const inside = article.getByRole('link', { name: '백업 스크립트' });
		await expect(inside).toHaveAttribute('href', '/memo/db-backup');
		await expect(inside).not.toHaveAttribute('target', '_blank');
		const popup = page.waitForEvent('popup', { timeout: 1000 }).catch(() => null);
		await inside.click();
		await expect(memo.getByRole('article').getByRole('heading', { level: 1 })).toHaveText(
			'글이 DB에만 있게 되어서 백업을 붙였다'
		);
		await expect(page).toHaveURL(/\/memo\/db-backup$/);
		expect(await popup).toBeNull();
	});

	test('예전 메모(방명록) 데이터는 지운다', async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => localStorage.setItem('macfolio:memos', '{"folders":{},"memos":{}}'));
		await openMemo(page);
		expect(await page.evaluate(() => localStorage.getItem('macfolio:memos'))).toBeNull();
	});

	test('사이드바를 여닫을 수 있다', async ({ page }) => {
		const memo = await openMemo(page);
		const folders = memo.getByRole('navigation', { name: '카테고리' });
		await expect(folders.getByRole('button', { name: /모든 글/ })).toBeVisible();

		await memo.getByRole('button', { name: '사이드바 가리기' }).click();
		await expect(folders.getByRole('button', { name: /모든 글/ })).toBeHidden();
		await expect(memo.getByRole('region', { name: '글 목록' })).toBeVisible();

		await memo.getByRole('button', { name: '사이드바 보기' }).click();
		await expect(folders.getByRole('button', { name: /모든 글/ })).toBeVisible();
	});

	test('하위 폴더를 접고 펼치고, 상위 폴더를 고르면 하위 폴더의 글도 보인다', async ({ page }) => {
		const memo = await openMemo(page);
		const folders = memo.getByRole('navigation', { name: '카테고리' });
		const child = folders.getByRole('button', { name: /^MacFolio/ });
		await expect(child).toBeVisible();

		await folders.getByRole('button', { name: /^개발기/ }).click();
		await expect(memo.locator('.memo-item')).not.toHaveCount(0);

		await folders.getByRole('button', { name: '하위 폴더 접기 (개발기)' }).click();
		await expect(child).toBeHidden();
		await folders.getByRole('button', { name: '하위 폴더 펼치기 (개발기)' }).click();
		await expect(child).toBeVisible();
	});

	test('갤러리로 보기: 글을 카드로 보여주고, 카드를 누르면 글이 열리고 갤러리로 돌아온다', async ({ page }) => {
		const memo = await openMemo(page);
		await memo.getByRole('button', { name: '갤러리로 보기' }).first().click();

		const gallery = memo.getByRole('region', { name: '갤러리' });
		await expect(gallery).toBeVisible();
		await expect(memo.getByRole('region', { name: '글 목록' })).toBeHidden();
		const cards = gallery.locator('.memo-card');
		await expect(cards).not.toHaveCount(0);

		await cards.filter({ hasText: 'CRA에서 Vite로 옮기기' }).click();
		await expect(memo.getByRole('article', { name: 'CRA에서 Vite로 옮기기' })).toBeVisible();
		await expect(gallery).toBeHidden();

		await memo.locator('.memo-gallery-back').click();
		await expect(gallery).toBeVisible();

		await gallery.getByRole('button', { name: '목록으로 보기' }).click();
		await expect(memo.getByRole('region', { name: '글 목록' })).toBeVisible();
	});

	test('검색 칸은 목록·갤러리 어디서든 도구 막대 오른쪽 끝에 있다', async ({ page }) => {
		const memo = await openMemo(page);
		const search = memo.getByRole('searchbox', { name: '글 검색' });
		const windowBox = (await memo.boundingBox())!;
		const right = async () => {
			const box = (await search.boundingBox())!;
			return Math.round(windowBox.x + windowBox.width - (box.x + box.width));
		};
		const inList = await right();
		await memo.getByRole('button', { name: '갤러리로 보기' }).first().click();
		expect(await right()).toBe(inList);
		expect((await search.boundingBox())!.y - windowBox.y).toBeLessThan(52);
	});

	test('코드 블록은 문법 강조가 된다', async ({ page }) => {
		const memo = await openMemo(page);
		await memo.locator('.memo-item', { hasText: '테스트를 붙이자' }).click();
		const code = memo.getByRole('article').locator('pre code').first();
		await expect(code).toHaveClass(/hljs/);
		await expect(code.locator('.hljs-keyword').first()).toBeVisible();
	});

	test('정렬 기준·순서와 날짜별 그룹화를 바꾸고, 다시 열어도 그대로다', async ({ page }) => {
		const memo = await openMemo(page);
		const list = memo.getByRole('region', { name: '글 목록' });
		const titles = () => list.locator('.memo-item strong').allTextContents();
		const openSortMenu = async () => {
			await memo.getByRole('button', { name: '정렬과 그룹화' }).click();
			return page.getByRole('menu', { name: '정렬과 그룹화' });
		};

		// 처음에는 날짜 최신 순, 날짜별로 묶여 있다
		await expect(list.locator('.memo-section-title').first()).toBeVisible();
		let menu = await openSortMenu();
		await expect(menu.getByRole('menuitemcheckbox', { name: '날짜', exact: true })).toHaveAttribute(
			'aria-checked',
			'true'
		);
		await menu.getByRole('menuitemcheckbox', { name: '날짜별로 그룹화' }).click();
		await expect(list.locator('.memo-section-title')).toHaveCount(0);

		// 제목 가나다 순
		menu = await openSortMenu();
		await menu.getByRole('menuitemcheckbox', { name: '제목', exact: true }).click();
		const byTitle = await titles();
		expect(byTitle).toEqual([...byTitle].sort((a, b) => a.localeCompare(b, 'ko')));

		// 제목으로 정렬하면 날짜별 묶기는 끌 수 없고, 역순으로 바꿀 수 있다
		menu = await openSortMenu();
		await expect(menu.getByRole('menuitemcheckbox', { name: '날짜별로 그룹화' })).toBeDisabled();
		await menu.getByRole('menuitemcheckbox', { name: '역순' }).click();
		await expect.poll(titles).toEqual([...byTitle].reverse());

		// 이 브라우저에 저장되어 다시 열어도 그대로
		await page.reload();
		const again = await openMemo(page);
		await expect
			.poll(() => again.getByRole('region', { name: '글 목록' }).locator('.memo-item strong').allTextContents())
			.toEqual([...byTitle].reverse());
	});

	test('본문 아래의 이전 글·다음 글로 날짜 순으로 옮겨 다닌다', async ({ page }) => {
		const memo = await openMemo(page);
		const titles = await memo.getByRole('region', { name: '글 목록' }).locator('.memo-item strong').allTextContents();
		const article = memo.getByRole('article');
		const nav = article.getByRole('navigation', { name: '이전 글, 다음 글' });

		// 처음 열린 글은 가장 최근 글: 다음 글은 없고 이전 글만 있다
		await expect(article).toHaveAccessibleName(titles[0]);
		await expect(nav.getByRole('button', { name: /다음 글/ })).toHaveCount(0);

		await nav.getByRole('button', { name: /이전 글/ }).click();
		await expect(article).toHaveAccessibleName(titles[1]);
		await nav.getByRole('button', { name: /다음 글/ }).click();
		await expect(article).toHaveAccessibleName(titles[0]);
	});

	test('목록 위에 폴더 이름과 메모 수가 보인다', async ({ page }) => {
		const memo = await openMemo(page);
		const heading = memo.getByRole('region', { name: '글 목록' }).locator('.memo-toolbar-heading');
		await expect(heading).toContainText('모든 글');
		// 글은 계속 늘어나므로 목록에 보이는 글 수와 맞는지 본다
		const count = await memo.locator('.memo-item').count();
		expect(count).toBeGreaterThan(0);
		await expect(heading).toContainText(`${count}개의 메모`);
	});

	test('방문자는 편집할 수 없다 (편집은 관리자만, #9)', async ({ page }) => {
		// 예전에 방문자 브라우저에 저장된 정리 내용은 지운다
		await page.goto('/');
		await page.evaluate(() =>
			localStorage.setItem(
				'macfolio:memo:organization',
				JSON.stringify({ folders: ['몰래 만든 폴더'], posts: {}, moves: [], pins: {} })
			)
		);
		const memo = await openMemo(page);
		const folders = memo.getByRole('navigation', { name: '카테고리' });

		await expect(folders.getByRole('button', { name: /^몰래 만든 폴더/ })).toHaveCount(0);
		expect(await page.evaluate(() => localStorage.getItem('macfolio:memo:organization'))).toBeNull();

		await expect(memo.getByRole('button', { name: '새로운 폴더' })).toHaveCount(0);
		await folders.getByRole('button', { name: /^개발기/ }).hover();
		await expect(folders.getByRole('button', { name: /폴더 동작/ })).toHaveCount(0);
		await expect(memo.getByRole('button', { name: /메모 고정/ })).toHaveCount(0);
		await expect(folders.getByRole('button', { name: /^개발기/ })).toHaveAttribute('draggable', 'false');

		await memo.locator('.memo-item').first().click({ button: 'right' });
		await expect(page.getByRole('menu')).toHaveCount(0);
	});

	test('본문 이미지에 올리면 내려받기 단추가 보이고, 누르면 파일로 받는다', async ({ page }) => {
		const memo = await openMemo(page);
		await memo.locator('.memo-item', { hasText: 'Markdown 블로그에 글쓰기 붙이기' }).click();
		const frame = memo.locator('.memo-markdown .memo-figure-frame').first();
		await frame.hover();
		const button = frame.getByRole('button', { name: '이미지 내려받기' });
		await expect(button).toBeVisible();
		const download = page.waitForEvent('download');
		await button.click();
		expect((await download).suggestedFilename()).toMatch(/\.(jpg|png|webp)$/);
	});
});
