import { test, expect, enterDesktop, appWindow } from './fixtures';
import { fakeApi } from './fakeApi';

// Flux 글은 F8 2014 발표 영상 주소를 Flux 장(10분 20초)부터 재생하도록 한 줄로 적었다 (memo/content/flux-pattern.md)
const VIDEO = 'https://www.youtube.com/watch?v=nYkdrAPrdcw&t=620';
const EMBED = 'https://www.youtube-nocookie.com/embed/nYkdrAPrdcw?start=620';

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

	test('편집기: 주소 문단은 숨기고 읽기 화면과 같은 임베드만 보이며, 다른 곳에 글자를 써도 iframe을 다시 불러오지 않는다', async ({
		page,
	}) => {
		await fakeApi(page, { signedIn: true });
		await enterDesktop(page, '/memo/flux-pattern');
		const memo = appWindow(page, 'memo');
		const editor = memo.locator('.ProseMirror');
		const frame = editor.locator('.memo-embed iframe');
		await frame.scrollIntoViewIfNeeded();
		await expect(frame).toHaveAttribute('src', EMBED);
		const source = editor.locator('p.memo-embed-source');
		await expect(source).not.toHaveAttribute('data-editing');
		expect((await source.boundingBox())?.height).toBe(0);
		await expect(editor.locator('.memo-embed').getByRole('link', { name: 'YouTube에서 열기' })).toHaveAttribute(
			'href',
			VIDEO
		);

		await frame.evaluate((el) => (el.dataset.mark = 'same'));
		await editor.locator('> p').first().click();
		await page.keyboard.type('추가');
		await expect(frame).toHaveAttribute('data-mark', 'same');
	});

	test('편집기: 위·아래 화살표로 숨긴 주소 문단에 들어가면 주소가 보이고, 나오면 다시 숨는다', async ({ page }) => {
		await fakeApi(page, { signedIn: true });
		await enterDesktop(page, '/memo/flux-pattern');
		const memo = appWindow(page, 'memo');
		const editor = memo.locator('.ProseMirror');
		const source = editor.locator('p.memo-embed-source');
		// 주소 문단 바로 위 문단의 끝에서 아래로
		const above = source.locator('xpath=preceding-sibling::p[1]');
		await above.scrollIntoViewIfNeeded();
		await above.click();
		await page.keyboard.press('End');
		for (let i = 0; i < 6 && !(await source.getAttribute('data-editing')); i++) await page.keyboard.press('ArrowDown');
		await expect(source).toHaveAttribute('data-editing', 'true');
		await expect(editor.getByRole('link', { name: VIDEO })).toBeVisible();
		// 다시 위로 나오면 숨는다
		await page.keyboard.press('ArrowUp');
		await expect(source).not.toHaveAttribute('data-editing');
		// 아래 문단의 첫 줄에서 위로 들어가면 주소 끝에 커서가 있다
		const below = source.locator('xpath=following-sibling::*[not(contains(@class, "memo-embed"))][1]');
		await below.click();
		await page.keyboard.press('Home');
		for (let i = 0; i < 6 && !(await source.getAttribute('data-editing')); i++) await page.keyboard.press('ArrowUp');
		await expect(source).toHaveAttribute('data-editing', 'true');
	});

	test('편집기 도구 버튼: 주소 바꾸기로 다른 영상, 직접 입력한 주소도 임베드, 링크로 바꾸기·삭제, 저장한 글이 따른다', async ({
		page,
	}) => {
		const api = await fakeApi(page, { signedIn: true });
		await enterDesktop(page, '/memo/flux-pattern');
		const memo = appWindow(page, 'memo');
		const editor = memo.locator('.ProseMirror');
		const youtube = editor.locator('.memo-embed[data-provider="youtube"]');
		await youtube.scrollIntoViewIfNeeded();

		// 주소 바꾸기: 숨긴 주소 문단이 보이고 주소 전체가 골라진다. 새 주소를 입력하면 링크·임베드가 바뀐다
		await youtube.hover();
		await youtube.getByRole('button', { name: '주소 바꾸기' }).click();
		await expect(editor.locator('p.memo-embed-source[data-editing]')).toBeVisible();
		await page.keyboard.type('https://youtu.be/dQw4w9WgXcQ');
		await expect(editor.getByRole('link', { name: 'https://youtu.be/dQw4w9WgXcQ' })).toHaveAttribute(
			'href',
			'https://youtu.be/dQw4w9WgXcQ'
		);
		await expect(youtube.locator('iframe')).toHaveAttribute(
			'src',
			'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
		);

		// 그 아래에 Vimeo 주소를 직접 입력하면 링크와 임베드가 붙는다
		await page.keyboard.press('Enter');
		await page.keyboard.type('https://vimeo.com/76979871');
		const vimeo = editor.locator('.memo-embed[data-provider="vimeo"]');
		await expect(vimeo.locator('iframe')).toHaveAttribute('src', 'https://player.vimeo.com/video/76979871');

		await expect
			.poll(() => api.posts.find((post) => post.slug === 'flux-pattern')?.draft?.body ?? '')
			.toMatch(/^<?https:\/\/youtu\.be\/dQw4w9WgXcQ>?$/m);
		let body = api.posts.find((post) => post.slug === 'flux-pattern')!.draft!.body;
		expect(body).not.toContain('nYkdrAPrdcw');
		expect(body).toMatch(/^<?https:\/\/vimeo\.com\/76979871>?$/m);

		// 링크로 바꾸기: 임베드가 사라지고 https:// 를 뺀 글자의 링크로 남는다
		await vimeo.hover();
		await vimeo.getByRole('button', { name: '링크로 바꾸기' }).click();
		await expect(vimeo).toHaveCount(0);
		await expect(editor.getByRole('link', { name: 'vimeo.com/76979871', exact: true })).toHaveAttribute(
			'href',
			'https://vimeo.com/76979871'
		);

		// 임베드 삭제: 주소 문단째 지운다
		await youtube.hover();
		await youtube.getByRole('button', { name: '임베드 삭제' }).click();
		await expect(youtube).toHaveCount(0);
		await expect
			.poll(() => api.posts.find((post) => post.slug === 'flux-pattern')?.draft?.body ?? '')
			.not.toContain('youtu.be/dQw4w9WgXcQ');
		body = api.posts.find((post) => post.slug === 'flux-pattern')!.draft!.body;
		expect(body).toContain('[vimeo.com/76979871](https://vimeo.com/76979871)');
	});

	test('읽기 화면: SoundCloud·Twitch·TikTok·Apple Music도 임베드하고, Twitch에는 이 사이트 도메인을 parent로 넘긴다', async ({
		page,
	}) => {
		const blocked: string[] = [];
		page.on('console', (message) => {
			if (/Content Security Policy|Refused to frame/i.test(message.text())) blocked.push(message.text());
		});
		// 바깥 재생기는 불러오지 않는다 (네트워크·재생기 안의 오류에 시험이 흔들리지 않게). CSP 검사는 요청 전에 일어나므로 그대로 확인된다
		await page.route(
			/^https:\/\/(w\.soundcloud\.com|player\.twitch\.tv|www\.tiktok\.com|embed\.music\.apple\.com)\//,
			(route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>embed</title>' })
		);
		const api = await fakeApi(page);
		const body = [
			'https://soundcloud.com/forss/flickermood',
			'https://www.twitch.tv/twitch',
			'https://www.tiktok.com/@scout2015/video/6718335390845095173',
			'https://music.apple.com/us/album/1989-taylors-version/1708308989',
		].join('\n\n');
		const content = { title: '임베드 사이트', date: '2026-10-30', category: '기타', summary: '', body };
		api.posts.push({ slug: 'embed-sites', ...content, published: content, deleted: false });
		await enterDesktop(page, '/memo/embed-sites');
		const memo = appWindow(page, 'memo');
		const frames = memo.locator('.memo-embed iframe');
		await expect(frames).toHaveCount(4);
		const host = new URL(page.url()).hostname;
		await expect(memo.locator('.memo-embed[data-provider="soundcloud"] iframe')).toHaveAttribute(
			'src',
			/^https:\/\/w\.soundcloud\.com\/player\/\?url=https%3A%2F%2Fsoundcloud\.com%2Fforss%2Fflickermood/
		);
		await expect(memo.locator('.memo-embed[data-provider="twitch"] iframe')).toHaveAttribute(
			'src',
			`https://player.twitch.tv/?channel=twitch&parent=${host}&autoplay=false`
		);
		// 세로 영상은 최대 폭(340px)으로 가운데에
		const tiktok = memo.locator('.memo-embed[data-provider="tiktok"] .memo-embed-frame');
		expect((await tiktok.boundingBox())!.width).toBeLessThanOrEqual(340);
		await expect(memo.locator('.memo-embed[data-provider="applemusic"] iframe')).toHaveAttribute(
			'src',
			'https://embed.music.apple.com/us/album/1989-taylors-version/1708308989'
		);
		for (let i = 0; i < 4; i++) await frames.nth(i).scrollIntoViewIfNeeded();
		await page.waitForTimeout(1000);
		expect(blocked).toEqual([]);
	});
});
