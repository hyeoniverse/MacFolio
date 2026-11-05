import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Locator } from '@playwright/test';
import { fakeApi } from './fakeApi';
import { LAYOUT_POST_TITLE, layoutPost } from './memoLayoutPost';

const box = async (locator: Locator) => (await locator.boundingBox())!;

/** 목차 막대의 항목 (## 제목. ## 제목이 둘 미만이면 모든 제목) */
const barItems = (nav: Locator) => nav.locator('.memo-toc-bar-list button');

/** 본문 제목 가운데 막대에 놓일 것 (toc.ts의 tocBarItems와 같은 규칙) */
const expectedBar = async (body: Locator) => {
	const sections = (await body.locator(':scope > h2').allTextContents()).map((text) => text.trim());
	return sections.length >= 2
		? sections
		: (await body.locator(':scope > h2, :scope > h3').allTextContents()).map((text) => text.trim());
};

/** 항목이 모두 한 줄에 놓였는지 (위 끝이 같다) */
const tops = (items: Locator) =>
	items.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));

test.describe('메모 목차', () => {
	test('제목 아래의 한 줄 목차 막대: ## 제목을 가로로 늘어놓고, 넘기면 스크롤 칸 위에 붙는다. 항목을 누르면 그 제목으로 가고 지금 읽는 절을 따라간다', async ({
		page,
	}) => {
		await fakeApi(page, { signedIn: false });
		await enterDesktop(page, '/memo/merge-strategies');
		const memo = appWindow(page, 'memo');
		const nav = memo.getByRole('navigation', { name: '목차' });
		const items = barItems(nav);
		const body = memo.locator('.memo-reader-body .memo-markdown');
		const scroller = memo.locator('.memo-reader .memo-scroll');
		// 접기 블록 안의 제목은 넣지 않는다 (펼치지 않으면 갈 수 없다). ### 제목은 막대에 놓지 않는다
		const expected = await expectedBar(body);
		expect(expected.length).toBeGreaterThanOrEqual(3);
		await expect(items).toHaveText(expected);
		expect(await body.locator(':scope > h3').count()).toBeGreaterThan(0);
		// 막대는 글 제목 바로 아래, 한 줄이다
		const title = await box(memo.locator('.memo-reader-body h1'));
		expect((await box(nav)).y).toBeGreaterThan(title.y);
		expect(new Set(await tops(items)).size).toBe(1);
		// 맨 위에서는 붙지 않았고 구분선도 없다. 읽는 절도 아직 없다
		await expect(nav).not.toHaveAttribute('data-stuck', /.*/);
		await expect(nav.locator('[aria-current="location"]')).toHaveCount(0);
		// 막대 안에서만 가로로 넘긴다 (세로로는 넘기지 않는다)
		const overflow = await nav
			.locator('.memo-toc-bar-list')
			.evaluate((el) => [getComputedStyle(el).overflowX, getComputedStyle(el).overflowY]);
		expect(overflow).toEqual(['auto', 'hidden']);
		expect(await items.first().evaluate((el) => getComputedStyle(el).whiteSpace)).toBe('nowrap');

		const target = expected[3];
		await nav.getByRole('button', { name: target, exact: true }).click();
		const heading = body.locator(':scope > h2', { hasText: target }).first();
		await expect(heading).toBeInViewport();
		await expect(heading).toBeFocused();
		await expect(page).toHaveURL(/\/memo\/merge-strategies$/);
		// 넘긴 뒤에는 스크롤 칸 맨 위에 붙어 구분선을 긋고, 누른 절이 지금 읽는 절이다
		await expect(nav).toHaveAttribute('data-stuck', 'true');
		await expect.poll(async () => Math.round((await box(nav)).y - (await box(scroller)).y)).toBe(0);
		expect(await nav.evaluate((el) => getComputedStyle(el).borderBottomColor)).not.toBe('rgba(0, 0, 0, 0)');
		await expect(nav.locator('[aria-current="location"]')).toHaveText(target);
		// 제목이 막대에 가리지 않는다
		expect((await box(heading)).y).toBeGreaterThanOrEqual((await box(nav)).y + (await box(nav)).height - 1);

		// 본문을 넘기면 지금 읽는 절이 따라간다. 그 절의 ### 제목을 지나도 ## 항목이 그대로 표시된다
		const sub = body.locator(':scope > h3').first();
		await sub.evaluate((el) => el.scrollIntoView({ block: 'start' }));
		await expect(nav.locator('[aria-current="location"]')).toHaveText(expected[0]);
		const last = expected[expected.length - 1];
		await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight));
		await expect(nav.locator('[aria-current="location"]')).toHaveText(last);
		// 지금 읽는 항목은 막대 안에 보인다 (막대만 가로로 넘긴다)
		const active = await box(nav.locator('[aria-current="location"]'));
		const row = await box(nav.locator('.memo-toc-bar-list'));
		expect(active.x).toBeGreaterThanOrEqual(row.x - 1);
		expect(active.x + active.width).toBeLessThanOrEqual(row.x + row.width + 1);
		// 맨 위로 돌아가면 붙지 않은 자리로
		await scroller.evaluate((el) => el.scrollTo(0, 0));
		await expect(nav).not.toHaveAttribute('data-stuck', /.*/);
		await expect(nav.locator('[aria-current="location"]')).toHaveCount(0);

		// 글자 크기 버튼(가 가)의 배율이 목차에도 걸린다
		const before = (await box(items.first())).height;
		await memo.getByRole('button', { name: '글자 크게' }).click();
		await expect.poll(async () => (await box(items.first())).height).toBeGreaterThan(before * 1.1);
		// 배율이 걸려도 본문 칸이 가로로 넘치지 않는다 (막대 바탕을 좌우 여백까지 넓힌 만큼)
		expect(await scroller.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
	});

	test('지금 읽는 항목이 막대 밖이면 막대만 가로로 넘긴다. 본문 스크롤은 움직이지 않는다', async ({ page }) => {
		await fakeApi(page, { signedIn: false });
		await page.setViewportSize({ width: 1000, height: 800 });
		await enterDesktop(page, '/memo/merge-strategies');
		const memo = appWindow(page, 'memo');
		const nav = memo.getByRole('navigation', { name: '목차' });
		const list = nav.locator('.memo-toc-bar-list');
		const scroller = memo.locator('.memo-reader .memo-scroll');
		// 좁은 창에서는 항목이 막대보다 길다
		expect(await list.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
		const body = memo.locator('.memo-reader-body .memo-markdown');
		const expected = await expectedBar(body);
		const last = expected[expected.length - 1];
		// 늦게 불러오는 그림을 먼저 다 불러 둔다 (그림이 뜨며 높이가 바뀌면 스크롤 앵커링이 세로 자리를 옮긴다)
		await body.locator('img').evaluateAll((images) =>
			Promise.all(
				(images as HTMLImageElement[]).map((image) => {
					image.loading = 'eager';
					return image.decode().catch(() => undefined);
				})
			)
		);
		await scroller.evaluate((el) => el.scrollTo(0, 0));
		await list.evaluate((el) => el.scrollTo(0, 0));
		const heading = body.locator(':scope > h2', { hasText: last }).first();
		const top = await heading.evaluate((el) => {
			const scroller = el.closest('.memo-scroll')!;
			return el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 40;
		});
		// 막대가 가로로 넘어가기 전에 세로 자리를 적어 둔다 (본문 칸 끝에 닿으면 그만큼만 넘어간다)
		const scrolled = await scroller.evaluate((el, y) => {
			el.scrollTo(0, y);
			return el.scrollTop;
		}, top);
		await expect(nav.locator('[aria-current="location"]')).toHaveText(last);
		await expect.poll(() => list.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
		// 막대를 넘겨도 본문의 세로 스크롤은 그 자리다
		expect(Math.round(await scroller.evaluate((el) => el.scrollTop))).toBe(Math.round(scrolled));
	});

	test('편집 화면에도 목차 막대와 글자 크기 버튼이 있다. 항목을 누르면 그 제목에 커서를 두고, 키운 글자에서도 누른 자리에 입력된다', async ({
		page,
	}) => {
		await fakeApi(page, { signedIn: true });
		await enterDesktop(page, '/memo/merge-strategies');
		const memo = appWindow(page, 'memo');
		const editor = memo.locator('.ProseMirror');
		await expect(editor).toBeVisible();
		const nav = memo.getByRole('navigation', { name: '목차' });
		const items = barItems(nav);
		const expected = (await editor.locator(':scope > h2').allTextContents()).map((text) => text.trim());
		await expect(items).toHaveText(expected);
		expect(new Set(await tops(items)).size).toBe(1);

		const target = expected[2];
		await nav.getByRole('button', { name: target, exact: true }).click();
		const heading = editor.locator(':scope > h2', { hasText: target }).first();
		await expect(heading).toBeInViewport();
		await expect(editor).toBeFocused();
		expect(await heading.evaluate((el) => el.contains(document.getSelection()?.anchorNode ?? null))).toBe(true);
		// 편집 화면에서도 스크롤 칸 위에 붙고, 지금 읽는 절을 표시한다
		await expect(nav).toHaveAttribute('data-stuck', 'true');
		await expect(nav.locator('[aria-current="location"]')).toHaveText(target);

		// 커서는 제목 맨 앞이다
		await page.keyboard.type('★');
		await expect(heading).toHaveText(new RegExp(`^★${target}`));
		// 제목을 더하면 목차도 바뀐다
		const last = editor.locator(':scope > p').last();
		await last.scrollIntoViewIfNeeded();
		await last.click();
		await page.keyboard.press('End');
		await page.keyboard.press('Enter');
		await page.keyboard.type('## 새로 쓴 절');
		await expect(nav.getByRole('button', { name: '새로 쓴 절', exact: true })).toBeVisible();

		// 글자 크기: 편집기 본문도 같은 배율로 키운다
		await memo.getByRole('button', { name: '글자 크게' }).click();
		expect(await editor.evaluate((el) => getComputedStyle(el).zoom)).toBe('1.15');
		expect(await nav.evaluate((el) => getComputedStyle(el).zoom)).toBe('1.15');
		const paragraph = editor.locator(':scope > p').first();
		await paragraph.evaluate((el) => el.scrollIntoView({ block: 'center' }));
		const rect = (await paragraph.boundingBox())!;
		// 첫 줄의 왼쪽 끝 가까이를 누르고 쓴다: 확대한 편집기에서도 누른 자리(첫 단어 안)에 입력된다.
		// zoom이 좌표에 두 번 곱해지면 커서가 오른쪽·아래로 밀려 다른 줄에 선다
		await page.mouse.click(rect.x + 40, rect.y + 12);
		await page.keyboard.type('★');
		const at = (await paragraph.textContent())!.indexOf('★');
		expect(at).toBeGreaterThan(0);
		expect(at).toBeLessThan(10);
	});

	test('제목이 셋 미만인 글에는 목차가 없다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: false });
		const content = {
			title: '짧은 글',
			date: '2026-10-27',
			category: '개발기/MacFolio',
			summary: '',
			body: '## 하나\n\n글.\n\n## 둘\n\n글.',
		};
		api.posts = [{ slug: 'short-post', ...content, deleted: false, published: content }];
		await enterDesktop(page, '/memo/short-post');
		const memo = appWindow(page, 'memo');
		await expect(memo.locator('.memo-reader-body h1')).toHaveText('짧은 글');
		await expect(memo.getByRole('navigation', { name: '목차' })).toHaveCount(0);
	});

	test('## 제목이 둘 미만이면 ### 제목까지 모두 막대에 놓는다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: false });
		const content = {
			title: '작은 절의 글',
			date: '2026-10-27',
			category: '개발기/MacFolio',
			summary: '',
			body: '## 하나\n\n글.\n\n### 가\n\n글.\n\n### 나\n\n글.',
		};
		api.posts = [{ slug: 'sub-post', ...content, deleted: false, published: content }];
		await enterDesktop(page, '/memo/sub-post');
		const memo = appWindow(page, 'memo');
		await expect(barItems(memo.getByRole('navigation', { name: '목차' }))).toHaveText(['하나', '가', '나']);
	});
});

