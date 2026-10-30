// 첫 화면 HTML의 엣지 캐시 (Cloudflare Cache API). 첫 화면을 만들려면 API의 사이트 콘텐츠·서버 글과 글 목록(seo/posts.json, 약 4MB)을
// 기다려야 해서, 새로 뜬 Worker에서는 첫 바이트(TTFB)가 0.3~0.5초 걸렸다. 같은 PoP에서 만든 HTML을 보관해 바로 주고,
// 60초가 지났으면 그대로 준 뒤 뒤에서 새로 만든다 (stale-while-revalidate). 관리자가 고친 내용은 지금처럼 1분 안팎에 보인다.
// 키에 index.html의 ETag를 넣어, 새로 배포하면 지난 버전의 HTML(없어진 /assets/ 주소)을 주지 않는다

/** Cloudflare Workers의 caches.default 중 쓰는 부분 */
export interface EdgeCache {
	match(request: Request): Promise<Response | undefined>;
	put(request: Request, response: Response): Promise<void>;
}

/** 응답을 돌려준 뒤에도 할 일 (ExecutionContext.waitUntil) */
export interface BackgroundTasks {
	waitUntil(promise: Promise<unknown>): void;
}

/** 이만큼 지난 HTML은 준 뒤에 새로 만든다 (siteHtml.ts의 사이트 콘텐츠 캐시와 같은 1분) */
export const FRESH_MS = 60_000;
/** 엣지에 보관하는 기간. 새로 만들지 못해도(API가 닿지 않아도) 이만큼은 지난 HTML을 준다 */
const KEEP_SECONDS = 24 * 60 * 60;
/** 보관한 시각 (캐시 안에서만 쓰고 방문자에게는 빼고 준다) */
const STORED_AT = 'x-macfolio-stored-at';

/** 캐시 키: 주소(검색 문자열 제외, 첫 화면은 utm 등과 상관없다)와 배포 버전 */
export function cacheKey(url: URL, version: string | null): Request {
	const key = new URL(url.pathname, url.origin);
	key.searchParams.set('v', version ?? 'none');
	return new Request(key);
}

/** 방문자에게 줄 모양: 브라우저는 늘 다시 묻는다 (siteHtml.ts와 같다) */
function forVisitor(response: Response): Response {
	const headers = new Headers(response.headers);
	headers.delete(STORED_AT);
	headers.set('cache-control', 'no-cache');
	return new Response(response.body, { status: response.status, headers });
}

async function store(cache: EdgeCache, key: Request, response: Response, now: number): Promise<void> {
	// 첫 화면(200)과 없는 글(404)만 보관한다
	if (response.status !== 200 && response.status !== 404) return;
	const headers = new Headers(response.headers);
	headers.set('cache-control', `public, max-age=${KEEP_SECONDS}`);
	headers.set(STORED_AT, String(now));
	await cache.put(key, new Response(response.body, { status: response.status, headers }));
}

/**
 * 보관한 HTML이 있으면 바로 주고(오래됐으면 뒤에서 새로 만든다), 없으면 만들어 주면서 보관한다.
 * 캐시가 없는 곳(시험, workers.dev 미리보기)에서는 그냥 만든다
 */
export async function withEdgeCache(
	key: Request,
	build: () => Promise<Response>,
	{ cache, tasks, now = Date.now() }: { cache?: EdgeCache; tasks?: BackgroundTasks; now?: number }
): Promise<Response> {
	if (!cache || !tasks) return build();
	const hit = await cache.match(key).catch(() => undefined);
	if (hit) {
		if (now - Number(hit.headers.get(STORED_AT) ?? 0) > FRESH_MS)
			tasks.waitUntil(
				build()
					.then((fresh) => store(cache, key, fresh, now))
					.catch(() => {})
			);
		return forVisitor(hit);
	}
	const response = await build();
	tasks.waitUntil(store(cache, key, response.clone(), now).catch(() => {}));
	return response;
}
