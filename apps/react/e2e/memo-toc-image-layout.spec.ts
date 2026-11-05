import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Locator } from '@playwright/test';
import { fakeApi } from './fakeApi';
import { LAYOUT_POST_TITLE, layoutPost } from './memoLayoutPost';

const box = async (locator: Locator) => (await locator.boundingBox())!;

/** 본문 제목 (접기 블록 밖의 ## · ### · ####, 본문 순서) */
const headingTexts = async (body: Locator) =>
	(await body.locator(':scope > :is(h2, h3, h4)').allTextContents()).map((text) => text.trim());

/** 본문 제목 가운데 이전·다음으로 오가는 절 (toc.ts의 tocBarItems와 같은 규칙) */
const expectedSections = async (body: Locator) => {
	const sections = (await body.locator(':scope > h2').allTextContents()).map((text) => text.trim());
	return sections.length >= 2 ? sections : headingTexts(body);
};

/**
 * 붙은 막대의 버튼을 마우스로 누른다. Playwright의 click은 누르기 전에 요소를 화면 안으로 넘기는데,
 * 붙은 막대는 scroll-padding 안에 있어 본문이 위로 넘어가고 누른 뒤의 부드러운 스크롤과 엉킨다
 */
const press = async (button: Locator) => {
	const rect = await box(button);
	await button.page().mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
};

/** 제목 아래의 목차 블록 */
const block = (scope: Locator) => {
	const nav = scope.getByRole('navigation', { name: '목차', exact: true });
	return {
		nav,
		toggle: nav.getByRole('button', { name: '목차', exact: true }),
		items: nav.locator('.memo-toc-list button'),
	};
};

/** 목차 블록을 펼치고 그 제목을 눌러 그 절로 간다 (막대가 붙는다) */
const jumpFromBlock = async (scope: Locator, name: string) => {
	const { toggle, nav } = block(scope);
	if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
	await nav.getByRole('button', { name, exact: true }).click();
};

const bar = (scope: Locator) => {
	// 붙기 전의 막대는 inert라 접근성 트리에 없으므로 class로 찾는다
	const nav = scope.locator('nav.memo-toc-bar');
	return {
		nav,
		prev: nav.locator('.memo-toc-bar-step[data-side="prev"]'),
		next: nav.locator('.memo-toc-bar-step[data-side="next"]'),
		section: nav.locator('.memo-toc-bar-section'),
		sub: nav.locator('.memo-toc-bar-sub'),
		toggle: nav.getByRole('button', { name: '모든 제목 보기', exact: true }),
		list: nav.locator('.memo-toc-bar-list'),
	};
};

