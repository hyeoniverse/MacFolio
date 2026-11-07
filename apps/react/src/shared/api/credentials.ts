// 서버 요청에 쿠키(credentials)를 붙일지 정한다. 순수 함수만 둔다.
//
// 서버(apps/api/src/common/cors.ts)는 CORS_ORIGINS에 그대로 적은 주소에만 Access-Control-Allow-Credentials를 보낸다.
// *로 맞은 주소(PR 미리보기 https://<브랜치>-macfolio.hyeoniverse.workers.dev)에는 보내지 않으므로, 그 화면이
// credentials: 'include'로 요청하면 브라우저가 응답을 모두 막아 글·댓글을 읽지 못한다.
// 미리보기는 API와 사이트가 달라(workers.dev ≠ hyeoniverse.com) SameSite=Lax 쿠키가 어차피 실리지 않으므로,
// 사이트가 다르면 쿠키 없이(omit) 요청해 공개 데이터만 읽는다.

/** 호스트 이름의 사이트(끝의 두 라벨). 점이 없는 이름(localhost)이나 IP 주소는 null */
function siteOf(hostname: string): string | null {
	if (!hostname.includes('.') || /^[\d.]+$/.test(hostname) || hostname.includes(':')) return null;
	return hostname.split('.').slice(-2).join('.');
}

/**
 * 페이지 호스트에서 apiUrl로 보내는 요청의 credentials.
 * 같은 사이트(macfolio.hyeoniverse.com → macfolio-api.hyeoniverse.com)이거나 로컬 개발(localhost, IP)이면 include,
 * 사이트가 다르면(PR 미리보기 → API) omit
 */
export function credentialsFor(pageHostname: string, apiUrl: string): RequestCredentials {
	let apiHostname: string;
	try {
		apiHostname = new URL(apiUrl).hostname;
	} catch {
		return 'include';
	}
	const page = siteOf(pageHostname);
	const api = siteOf(apiHostname);
	if (page === null || api === null) return 'include';
	return page === api ? 'include' : 'omit';
}
