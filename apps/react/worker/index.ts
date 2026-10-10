import { isAppRoute } from './notFound';
import { fetchSiteContent, siteHtmlResponse } from './siteHtml';

/** Workers 정적 자산 바인딩 (wrangler.jsonc의 assets.binding)과 변수 (vars) */
interface Env {
	ASSETS: { fetch: (request: Request | URL | string) => Promise<Response> };
	/** API 주소. 있으면 첫 화면에 사이트 콘텐츠를 넣고, 그 데모 주소를 CSP에 더한다 */
	API_URL?: string;
}

/**
 * 프론트엔드 Worker. 있는 파일은 Cloudflare가 이 Worker를 거치지 않고 바로 준다 (wrangler.jsonc).
 * 여기에는 첫 화면(/, /index.html: run_worker_first)과 **없는 주소만** 온다.
 * - 첫 화면과 앱 주소(/memo/<글>)는 index.html에 사이트 콘텐츠를 넣고 CSP를 맞춰 준다 (worker/siteHtml.ts)
 * - 파일 주소(/assets/…)는 404 (worker/notFound.ts)
 */
export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname !== '/index.html' && !isAppRoute(url.pathname)) {
			return new Response('Not Found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
		}
		const index = await env.ASSETS.fetch(new URL('/', url));
		if (!index.ok) return index;
		const content = env.API_URL ? await fetchSiteContent(env.API_URL) : null;
		return siteHtmlResponse(index, content, env.API_URL);
	},
};
