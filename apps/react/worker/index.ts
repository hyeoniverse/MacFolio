import { FILES_PREFIX, serveFile, type FilesBucket } from './files';
import { isAppRoute } from './notFound';
import { applySeo, fetchSeoPosts, isPreviewHost, seoPage, siteDataOf } from './seo';
import { fetchSiteContent, siteHtmlResponse } from './siteHtml';
import { fetchServerPosts, mergeServerPosts } from './serverPosts';
import { rssXml, siteChannel, sitemapXml } from '../seo/site';

/** Workers 정적 자산 바인딩 (wrangler.jsonc의 assets.binding)과 변수 (vars) */
interface Env {
	ASSETS: { fetch: (request: Request | URL | string) => Promise<Response> };
	/** API 주소. 있으면 첫 화면에 사이트 콘텐츠를 넣고, 그 데모 주소를 CSP에 더한다 */
	API_URL?: string;
	/** 문서 파일 R2 버킷 (wrangler.jsonc의 r2_buckets). 없으면 /files/는 404 */
	FILES?: FilesBucket;
}

/**
 * 프론트엔드 Worker. 있는 파일은 Cloudflare가 이 Worker를 거치지 않고 바로 준다 (wrangler.jsonc).
 * 여기에는 첫 화면(/, /index.html: run_worker_first)과 **없는 주소만** 온다.
 * - 첫 화면과 앱 주소(/memo/<글>)는 index.html에 사이트 콘텐츠를 넣고 CSP를 맞춰 준다 (worker/siteHtml.ts)
 *   주소마다 검색엔진이 읽을 제목·설명·본문도 넣는다 (worker/seo.ts)
 * - sitemap.xml·rss.xml은 저장소 글과 서버에 쓴 글(worker/serverPosts.ts)을 합쳐 만든다
 * - 없는 글·프로젝트 주소(/memo/<없는 글>)는 404. 글 목록이나 사이트 콘텐츠를 받지 못했으면 단정하지 않고 200(noindex)
 * - 문서 파일(/files/<키>)은 R2 버킷에서 (worker/files.ts)
 * - 파일 주소(/assets/…)는 404 (worker/notFound.ts)
 */
export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname.startsWith(FILES_PREFIX)) return serveFile(request, env.FILES);
		// sitemap.xml·rss.xml은 빌드한 파일 대신 서버에 쓴 글까지 합쳐 만든다 (wrangler.jsonc의 run_worker_first)
		const sitemap = url.pathname === '/sitemap.xml';
		const rss = url.pathname === '/rss.xml';
		if (!sitemap && !rss && url.pathname !== '/index.html' && !isAppRoute(url.pathname)) {
			return new Response('Not Found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
		}
		const [content, repoPosts, serverPosts] = await Promise.all([
			env.API_URL ? fetchSiteContent(env.API_URL) : null,
			fetchSeoPosts(env.ASSETS, url.origin),
			env.API_URL ? fetchServerPosts(env.API_URL) : [],
		]);
		const data = siteDataOf(content, mergeServerPosts(repoPosts, serverPosts ?? [], env.API_URL), env.API_URL);
		if (sitemap) {
			return new Response(
				sitemapXml(
					data.posts,
					data.projects.map((project) => project.id)
				),
				{ headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } }
			);
		}
		if (rss) {
			return new Response(rssXml(data.posts, siteChannel(data.profile.name)), {
				headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=3600' },
			});
		}
		const index = await env.ASSETS.fetch(new URL('/', url));
		if (!index.ok) return index;
		const page = seoPage(url.pathname, data);
		const html = applySeo(await index.text(), page);
		const response = await siteHtmlResponse(new Response(html, index), content, env.API_URL);
		if (isPreviewHost(url.hostname)) response.headers.set('X-Robots-Tag', 'noindex');
		// 받은 목록이 온전할 때만 없다고 답한다 (API가 잠깐 닿지 않아 서버에 쓴 글·고친 프로젝트를 모를 수 있다)
		const complete = repoPosts.length > 0 && (!env.API_URL || (serverPosts !== null && content !== null));
		if (page.notFound && complete) return new Response(response.body, { status: 404, headers: response.headers });
		return response;
	},
};
