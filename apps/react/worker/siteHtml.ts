// 첫 화면(index.html)을 줄 때: 관리자가 고친 사이트 콘텐츠(프로필·프로젝트)를 API에서 받아
// 1) CSP의 frame-src에 데모 주소를 더하고 (새 프로젝트 앱도 iframe이 막히지 않게, 다시 빌드하지 않고)
// 2) HTML에 데이터로 넣는다 (화면이 시작할 때 API를 다시 묻지 않는다. src/shared/site/siteContent.ts가 읽는다)
import { DEFAULT_PROJECTS } from '../src/shared/profile';
import { securityHeaders } from './securityHeaders';

/** src/shared/site/siteContent.ts의 SITE_CONTENT_ELEMENT_ID와 같아야 한다 (siteHtml.test.ts가 확인한다) */
export const SITE_CONTENT_ELEMENT_ID = 'site-content';

/** API에 묻는 한도. 넘으면 콘텐츠 없이(코드의 기본값으로) 준다 */
const FETCH_TIMEOUT_MS = 1500;
/** 같은 Worker 인스턴스는 이만큼 받은 값을 다시 쓴다. 관리자가 저장한 것은 길어야 이만큼 뒤에 보인다 */
export const CACHE_MS = 60_000;
/** API에 닿지 않았으면 이만큼 뒤에 다시 묻는다 (요청마다 기다리지 않게) */
const FAILURE_CACHE_MS = 10_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/** iframe으로 띄울 주소: 코드의 데모 주소와, 관리자가 고친 프로젝트의 데모 주소 (출처만 CSP에 들어간다) */
export function frameUrlsOf(content: unknown): string[] {
	const urls = DEFAULT_PROJECTS.flatMap((project) => (project.demo ? [project.demo] : []));
	const items = isRecord(content) && isRecord(content.projects) ? content.projects.items : undefined;
	if (Array.isArray(items))
		for (const item of items)
			if (isRecord(item) && isRecord(item.override) && typeof item.override.demo === 'string')
				urls.push(item.override.demo);
	return urls;
}

/** HTML의 </head> 앞에 실행되지 않는 JSON 데이터로 넣는다. "</script>"로 빠져나가지 못하게 <를 <로 */
export function injectSiteContent(html: string, content: unknown): string {
	if (content === null || content === undefined) return html;
	const json = JSON.stringify(content).replace(/</g, '\\u003c');
	const tag = `<script type="application/json" id="${SITE_CONTENT_ELEMENT_ID}">${json}</script>`;
	return html.includes('</head>') ? html.replace('</head>', `${tag}</head>`) : html;
}

let cached: { at: number; ttl: number; value: Promise<unknown> } | null = null;

/** API의 GET /site. 닿지 않으면 null */
export function fetchSiteContent(apiUrl: string, fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<unknown> {
	if (cached && now - cached.at < cached.ttl) return cached.value;
	const value = fetchImpl(`${apiUrl}/site`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
		.then((response) => (response.ok ? (response.json() as Promise<unknown>) : null))
		.catch(() => null);
	const entry = { at: now, ttl: CACHE_MS, value };
	cached = entry;
	void value.then((result) => {
		if (result === null && cached === entry) entry.ttl = FAILURE_CACHE_MS;
	});
	return value;
}

/** 시험에서 캐시를 비운다 */
export const clearSiteContentCache = () => {
	cached = null;
};

/** 첫 화면 응답: 콘텐츠를 넣은 HTML과, 그 콘텐츠의 데모 주소까지 허용한 보안 헤더 */
export async function siteHtmlResponse(
	index: Response,
	content: unknown,
	apiUrl: string | undefined
): Promise<Response> {
	const html = injectSiteContent(await index.text(), content);
	const headers = new Headers(index.headers);
	// 몸통이 바뀌었으니 정적 파일의 ETag·길이는 맞지 않는다. 늘 새로 받게 한다
	headers.delete('etag');
	headers.delete('content-length');
	headers.set('cache-control', 'no-cache');
	headers.set('content-type', 'text/html; charset=utf-8');
	for (const [name, value] of Object.entries(securityHeaders({ apiUrl, frameUrls: frameUrlsOf(content) })))
		headers.set(name, value);
	return new Response(html, { status: 200, headers });
}
