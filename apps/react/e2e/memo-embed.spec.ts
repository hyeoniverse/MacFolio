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

	for (const admin of [false, true])
		test(`영상·음악 파일: 주소만 적은 영상 주소와 올린 음악 파일을 재생기로 그린다 (${admin ? '편집 화면' : '읽기 화면'})`, async ({
			page,
		}) => {
			const blocked: string[] = [];
			page.on('console', (message) => {
				if (/Content Security Policy|Refused to load media/i.test(message.text())) blocked.push(message.text());
			});
			// 파일 응답은 가짜로 (재생기가 요청만 하면 된다)
			await page.route(/^https:\/\/(media\.example\.com|api\.example\.com)\//, (route) =>
				route.fulfill({ status: 200, contentType: 'application/octet-stream', body: '' })
			);
			const api = await fakeApi(page, { signedIn: admin });
			const body = [
				'https://media.example.com/clips/demo.mp4',
				'[노래.mp3](https://api.example.com/files/abc123 "첨부 파일 · 3.2 MB")',
				'문장 속 파일 https://media.example.com/clips/demo.mp4 은 링크다.',
			].join('\n\n');
			const content = { title: '재생기', date: '2026-10-30', category: '기타', summary: '', body };
			api.posts.push({ slug: 'media-demo', ...content, published: content, deleted: false });
			await enterDesktop(page, '/memo/media-demo');
			const memo = appWindow(page, 'memo');
			const video = memo.locator('.memo-media[data-kind="video"] video');
			const audio = memo.locator('.memo-media[data-kind="audio"] audio');
			await expect(video).toHaveAttribute('src', 'https://media.example.com/clips/demo.mp4');
			await expect(video).toHaveAttribute('controls', '');
			await expect(audio).toHaveAttribute('src', 'https://api.example.com/files/abc123');
			await expect(memo.locator('.memo-media')).toHaveCount(2);
			// 캡션: 파일 이름 링크 (올린 파일은 첨부 파일 제목 그대로)
			await expect(memo.locator('.memo-media[data-kind="video"] figcaption a')).toHaveText('demo.mp4');
			await expect(memo.locator('.memo-media[data-kind="audio"] figcaption a')).toHaveAttribute(
				'title',
				'첨부 파일 · 3.2 MB'
			);
			if (admin) {
				// 편집기: 원래 링크 문단은 숨기고, 재생기에는 주소 바꾸기·삭제만 (링크로 바꾸기는 없다)
				await expect(memo.locator('.ProseMirror p.memo-embed-source')).toHaveCount(2);
				const figure = memo.locator('.memo-media[data-kind="audio"]');
				await figure.hover();
				await expect(figure.getByRole('button')).toHaveText(['', '']);
				await expect(figure.getByRole('button', { name: '주소 바꾸기' })).toBeVisible();
				await expect(figure.getByRole('button', { name: '링크로 바꾸기' })).toHaveCount(0);
				// 버튼은 재생기 자체 버튼(아래 조작 막대)과 겹치지 않게: 영상은 위쪽 줄의 Safari 전체 화면·PiP 버튼 오른쪽, 음악은 재생 막대 아래 왼쪽
				const video = memo.locator('.memo-media[data-kind="video"]');
				await video.hover();
				const frame = (await video.locator('video').boundingBox())!;
				const videoTools = (await video.locator('.memo-embed-tools').boundingBox())!;
				// Safari 재생기의 위쪽 줄에서 전체 화면·PiP 버튼(왼쪽 6px부터 약 70px) 오른쪽
				expect(videoTools.y - frame.y).toBeLessThan(12);
				expect(videoTools.x - frame.x).toBeGreaterThanOrEqual(80);
				expect(videoTools.x - frame.x).toBeLessThan(100);
				const music = memo.locator('.memo-media[data-kind="audio"]');
				await music.hover();
				const bar = (await music.locator('audio').boundingBox())!;
				const musicTools = (await music.locator('.memo-embed-tools').boundingBox())!;
				expect(musicTools.y).toBeGreaterThanOrEqual(bar.y + bar.height - 1);
				expect(musicTools.x - bar.x).toBeLessThan(2);
				// 원래 링크 문단이 보이는 동안(주소 바꾸기)은 아래 캡션을 숨겨 첨부 파일 배지가 한 곳에만 보인다
				await figure.hover();
				await figure.getByRole('button', { name: '주소 바꾸기' }).click();
				await expect(memo.locator('.ProseMirror p.memo-embed-source[data-editing]')).toBeVisible();
				await expect(figure.locator('figcaption')).toBeHidden();
				await figure.hover();
				await figure.getByRole('button', { name: '임베드 삭제' }).click();
				await expect(memo.locator('.memo-media')).toHaveCount(1);
			}
			expect(blocked).toEqual([]);
		});

	test('편집기: 글을 열기만 해서는 고치지 않는다 (표 칸 안·코드 글자의 주소는 링크로 바꾸지 않는다)', async ({
		page,
	}) => {
		const api = await fakeApi(page, { signedIn: true });
		const body = [
			'| 링크 | 예 |',
			'| --- | --- |',
			'| 바깥 파일 | `https://example.com/clips/demo.mp4` |',
			'| 영상 | https://www.youtube.com/watch?v=nYkdrAPrdcw |',
			'',
			'`https://example.com/clips/demo.mp4`',
		].join('\n');
		const content = { title: '표 속 주소', date: '2026-10-30', category: '기타', summary: '', body };
		api.posts.push({ slug: 'table-urls', ...content, published: content, deleted: false });
		await enterDesktop(page, '/memo/table-urls');
		const memo = appWindow(page, 'memo');
		await expect(memo.locator('.ProseMirror table')).toBeVisible();
		await page.waitForTimeout(1500);
		expect(api.postSaves).toBe(0);
		// 표 칸 안에는 재생기를 넣지 않는다
		await expect(memo.locator('.ProseMirror table :is(.memo-embed, .memo-media)')).toHaveCount(0);
	});
});
