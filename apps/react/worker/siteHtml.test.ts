import { afterEach, describe, expect, it, vi } from 'vitest';
import { SITE_CONTENT_ELEMENT_ID as CLIENT_ID } from '../src/shared/site/siteContent';
import worker from './index';
import {
	CACHE_MS,
	clearSiteContentCache,
	fetchSiteContent,
	frameUrlsOf,
	injectSiteContent,
	SITE_CONTENT_ELEMENT_ID,
} from './siteHtml';

const INDEX = '<!doctype html><html><head><title>t</title></head><body><div id="root"></div></body></html>';
const content = {
	profile: null,
	projects: { items: [{ id: 'new', override: { name: '새 앱', demo: 'https://new-app.example.com/play' } }] },
	updatedAt: '2026-10-11T00:00:00.000Z',
};

const frameSrc = (response: Response) =>
	response.headers
		.get('Content-Security-Policy')!
		.split('; ')
		.find((directive) => directive.startsWith('frame-src'))!;

afterEach(() => {
	clearSiteContentCache();
	vi.unstubAllGlobals();
});

describe('사이트 콘텐츠를 넣은 첫 화면', () => {
	it('화면이 읽는 자리와 같은 id', () => {
		expect(SITE_CONTENT_ELEMENT_ID).toBe(CLIENT_ID);
	});

	it('</head> 앞에 실행되지 않는 JSON으로 넣고, </script>로 빠져나가지 못한다', () => {
		const html = injectSiteContent(INDEX, { profile: { name: '</script><script>alert(1)</script>' } });
		expect(html).toContain('<script type="application/json" id="site-content">');
		expect(html).not.toContain('</script><script>alert(1)');
		expect(html).toContain('\\u003c/script>');
		const json = html.slice(html.indexOf('">') + 2, html.indexOf('</script></head>'));
		expect(JSON.parse(json)).toEqual({ profile: { name: '</script><script>alert(1)</script>' } });
		expect(injectSiteContent(INDEX, null)).toBe(INDEX);
	});

	it('iframe 주소: 코드의 데모 주소에 관리자가 고친 프로젝트의 데모 주소를 더한다', () => {
		const urls = frameUrlsOf(content);
		expect(urls).toContain('https://new-app.example.com/play');
		expect(urls.length).toBeGreaterThan(1);
		expect(frameUrlsOf(null)).toEqual(frameUrlsOf({ projects: 'broken' }));
	});

	it('API에서 받은 값은 잠시 다시 쓰고, 닿지 않으면 null', async () => {
		const ok = vi.fn(async () => Response.json(content));
		await expect(fetchSiteContent('https://api.test', ok, 0)).resolves.toEqual(content);
		await fetchSiteContent('https://api.test', ok, CACHE_MS - 1);
		expect(ok).toHaveBeenCalledTimes(1);
		await fetchSiteContent('https://api.test', ok, CACHE_MS + 1);
		expect(ok).toHaveBeenCalledTimes(2);

		clearSiteContentCache();
		const down = vi.fn(async () => {
			throw new TypeError('fetch failed');
		});
		await expect(fetchSiteContent('https://api.test', down, 0)).resolves.toBeNull();
	});
});

describe('Worker', () => {
	const assets = {
		fetch: vi.fn(
			async () =>
				new Response(INDEX, { headers: { 'content-type': 'text/html', etag: '"abc"', 'content-length': '93' } })
		),
	};

	it('첫 화면과 앱 주소: 콘텐츠를 넣고, 새 데모 주소까지 CSP frame-src에 허용한다', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => Response.json(content))
		);
		for (const path of ['/', '/index.html', '/memo/hello']) {
			const response = await worker.fetch(new Request(`https://macfolio.test${path}`), {
				ASSETS: assets,
				API_URL: 'https://api.test',
			});
			expect(response.status).toBe(200);
			expect(await response.text()).toContain('"name":"새 앱"');
			expect(frameSrc(response)).toContain('https://new-app.example.com');
			expect(response.headers.get('etag')).toBeNull();
			expect(response.headers.get('cache-control')).toBe('no-cache');
			expect(response.headers.get('Content-Security-Policy')).toContain('connect-src');
		}
	});

	it('API가 없거나 닿지 않으면 코드의 데모 주소만 허용하고 콘텐츠 없이 준다', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(null, { status: 503 }))
		);
		const response = await worker.fetch(new Request('https://macfolio.test/'), {
			ASSETS: assets,
			API_URL: 'https://api.test',
		});
		expect(await response.text()).toBe(INDEX);
		expect(frameSrc(response)).not.toContain('new-app.example.com');
		const noApi = await worker.fetch(new Request('https://macfolio.test/'), { ASSETS: assets });
		expect(await noApi.text()).toBe(INDEX);
	});

	it('옛 코드 파일 주소는 404', async () => {
		const response = await worker.fetch(new Request('https://macfolio.test/assets/old.js'), { ASSETS: assets });
		expect(response.status).toBe(404);
	});
});
