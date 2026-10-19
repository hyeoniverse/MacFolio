import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PROJECTS, PROFILE } from '../src/shared/profile';
import worker from './index';
import { applySeo, clearSeoPostsCache, escapeHtml, fetchSeoPosts, seoPage, siteDataOf, type SeoPost } from './seo';
import { clearSiteContentCache } from './siteHtml';

const INDEX =
	'<!doctype html><html><head><meta name="description" content="기본 설명" /><title>김정현의 Mac</title></head>' +
	'<body><div id="root"></div></body></html>';

const POSTS: SeoPost[] = [
	{
		slug: 'hello-world',
		title: '첫 글 <b>&</b> "인용"',
		date: '2026-10-01',
		summary: '요약 </script><script>alert(1)</script>',
		category: '개발기',
		tags: ['MacFolio', 'SEO'],
		html: '<p>본문 <strong>굵게</strong></p>',
	},
	{
		slug: '한글',
		title: '한글 주소',
		date: '2026-09-01',
		summary: '요약',
		category: '기타',
		tags: [],
		html: '<p>a</p>',
	},
];
const project = DEFAULT_PROJECTS[0];

const data = siteDataOf(null, POSTS);
const render = (path: string) => applySeo(INDEX, seoPage(path, data));
const jsonLd = (html: string) =>
	JSON.parse(
		html.slice(html.indexOf('application/ld+json">') + 21, html.indexOf('</script>', html.indexOf('ld+json')))
	) as Record<string, unknown>;
const count = (html: string, text: string) => html.split(text).length - 1;

afterEach(() => {
	clearSeoPostsCache();
	clearSiteContentCache();
	vi.unstubAllGlobals();
});

describe('검색엔진용 첫 화면', () => {
	it('글: 제목·설명을 바꾸고(겹치지 않게) canonical·og·JSON-LD·본문을 넣는다', () => {
		const html = render('/memo/hello-world');
		expect(count(html, '<title>')).toBe(1);
		expect(count(html, 'name="description"')).toBe(1);
		expect(html).toContain('<title>첫 글 &lt;b&gt;&amp;&lt;/b&gt; &quot;인용&quot; — 김정현의 Mac</title>');
		expect(html).toContain(
			'<meta name="description" content="요약 &lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;" />'
		);
		expect(html).toContain('<link rel="canonical" href="https://macfolio.hyeoniverse.com/memo/hello-world" />');
		expect(html).toContain('<meta property="og:type" content="article" />');
		expect(html).toContain('<meta property="og:url" content="https://macfolio.hyeoniverse.com/memo/hello-world" />');
		expect(html).toContain('<meta property="og:image" content="https://macfolio.hyeoniverse.com/og-image.jpg" />');
		expect(html).toContain('<meta property="article:published_time" content="2026-10-01" />');
		expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
		expect(html).not.toContain('noindex');
		expect(html).toContain('<div id="root"><div class="seo-content"><article><h1>첫 글 &lt;b&gt;');
		expect(html).toContain('<p>본문 <strong>굵게</strong></p>');
		// JSON-LD 안의 </script>는 <로 바뀌어 빠져나가지 못한다
		expect(html).not.toContain('</script><script>alert(1)');
		expect(jsonLd(html)).toMatchObject({
			'@type': 'BlogPosting',
			headline: '첫 글 <b>&</b> "인용"',
			datePublished: '2026-10-01',
			keywords: 'MacFolio, SEO',
			author: { '@type': 'Person', name: PROFILE.name },
		});
	});

	it('한글 글 주소도 찾고, canonical은 인코딩한 주소', () => {
		const html = render(`/memo/${encodeURIComponent('한글')}`);
		expect(html).toContain('<title>한글 주소 — 김정현의 Mac</title>');
		expect(html).toContain(`href="https://macfolio.hyeoniverse.com/memo/${encodeURIComponent('한글')}"`);
	});

	it('없는 글·프로젝트, 잘못된 주소는 noindex이고 canonical이 없다', () => {
		for (const path of ['/memo/nope', '/safari/nope', '/memo/%E0%A4%A']) {
			const html = render(path);
			expect(html).toContain('<meta name="robots" content="noindex" />');
			expect(html).not.toContain('rel="canonical"');
		}
	});

	it('프로젝트: 이름·한 줄 소개, CreativeWork, 저장소 링크', () => {
		const html = render(`/safari/${project.id}`);
		expect(html).toContain(`<title>${escapeHtml(project.name)} — 김정현의 Mac</title>`);
		expect(html).toContain(`<meta name="description" content="${escapeHtml(project.description)}" />`);
		expect(html).toContain(`<link rel="canonical" href="https://macfolio.hyeoniverse.com/safari/${project.id}" />`);
		expect(html).toContain(`<a href="${escapeHtml(project.url)}">GitHub 저장소</a>`);
		expect(jsonLd(html)).toMatchObject({ '@type': 'CreativeWork', name: project.name, codeRepository: project.url });
	});

	it('첫 화면: Person JSON-LD와 모든 글·프로젝트 링크', () => {
		const html = render('/');
		expect(html).toContain('<title>김정현의 Mac</title>');
		expect(html).toContain('<link rel="canonical" href="https://macfolio.hyeoniverse.com/" />');
		expect(html).toContain('<meta property="og:type" content="website" />');
		const graph = jsonLd(html)['@graph'] as Record<string, unknown>[];
		expect(graph[0]).toMatchObject({
			'@type': 'Person',
			name: PROFILE.name,
			jobTitle: PROFILE.role,
			url: 'https://macfolio.hyeoniverse.com',
			sameAs: [PROFILE.github],
		});
		expect(html).toContain('<a href="/memo/hello-world">');
		expect(html).toContain(`<a href="/memo/${encodeURIComponent('한글')}">`);
		for (const item of DEFAULT_PROJECTS) expect(html).toContain(`<a href="/safari/${item.id}">`);
	});

	it('관리자가 숨긴 프로젝트는 빼고, 고친 프로필 이름을 쓴다', () => {
		const content = {
			profile: { ...PROFILE, name: '새이름', skills: { frontend: [], backend: [], interaction: [] }, siteStack: [] },
			projects: { items: [{ id: project.id, hidden: true }] },
		};
		const html = applySeo(INDEX, seoPage('/', siteDataOf(content, POSTS)));
		expect(html).toContain('<title>새이름의 Mac</title>');
		expect(html).not.toContain(`<a href="/safari/${project.id}">`);
	});
});