test.describe('메모 목차', () => {
	test('제목 아래의 목차 블록: 접힌 채 시작하고, 펼치면 모든 제목을 보이며 펼친 상태를 기억한다', async ({ page }) => {
		await fakeApi(page, { signedIn: false });
		await enterDesktop(page, '/memo/merge-strategies');
		const memo = appWindow(page, 'memo');
		const { nav, toggle, items } = block(memo);
		const body = memo.locator('.memo-reader-body .memo-markdown');
		const headings = await headingTexts(body);
		// 블록은 글 제목 아래에 있고 접힌 채 시작한다
		const title = await box(memo.locator('.memo-reader-body h1'));
		expect((await box(nav)).y).toBeGreaterThan(title.y);
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await expect(items.first()).toBeHidden();
		// 맨 위에서는 막대가 감춰져 있고 자리도 차지하지 않는다 (블록 바로 아래에 본문)
		await expect(bar(memo).nav).toBeHidden();
		const gap = (await box(body)).y - ((await box(nav)).y + (await box(nav)).height);
		expect(gap).toBeLessThan(32);

		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-expanded', 'true');
		await expect(items).toHaveText(headings);
		await expect.poll(() => page.evaluate(() => localStorage.getItem('macfolio:memo:toc-open'))).toBe('true');
		// 다시 열어도 펼친 채
		await page.reload();
		await enterDesktop(page, '/memo/merge-strategies');
		await expect(block(appWindow(page, 'memo')).toggle).toHaveAttribute('aria-expanded', 'true');
		// 접으면 기억도 지운다
		await block(appWindow(page, 'memo')).toggle.click();
		await expect.poll(() => page.evaluate(() => localStorage.getItem('macfolio:memo:toc-open'))).toBeNull();
	});

	test('목차 블록이 화면 위로 지나가면 목차 막대가 붙어 나타난다: 지금 읽는 절과 소제목, 이전·다음 절을 한 줄에 보인다', async ({
		page,
	}) => {
		await fakeApi(page, { signedIn: false });
		await enterDesktop(page, '/memo/merge-strategies');
		const memo = appWindow(page, 'memo');
		const { nav, prev, next, section, sub } = bar(memo);
		const body = memo.locator('.memo-reader-body .memo-markdown');
		const scroller = memo.locator('.memo-reader .memo-scroll');
		const sections = await expectedSections(body);
		expect(sections.length).toBeGreaterThanOrEqual(3);
		await expect(nav).toBeHidden();

		// 블록에서 첫 절로: 그 제목으로 가서 초점을 두고, 막대가 스크롤 칸 맨 위에 붙어 나타난다. 주소의 #는 바꾸지 않는다
		await jumpFromBlock(memo, sections[0]);
		const first = body.locator(':scope > h2', { hasText: sections[0] }).first();
		await expect(first).toBeInViewport();
		await expect(first).toBeFocused();
		await expect(page).toHaveURL(/\/memo\/merge-strategies$/);
		await expect(nav).toHaveAttribute('data-stuck', 'true');
		await expect(nav).toBeVisible();
		await expect.poll(async () => Math.round((await box(nav)).y - (await box(scroller)).y)).toBe(0);
		expect((await box(nav)).height).toBeLessThan(56);
		await expect(section).toHaveText(sections[0]);
		await expect(prev).toBeDisabled();
		await expect(next).toHaveAccessibleName(`다음 절: ${sections[1]}`);
		// 제목이 막대에 가리지 않는다
		expect((await box(first)).y).toBeGreaterThanOrEqual((await box(nav)).y + (await box(nav)).height - 1);
		// 블록의 지금 읽는 제목도 같이 표시한다
		await expect(block(memo).nav.locator('[aria-current="location"]')).toHaveText(sections[0]);

		await press(next);
		await expect(section).toHaveText(sections[1]);
		await expect(prev).toHaveAccessibleName(`이전 절: ${sections[0]}`);
		await press(prev);
		await expect(section).toHaveText(sections[0]);

		// ### 소제목을 지나면 절 이름 옆에 소제목이 보인다
		const h3 = body.locator(':scope > h3').first();
		const h3Text = (await h3.textContent())!.trim();
		await h3.evaluate((el) => el.scrollIntoView({ block: 'start' }));
		await expect(sub).toHaveText(h3Text);
		const parent = await h3.evaluate((el) => {
			let node = el.previousElementSibling;
			while (node && node.tagName !== 'H2') node = node.previousElementSibling;
			return node?.textContent?.trim() ?? '';
		});
		await expect(section).toHaveText(parent);
		// 절이 바뀌면 새 글자가 읽는 방향으로 미끄러지며 나타난다 (아래로 읽어 가면 아래에서 올라온다).
		// 시험은 움직임 줄이기로 돌므로 그 설정을 끄고 본다 (켜져 있으면 움직이지 않는다)
		expect(await sub.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		expect(await sub.evaluate((el) => getComputedStyle(el).animationName)).toBe('memo-toc-swap-forward');
		await page.emulateMedia({ reducedMotion: 'reduce' });
		// 이전·현재·다음·목록 버튼이 한 줄에 놓인다
		const centers = await nav
			.locator('.memo-toc-bar-row > *')
			.evaluateAll((els) =>
				els.map((el) => Math.round(el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2))
			);
		expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(2);

		// 마지막 절: 다음 절은 없다
		await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight));
		await expect(section).toHaveText(sections[sections.length - 1]);
		await expect(next).toBeDisabled();
		// 맨 위로 돌아가면 막대는 다시 감춰진다
		await scroller.evaluate((el) => el.scrollTo(0, 0));
		await expect(nav).not.toHaveAttribute('data-stuck', /.*/);
		await expect(nav).toBeHidden();

		// 글자 크기 버튼(가 가)의 배율이 목차에도 걸린다
		const toc = block(memo).nav;
		const before = (await box(toc)).height;
		await memo.getByRole('button', { name: '글자 크게' }).click();
		await expect.poll(async () => (await box(toc)).height).toBeGreaterThan(before * 1.1);
		// 배율이 걸려도 본문 칸이 가로로 넘치지 않는다 (막대 바탕을 좌우 여백까지 넓힌 만큼)
		expect(await scroller.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
	});

	test('목록 버튼을 누르면 모든 제목을 펼친다: 읽는 제목에 초점, ↑·↓로 옮기고, 고르면 그 제목으로 가서 닫힌다', async ({
		page,
	}) => {
		await fakeApi(page, { signedIn: false });
		await enterDesktop(page, '/memo/merge-strategies');
		const memo = appWindow(page, 'memo');
		const { nav, toggle, list, section } = bar(memo);
		const body = memo.locator('.memo-reader-body .memo-markdown');
		const scroller = memo.locator('.memo-reader .memo-scroll');
		const headings = await headingTexts(body);
		const sections = await expectedSections(body);
		await expect(list).toHaveCount(0);

		// 둘째 절의 머리를 읽는 중에 펼친다
		await body
			.locator(':scope > h2', { hasText: sections[1] })
			.first()
			.evaluate((el) => el.scrollIntoView({ block: 'start' }));
		await expect(section).toHaveText(sections[1]);
		const scrolled = await scroller.evaluate((el) => el.scrollTop);
		await press(toggle);
		await expect(toggle).toHaveAttribute('aria-expanded', 'true');
		// 펼쳐도 본문은 움직이지 않는다
		expect(await scroller.evaluate((el) => el.scrollTop)).toBe(scrolled);
		// ## · ### 모든 제목, ###는 들여 쓴다
		const items = list.locator('button');
		await expect(items).toHaveText(headings);
		const levels = await list.locator('li').evaluateAll((els) => els.map((el) => el.getAttribute('data-level')));
		expect(levels).toContain('3');
		const h2x = (await box(list.locator('li[data-level="2"] button').first())).x;
		const h3pad = await list
			.locator('li[data-level="3"] button')
			.first()
			.evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));
		const h2pad = await list
			.locator('li[data-level="2"] button')
			.first()
			.evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));
		expect(h3pad).toBeGreaterThan(h2pad);
		expect(h2x).toBeGreaterThan(0);
		// 읽는 제목에 초점과 표시
		const current = list.locator('[aria-current="location"]');
		await expect(current).toHaveText(sections[1]);
		await expect(current).toBeFocused();
		await page.keyboard.press('ArrowDown');
		await expect(items.nth(headings.indexOf(sections[1]) + 1)).toBeFocused();
		await page.keyboard.press('ArrowUp');
		await expect(current).toBeFocused();
		// Esc: 닫고 목록 버튼으로 초점을 돌린다
		await page.keyboard.press('Escape');
		await expect(list).toHaveCount(0);
		await expect(toggle).toBeFocused();
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		// 바깥(본문 칸 왼쪽 아래)을 누르면 닫힌다
		await toggle.press('Enter');
		await expect(list).toBeVisible();
		const area = await box(scroller);
		await page.mouse.click(area.x + 12, area.y + area.height - 12);
		await expect(list).toHaveCount(0);

		// 제목을 고르면 그 제목으로 가고 닫힌다
		await toggle.press('Enter');
		const target = headings[headings.length - 1];
		await list.getByRole('button', { name: target, exact: true }).click();
		await expect(list).toHaveCount(0);
		const heading = body.locator(':scope > :is(h2, h3, h4)', { hasText: target }).last();
		await expect(heading).toBeInViewport();
		await expect(heading).toBeFocused();
		await expect(nav).toHaveAttribute('data-stuck', 'true');
	});

	test('이전·다음은 마우스를 올리면 절 이름까지 펼치고, 좁은 창에서도 한 줄을 지키며 긴 제목은 말줄임표로 자른다', async ({
		page,
	}) => {
		await fakeApi(page, { signedIn: false });
		await page.setViewportSize({ width: 1000, height: 800 });
		await enterDesktop(page, '/memo/merge-strategies');
		const memo = appWindow(page, 'memo');
		const { nav, next } = bar(memo);
		const sections = await expectedSections(memo.locator('.memo-reader-body .memo-markdown'));
		await jumpFromBlock(memo, sections[0]);
		await expect(nav).toHaveAttribute('data-stuck', 'true');
		expect((await box(nav)).height).toBeLessThan(56);
		const text = next.locator('.memo-toc-bar-step-text');
		expect(await text.evaluate((el) => [getComputedStyle(el).textOverflow, getComputedStyle(el).whiteSpace])).toEqual([
			'ellipsis',
			'nowrap',
		]);
		// 이전·다음은 평소에 화살표만, 마우스를 올리면 그 절 이름까지 펼친다
		const width = () => text.evaluate((el) => el.getBoundingClientRect().width);
		await page.mouse.move(0, 0);
		await expect.poll(width).toBeLessThan(1);
		const arrow = await box(next);
		await page.mouse.move(arrow.x + arrow.width - 8, arrow.y + arrow.height / 2);
		await expect.poll(width).toBeGreaterThan(40);
		await expect(text).toHaveCSS('opacity', '1');
		// 펼쳐도 한 줄 그대로다
		expect((await box(nav)).height).toBeLessThan(56);
		const scroller = memo.locator('.memo-reader .memo-scroll');
		expect(await scroller.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
	});

	test('편집 화면에도 목차 블록·막대와 글자 크기 버튼이 있다. 블록에서 고르면 그 제목에 커서를 두고, 키운 글자에서도 누른 자리에 입력된다', async ({
		page,
	}) => {
		await fakeApi(page, { signedIn: true });
		await enterDesktop(page, '/memo/merge-strategies');
		const memo = appWindow(page, 'memo');
		const editor = memo.locator('.ProseMirror');
		await expect(editor).toBeVisible();
		const { nav, toggle, list, section } = bar(memo);
		const expected = (await editor.locator(':scope > h2').allTextContents()).map((text) => text.trim());

		const target = expected[2];
		await jumpFromBlock(memo, target);
		const heading = editor.locator(':scope > h2', { hasText: target }).first();
		await expect(heading).toBeInViewport();
		await expect(editor).toBeFocused();
		expect(await heading.evaluate((el) => el.contains(document.getSelection()?.anchorNode ?? null))).toBe(true);
		// 편집 화면에서도 스크롤 칸 위에 붙고, 지금 읽는 절을 표시한다
		await expect(nav).toHaveAttribute('data-stuck', 'true');
		await expect(section).toHaveText(target);

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
		await press(toggle);
		await expect(list.getByRole('button', { name: '새로 쓴 절', exact: true })).toBeVisible();
		await page.keyboard.press('Escape');

		// 글자 크기: 편집기 본문도 같은 배율로 키운다
		await memo.getByRole('button', { name: '글자 크게' }).click();
		expect(await editor.evaluate((el) => getComputedStyle(el).zoom)).toBe('1.15');
		expect(await nav.evaluate((el) => getComputedStyle(el).zoom)).toBe('1.15');
		expect(await block(memo).nav.evaluate((el) => getComputedStyle(el).zoom)).toBe('1.15');
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
		await expect(memo.getByRole('navigation', { name: /^목차/ })).toHaveCount(0);
	});

	test('#### 제목도 목차에 들어가고, 막대에는 읽는 자리까지의 하위 제목 경로(## › ### › ####)를 보인다', async ({
		page,
	}) => {
		const api = await fakeApi(page, { signedIn: false });
		const filler = '글.\n\n'.repeat(30);
		const content = {
			title: '깊은 제목의 글',
			date: '2026-10-27',
			category: '개발기/MacFolio',
			summary: '',
			body:
				'머리말.\n\n'.repeat(5) +
				`## 하나\n\n${filler}### 가\n\n${filler}#### 가-1\n\n${filler}#### 가-2\n\n${filler}### 나\n\n${filler}## 둘\n\n${filler}`,
		};
		api.posts = [{ slug: 'deep-post', ...content, deleted: false, published: content }];
		await enterDesktop(page, '/memo/deep-post');
		const memo = appWindow(page, 'memo');
		const { section, sub, toggle, list } = bar(memo);
		// 목차 블록: #### 는 한 단계 더 들여 쓴다
		await block(memo).toggle.click();
		await expect(block(memo).items).toHaveText(['하나', '가', '가-1', '가-2', '나', '둘']);
		const pad = (name: string) =>
			block(memo)
				.nav.getByRole('button', { name, exact: true })
				.evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));
		expect(await pad('가-1')).toBeGreaterThan(await pad('가'));

		await jumpFromBlock(memo, '가-2');
		await expect(section).toHaveText('하나');
		// 같은 단계의 앞 제목(가-1)은 넣지 않고, 부모(가)와 지금 제목(가-2)만
		await expect(sub).toHaveText(['가', '가-2']);
		await jumpFromBlock(memo, '나');
		await expect(sub).toHaveText(['나']);
		// 펼친 목록에도 #### 가 들여 쓴 채 들어간다
		await press(toggle);
		await expect(list.locator('li[data-level="4"] button')).toHaveText(['가-1', '가-2']);
		await page.keyboard.press('Escape');
	});

	test('경로의 제목에 마우스를 올리면 그 하위 제목을, 맨 끝(지금 읽는) 제목은 같은 계층의 제목을 펼친다. 고르면 그 제목으로 간다', async ({
		page,
	}) => {
		const api = await fakeApi(page, { signedIn: false });
		const filler = '글.\n\n'.repeat(30);
		const content = {
			title: '깊은 제목의 글',
			date: '2026-10-27',
			category: '개발기/MacFolio',
			summary: '',
			body:
				'머리말.\n\n'.repeat(5) +
				`## 하나\n\n${filler}### 가\n\n${filler}#### 가-1\n\n${filler}#### 가-2\n\n${filler}### 나\n\n${filler}## 둘\n\n${filler}`,
		};
		api.posts = [{ slug: 'deep-post', ...content, deleted: false, published: content }];
		await enterDesktop(page, '/memo/deep-post');
		const memo = appWindow(page, 'memo');
		const { nav, section, sub } = bar(memo);
		const body = memo.locator('.memo-reader-body .memo-markdown');
		await jumpFromBlock(memo, '가-1');
		await expect(sub).toHaveText(['가', '가-1']);
		const peek = nav.locator('.memo-toc-bar-peek');
		const hover = async (crumb: Locator) => {
			const rect = await box(crumb);
			await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
		};

		// 절 이름: 그 절의 ### 들
		await hover(section);
		await expect(peek.locator('button')).toHaveText(['가', '나']);
		await expect(section).toHaveAttribute('aria-expanded', 'true');
		// 경로에 있는 제목은 표시한다
		await expect(peek.locator('[aria-current="location"]')).toHaveText('가');
		// ### : 그 아래 #### 들
		await hover(sub.first());
		await expect(peek.locator('button')).toHaveText(['가-1', '가-2']);
		// 맨 끝 (지금 읽는 ####): 같은 계층의 #### 들, 들여 쓰지 않는다
		await hover(sub.last());
		await expect(peek.locator('button')).toHaveText(['가-1', '가-2']);
		const pads = await peek.locator('button').evaluateAll((els) => els.map((el) => getComputedStyle(el).paddingLeft));
		expect(new Set(pads).size).toBe(1);
		// 목록으로 마우스를 옮겨도 닫히지 않고, 고르면 그 제목으로 가서 닫힌다
		await hover(peek.getByRole('button', { name: '가-2', exact: true }));
		await expect(peek).toBeVisible();
		await peek.getByRole('button', { name: '가-2', exact: true }).click();
		await expect(peek).toHaveCount(0);
		await expect(body.locator(':scope > h4', { hasText: '가-2' })).toBeInViewport();
		await expect(sub).toHaveText(['가', '가-2']);
		// 마우스가 떠나면 닫힌다
		await hover(section);
		await expect(peek).toBeVisible();
		await page.mouse.move(10, 600);
		await expect(peek).toHaveCount(0);
		// 경로의 제목을 누르면 그 제목으로 간다
		await press(section);
		await expect(body.locator(':scope > h2', { hasText: '하나' })).toBeInViewport();
		await expect(sub).toHaveCount(0);
		// 맨 위 절의 같은 계층: 모든 절
		await hover(section);
		await expect(peek.locator('button')).toHaveText(['하나', '둘']);
	});

	test('## 제목이 둘 미만이면 ### 제목까지 모두 절로 오간다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: false });
		const content = {
			title: '작은 절의 글',
			date: '2026-10-27',
			category: '개발기/MacFolio',
			summary: '',
			// 막대가 붙을 만큼 길게 (머리말과 절마다 문단 30개)
			body:
				'머리말.\n\n'.repeat(5) +
				['하나', '가', '나']
					.map((name, index) => `${index ? '###' : '##'} ${name}\n\n${'글.\n\n'.repeat(30)}`)
					.join(''),
		};
		api.posts = [{ slug: 'sub-post', ...content, deleted: false, published: content }];
		await enterDesktop(page, '/memo/sub-post');
		const memo = appWindow(page, 'memo');
		const { next, section } = bar(memo);
		await expect(block(memo).items).toHaveText(['하나', '가', '나']);
		await jumpFromBlock(memo, '하나');
		await expect(section).toHaveText('하나');
		await expect(next).toHaveAccessibleName('다음 절: 가');
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