test.describe('메모 이미지 배치', () => {
	test('주소 끝의 #left·#right는 정렬, #float-left·#float-right는 본문 40% 폭으로 띄우고 문단이 옆으로 흐른다', async ({
		page,
	}) => {
		const api = await fakeApi(page, { signedIn: false });
		api.posts = [layoutPost()];
		await enterDesktop(page);
		await dockItem(page, 'memo').click();
		const memo = appWindow(page, 'memo');
		await memo.locator('.memo-item', { hasText: LAYOUT_POST_TITLE }).click();
		const body = memo.locator('.memo-reader-body .memo-markdown');
		const area = await box(body);
		const figure = (alt: string) => body.locator('.memo-figure', { has: page.getByRole('img', { name: alt }) });

		await expect(figure('왼쪽 그림')).toHaveAttribute('data-layout', 'left');
		// 정렬은 본문보다 좁은 그림에서 보인다
		expect((await box(figure('왼쪽 그림').locator('img'))).width).toBeLessThan(area.width - 40);
		expect(Math.abs((await box(figure('왼쪽 그림').locator('img'))).x - area.x)).toBeLessThan(2);
		const right = await box(figure('오른쪽 그림').locator('img'));
		expect(Math.abs(right.x + right.width - (area.x + area.width))).toBeLessThan(2);

		for (const [alt, side] of [
			['왼쪽에 띄운 그림', 'left'],
			['오른쪽에 띄운 그림', 'right'],
		] as const) {
			const floated = figure(alt);
			expect(await floated.evaluate((el) => getComputedStyle(el).float)).toBe(side);
			const rect = await box(floated);
			expect(Math.abs(rect.width - area.width * 0.4)).toBeLessThan(2);
			// 다음 문단의 첫 줄은 이미지 옆에서 시작한다
			const next = floated.locator('xpath=ancestor::p/following-sibling::p[1]');
			const line = await next.evaluate((p) => {
				const range = document.createRange();
				range.selectNodeContents(p);
				const first = range.getClientRects()[0];
				return { left: first.left, right: first.right };
			});
			if (side === 'left') expect(line.left).toBeGreaterThan(rect.x + rect.width);
			else expect(line.right).toBeLessThan(rect.x);
		}
		// 캡션은 띄운 이미지 아래
		await expect(figure('왼쪽에 띄운 그림').locator('.memo-caption')).toHaveText('왼쪽에 띄운 캡션');
		// 다음 제목은 띄운 이미지 아래에서 시작한다
		const floatedLeft = await box(figure('왼쪽에 띄운 그림'));
		const nextHeading = await box(body.getByRole('heading', { name: '오른쪽에 띄우기' }));
		expect(nextHeading.y).toBeGreaterThanOrEqual(floatedLeft.y + floatedLeft.height);
	});

	test('편집기: 이미지를 고르고 배치 버튼을 누르면 같은 배치로 보이고, 저장한 Markdown 주소 끝에 표기가 남는다', async ({
		page,
	}) => {
		const api = await fakeApi(page, { signedIn: true });
		api.posts = [layoutPost()];
		await enterDesktop(page);
		await dockItem(page, 'memo').click();
		const memo = appWindow(page, 'memo');
		await memo.locator('.memo-item', { hasText: LAYOUT_POST_TITLE }).click();
		const editor = memo.locator('.ProseMirror');
		await expect(editor).toBeVisible();
		const figure = editor.locator('.memo-figure', { has: page.getByRole('img', { name: '왼쪽 그림' }) });
		await expect(figure).toHaveAttribute('data-layout', 'left');
		await figure.locator('img').click();
		const bar = figure.getByRole('group', { name: '이미지 배치' });
		await expect(bar.getByRole('button', { name: '왼쪽 정렬' })).toHaveAttribute('aria-pressed', 'true');
		await bar.getByRole('button', { name: '오른쪽에 띄우고 글 감싸기' }).click();
		await expect(figure).toHaveAttribute('data-layout', 'float-right');
		expect(await figure.evaluate((el) => getComputedStyle(el).float)).toBe('right');
		await expect
			.poll(() => api.posts[0]?.body)
			.toContain('![왼쪽 그림](/imgs/projects/sproutfarm/scene.png#float-right)');
		// 가운데로 되돌리면 표기를 지운다
		await bar.getByRole('button', { name: '가운데 정렬' }).click();
		await expect(figure).not.toHaveAttribute('data-layout', /.+/);
		await expect.poll(() => api.posts[0]?.body).toContain('![왼쪽 그림](/imgs/projects/sproutfarm/scene.png)\n');
	});
});
