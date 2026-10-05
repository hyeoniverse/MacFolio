import { isAppRoute } from './notFound';

/** Workers 정적 자산 바인딩 (wrangler.jsonc의 assets.binding) */
interface Env {
	ASSETS: { fetch: (request: Request | URL | string) => Promise<Response> };
}

/**
 * 프론트엔드 Worker. 있는 파일은 Cloudflare가 이 Worker를 거치지 않고 바로 준다 (wrangler.jsonc).
 * 여기에는 **없는 주소만** 온다: 앱 주소면 첫 화면을, 파일 주소면 404를 준다 (worker/notFound.ts)
 */
export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		if (!isAppRoute(url.pathname)) {
			return new Response('Not Found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
		}
		const index = await env.ASSETS.fetch(new URL('/', url));
		return new Response(index.body, { status: 200, headers: index.headers });
	},
};
