import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './index';
import { ogCardVersion } from '../seo/site';
import { clearSeoPostsCache, type SeoPost } from './seo';
import {
	clearServerPostsCache,
	fetchServerPosts,
	firstPhoto,
	mergeServerPosts,
	plainHtml,
	SERVER_POSTS_CACHE_MS,
	type ServerPost,
} from './serverPosts';
import { clearSiteContentCache } from './siteHtml';

const repoPost = (slug: string, date: string): SeoPost => ({
	slug,
	title: slug,
	date,
	summary: '',
	category: '',
	tags: [],
	html: '<p>저장소</p>',
});
const serverPost = (slug: string, patch: Partial<ServerPost> = {}): ServerPost => ({
	slug,
	title: `서버 ${slug}`,
	date: '2026-10-10',
	category: '개발기',
	summary: '서버 요약',
	body: '## 제목\n\n첫 문단 <b>\n둘째 줄\n\n![그림](/a.png)\n\n#MacFolio #SEO',
	deleted: false,
	...patch,
});

afterEach(() => {
	clearServerPostsCache();
	clearSeoPostsCache();
	clearSiteContentCache();
	vi.unstubAllGlobals();
});

describe('서버에 쓴 글', () => {
	it('같은 주소는 서버 글로 바꾸고, 지운 글은 빼고, 새 글은 더한다 (최신 글이 앞)', () => {
		const merged = mergeServerPosts(
			[repoPost('edited', '2026-09-01'), repoPost('gone', '2026-09-02'), repoPost('kept', '2026-09-03')],
			[serverPost('edited'), serverPost('gone', { deleted: true }), serverPost('new', { date: '2026-10-11' })]
		);
		expect(merged.map((post) => post.slug)).toEqual(['new', 'edited', 'kept']);
		expect(merged[1]).toMatchObject({ title: '서버 edited', date: '2026-10-10', tags: ['MacFolio', 'SEO'] });
	});

	it('본문은 제목·문단만 HTML로 바꾸고, 글자는 이스케이프하고, 그림과 해시태그 줄은 뺀다', () => {
		expect(plainHtml(serverPost('a').body)).toBe('<h2>제목</h2><p>첫 문단 &lt;b&gt;<br>둘째 줄</p>');
	});

	it('공유 그림: 본문의 첫 사진(올린 파일·사진 주소), 없으면 API가 그리는 카드. API 주소를 모르면 넣지 않는다', () => {
		const API = 'https://api.test';
		expect(firstPhoto(`![흐름](https://x.test/a.svg) ![화면](${API}/files/abc)`, API)).toBe(`${API}/files/abc`);
		expect(firstPhoto('![흐름](/a.png) ![사진](https://x.test/b.JPG?w=1)', API)).toBe('https://x.test/b.JPG?w=1');
		expect(firstPhoto('![흐름](https://x.test/a.svg)', API)).toBeUndefined();

		const [withPhoto, withoutPhoto] = mergeServerPosts(
			[],
			[
				serverPost('photo', { date: '2026-10-12', body: `![화면](${API}/files/abc)` }),
				serverPost('card', { title: '제목 <b>&' }),
			],
			API
		);
		expect(withPhoto.image).toBe(`${API}/files/abc`);
		expect(withoutPhoto.image).toBe(`${API}/posts/card/og.png?v=${ogCardVersion(withoutPhoto)}`);
		expect(mergeServerPosts([], [serverPost('card')])[0]).not.toHaveProperty('image');
	});

	it('API 목록을 잠시 기억하고, 닿지 않으면 null', async () => {
		const ok = vi.fn(async () => Response.json([serverPost('a'), { slug: 1 }]));
		await expect(fetchServerPosts('https://api.test', ok, 0)).resolves.toHaveLength(1);
		await fetchServerPosts('https://api.test', ok, SERVER_POSTS_CACHE_MS - 1);
		expect(ok).toHaveBeenCalledTimes(1);
		clearServerPostsCache();
		const down = vi.fn(async () => new Response('', { status: 500 }));
		await expect(fetchServerPosts('https://api.test', down, 0)).resolves.toBeNull();
	});

	it('sitemap.xml에 저장소 글과 서버에 쓴 글이 함께 들어가고, 지운 글은 빠진다', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: string) =>
				input.endsWith('/posts')
					? Response.json([serverPost('server-only'), serverPost('gone', { deleted: true })])
					: Response.json({})
			)
		);
		const assets = {
			fetch: vi.fn(async () => Response.json([repoPost('repo', '2026-09-01'), repoPost('gone', '2026-09-02')])),
		};
		const response = await worker.fetch(new Request('https://macfolio.hyeoniverse.com/sitemap.xml'), {
			ASSETS: assets,
			API_URL: 'https://api.test',
		});
		expect(response.headers.get('content-type')).toContain('application/xml');
		const xml = await response.text();
		expect(xml).toContain('<loc>https://macfolio.hyeoniverse.com/memo/server-only</loc><lastmod>2026-10-10</lastmod>');
		expect(xml).toContain('/memo/repo</loc>');
		expect(xml).not.toContain('/memo/gone');
		expect(xml).toContain('/safari/');
	});

	it('서버에만 있는 글 주소도 그 글의 제목과 본문을 넣는다 (noindex가 아니다)', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: string) =>
				input.endsWith('/posts') ? Response.json([serverPost('server-only')]) : Response.json({})
			)
		);
		const assets = {
			fetch: vi.fn(async (input: Request | URL | string) =>
				String(input).endsWith('/seo/posts.json')
					? Response.json([])
					: new Response('<html><head><title>x</title></head><body><div id="root"></div></body></html>')
			),
		};
		const html = await (
			await worker.fetch(new Request('https://macfolio.hyeoniverse.com/memo/server-only'), {
				ASSETS: assets,
				API_URL: 'https://api.test',
			})
		).text();
		expect(html).toContain('<title>서버 server-only');
		expect(html).toContain('<h2>제목</h2>');
		expect(html).not.toContain('noindex');
	});
});
