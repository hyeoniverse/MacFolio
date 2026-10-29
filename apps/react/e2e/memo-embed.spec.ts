import { test, expect, enterDesktop, appWindow } from './fixtures';
import { fakeApi } from './fakeApi';

// Flux 글은 F8 2014 발표 영상 주소를 한 줄로 적었다 (memo/content/flux-pattern.md)
const VIDEO = 'https://www.youtube.com/watch?v=nYkdrAPrdcw';
const EMBED = 'https://www.youtube-nocookie.com/embed/nYkdrAPrdcw';

test.describe('메모 바깥 링크 임베드', () => {
	test('읽기 화면: 주소만 한 줄로 적은 YouTube 링크를 iframe으로 그리고, CSP가 막지 않는다', async ({ page }) => {
		const blocked: string[] = [];
		page.on('console', (message) => {
			if (/Content Security Policy|Refused to frame/i.test(message.text())) blocked.push(message.text());
		});
		await enterDesktop(page, '/memo/flux-pattern');
		const memo = appWindow(page, 'memo');
		const figure = memo.locator('.memo-embed[data-provider="youtube"]');
		await figure.scrollIntoViewIfNeeded();
		const frame = figure.locator('iframe');
		await expect(frame).toHaveAttribute('src', EMBED);
		await expect(frame).toHaveAttribute('title', 'YouTube 임베드');
		await expect(frame).toHaveAttribute('loading', 'lazy');
		// 원래 주소로 가는 링크를 아래에 둔다
		await expect(figure.getByRole('link', { name: 'YouTube에서 열기' })).toHaveAttribute('href', VIDEO);
		// 16:9 비율
		const box = (await figure.locator('.memo-embed-frame').boundingBox())!;
		expect(box.width / box.height).toBeCloseTo(16 / 9, 1);
		// 문장 속 바깥 링크(Flux 블로그 글 등)는 그대로 링크다
		await expect(memo.locator('.memo-embed')).toHaveCount(1);
		expect(blocked.filter((text) => /youtube/i.test(text))).toEqual([]);
	});

	test('편집기: 주소 문단 아래에 같은 임베드를 보이고, 다른 곳에 글자를 써도 iframe을 다시 불러오지 않는다', async ({
		page,
	}) => {
		await fakeApi(page, { signedIn: true });
		await enterDesktop(page, '/memo/flux-pattern');
		const memo = appWindow(page, 'memo');
		const editor = memo.locator('.ProseMirror');
		const frame = editor.locator('.memo-embed iframe');
		await frame.scrollIntoViewIfNeeded();
		await expect(frame).toHaveAttribute('src', EMBED);
		// 주소 문단은 편집할 수 있는 링크로 남는다
		await expect(editor.getByRole('link', { name: VIDEO })).toBeVisible();

		await frame.evaluate((el) => (el.dataset.mark = 'same'));
		await editor.locator('> p').first().click();
		await page.keyboard.type('추가');
		await expect(frame).toHaveAttribute('data-mark', 'same');
	});

	test('편집기: 지원 사이트 주소를 입력하면 임베드가 붙고, 주소 글자를 바꾸면 링크·임베드·저장한 글이 새 주소를 따른다', async ({
		page,
	}) => {
		const api = await fakeApi(page, { signedIn: true });
		await enterDesktop(page, '/memo/flux-pattern');
		const memo = appWindow(page, 'memo');
		const editor = memo.locator('.ProseMirror');
		const urlParagraph = editor.locator('p', { has: page.getByRole('link', { name: VIDEO }) });
		await urlParagraph.scrollIntoViewIfNeeded();

		// 주소 문단 끝에서 Enter로 새 문단을 만들고 Vimeo 주소를 직접 입력한다
		const box = (await urlParagraph.boundingBox())!;
		await page.mouse.click(box.x + box.width - 2, box.y + box.height / 2);
		await page.keyboard.press('End');
		await page.keyboard.press('Enter');
		await page.keyboard.type('https://vimeo.com/76979871');
		await expect(editor.locator('.memo-embed iframe[src="https://player.vimeo.com/video/76979871"]')).toHaveCount(1);
		await expect(editor.getByRole('link', { name: 'https://vimeo.com/76979871' })).toHaveAttribute(
			'href',
			'https://vimeo.com/76979871'
		);

		// YouTube 주소 글자를 통째로 다른 영상 주소로 바꾼다
		// (Vimeo 문단을 더해 화면이 스크롤되었으므로 문단을 다시 찾아 세 번 눌러 문단 전체를 고른다)
		await urlParagraph.click({ clickCount: 3 });
		await page.keyboard.type('https://youtu.be/dQw4w9WgXcQ');
		await expect(editor.getByRole('link', { name: 'https://youtu.be/dQw4w9WgXcQ' })).toHaveAttribute(
			'href',
			'https://youtu.be/dQw4w9WgXcQ'
		);
		await expect(
			editor.locator('.memo-embed iframe[src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"]')
		).toHaveCount(1);
		await expect(editor.locator(`.memo-embed iframe[src="${EMBED}"]`)).toHaveCount(0);

		// 임시 저장한 글에도 새 주소가 링크 글자와 대상 모두로 들어간다 (읽기 화면이 임베드로 그릴 수 있는 형태)
		await expect
			.poll(() => api.posts.find((post) => post.slug === 'flux-pattern')?.draft?.body ?? '')
			.toMatch(/^<?https:\/\/youtu\.be\/dQw4w9WgXcQ>?$/m);
		const body = api.posts.find((post) => post.slug === 'flux-pattern')!.draft!.body;
		expect(body).not.toContain('nYkdrAPrdcw');
		expect(body).toMatch(/^<?https:\/\/vimeo\.com\/76979871>?$/m);
	});
});