describe('글 목록 (seo/posts.json)', () => {
	it('한 번 받으면 다시 쓰고, 받지 못하면 빈 목록을 주고 다음에 다시 묻는다', async () => {
		const down = { fetch: vi.fn(async () => new Response('nope', { status: 404 })) };
		await expect(fetchSeoPosts(down, 'https://x.test')).resolves.toEqual([]);
		const ok = { fetch: vi.fn(async () => Response.json([...POSTS, { slug: 1 }])) };
		await expect(fetchSeoPosts(ok, 'https://x.test')).resolves.toEqual(POSTS);
		await fetchSeoPosts(ok, 'https://x.test');
		expect(ok.fetch).toHaveBeenCalledTimes(1);
	});
});

describe('Worker', () => {
	const assets = {
		fetch: vi.fn(async (input: Request | URL | string) =>
			String(input).endsWith('/seo/posts.json')
				? Response.json(POSTS)
				: new Response(INDEX, { headers: { 'content-type': 'text/html' } })
		),
	};

	it('글 주소에 글의 제목과 본문을 넣는다', async () => {
		const response = await worker.fetch(new Request('https://macfolio.hyeoniverse.com/memo/hello-world'), {
			ASSETS: assets,
		});
		const html = await response.text();
		expect(html).toContain('<title>첫 글');
		expect(html).toContain('<p>본문 <strong>굵게</strong></p>');
		expect(response.headers.get('X-Robots-Tag')).toBeNull();
		expect(response.headers.get('Content-Security-Policy')).toContain('frame-src');
	});

	it('미리보기(*.workers.dev)는 X-Robots-Tag: noindex', async () => {
		const response = await worker.fetch(new Request('https://feat-seo-macfolio.hyeoniverse-dev.workers.dev/'), {
			ASSETS: assets,
		});
		expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
	});
});
