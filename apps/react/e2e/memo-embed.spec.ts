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
});
