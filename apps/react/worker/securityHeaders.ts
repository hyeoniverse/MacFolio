// 사이트 응답에 붙이는 보안 헤더. 빌드할 때 dist/_headers에 쓰고(vite.config.ts), 로컬 미리보기(vite preview)에도 같은 값을 붙인다.
// CSP의 출처 목록은 손으로 적지 않는다: API 주소는 빌드 환경 변수에서, 창 안에 띄우는 사이트는 PROJECTS의 demo에서 만든다.

// 빌드한 dist가 아니라 src를 바로 쓴다 (seo/posts.ts와 같다. vite.config.ts가 이 파일을 읽을 때 desktop-core를 빌드하지 않아도 되게)
import { EMBED_ORIGINS } from '../../../packages/desktop-core/src/memo';

/** Cloudflare Turnstile (메일 앱의 스팸 막기): 스크립트, 확인 요청, 위젯 iframe */
const TURNSTILE = 'https://challenges.cloudflare.com';

/** 날씨 앱의 데이터 (Open-Meteo): 일기예보와 장소 찾기 (src/apps/weather/weatherApi.ts) */
const OPEN_METEO = ['https://api.open-meteo.com', 'https://geocoding-api.open-meteo.com'];
/** 프로젝트 편집의 기술 칸이 npm 패키지를 찾는다 (apps/settings/packageSearch.ts) */
const NPM_REGISTRY = 'https://registry.npmjs.org';

export interface SecurityHeaderOptions {
	/** API 서버 주소 (VITE_API_URL). 비어 있으면 API를 쓰지 않는 빌드다 */
	apiUrl?: string;
	/** 창 안에 iframe으로 띄우는 바깥 사이트 주소 (프로젝트 데모) */
	frameUrls?: readonly string[];
	/** 시험에서만 더하는 API 주소 (E2E의 가짜 API). API 주소와 같은 자리에 들어간다 */
	testApiUrls?: readonly string[];
}

/** 주소에서 출처(scheme://host[:port])만 뽑는다. 주소가 아니면 버린다 */
export function originOf(url: string): string | null {
	try {
		const { protocol, origin } = new URL(url);
		return protocol === 'https:' || protocol === 'http:' ? origin : null;
	} catch {
		return null;
	}
}

/**
 * 창 안의 사이트가 제 iframe 안에서 넘어가는 같은 사이트의 다른 출처. 데모 주소가 왼쪽 출처일 때만 오른쪽도 프레임에 연다
 * (HYEONIVERSE 의 메뉴 Posts 는 blog.hyeoniverse.com 으로 간다 — 열지 않으면 그 순간 창이 ERR_BLOCKED_BY_CSP 로 막힌다)
 */
const FRAME_SIBLINGS: Readonly<Record<string, readonly string[]>> = {
	'https://www.hyeoniverse.com': ['https://blog.hyeoniverse.com'],
};

/** R2의 S3 호환 주소 (https://<계정 ID>.r2.cloudflarestorage.com) */
const R2_ENDPOINT = 'https://*.r2.cloudflarestorage.com';

function origins(urls: readonly (string | undefined)[]): string[] {
	return [...new Set(urls.map((url) => (url ? originOf(url) : null)).filter((o): o is string => o !== null))].sort();
}

/** 프레임에 여는 출처 — 데모 주소의 출처와 그 출처가 넘어가는 같은 사이트의 출처(FRAME_SIBLINGS) */
function frameOrigins(urls: readonly string[]): string[] {
	const own = origins(urls);
	return origins([...own, ...own.flatMap((origin) => FRAME_SIBLINGS[origin] ?? [])]);
}

/** Content-Security-Policy 값 */
export function contentSecurityPolicy({ apiUrl, frameUrls = [], testApiUrls = [] }: SecurityHeaderOptions): string {
	const api = origins([apiUrl, ...testApiUrls]);
	const directives: Record<string, string[]> = {
		'default-src': ["'self'"],
		// 인라인 스크립트는 없다 (테마 적용 스크립트도 public/theme-boot.js 파일이다)
		// 'wasm-unsafe-eval': WebAssembly 컴파일만 연다 (이력서 PDF의 레이아웃 엔진). 자바스크립트 eval은 그대로 막는다
		'script-src': ["'self'", "'wasm-unsafe-eval'", TURNSTILE],
		// React의 style 속성, Mermaid·Scalar가 만드는 <style> 때문에 인라인 스타일은 연다
		'style-src': ["'self'", "'unsafe-inline'"],
		// GitHub README·글의 바깥 그림은 주소를 미리 알 수 없다. 그림은 스크립트를 실행하지 못하니 https 전체를 연다
		'img-src': ["'self'", 'data:', 'blob:', 'https:', ...api],
		// 메모 글에 주소만 적은 바깥 영상·음악 파일(<video>·<audio>)은 주소를 미리 알 수 없다. 미디어는 스크립트를 실행하지 못하니 그림처럼 https 전체를 연다
		'media-src': ["'self'", 'blob:', 'https:', ...api],
		'font-src': ["'self'", 'data:'],
		// R2: 관리자가 문서 파일을 서명 주소로 바로 올린다 (계정마다 주소가 달라 * 하나로 연다. 서명이 없으면 쓸 수 없다)
		// blob:: 방문자가 놓은 PDF(이 탭의 blob 주소)를 pdf.js가 fetch로 읽는다 (Finder localFiles)
		// data:: 이력서 PDF의 레이아웃 엔진(WebAssembly)이 자기 몸통을 data: 주소로 읽는다. 바깥으로 나가는 연결은 아니다
		'connect-src': ["'self'", 'blob:', 'data:', ...api, TURNSTILE, ...OPEN_METEO, NPM_REGISTRY, R2_ENDPOINT],
		// 메모 글에 주소만 한 줄로 적은 YouTube·Vimeo 등의 임베드 (desktop-core memo/embeds.ts의 목록)
		'frame-src': ["'self'", TURNSTILE, ...Object.values(EMBED_ORIGINS).flat().sort(), ...frameOrigins(frameUrls)],
		'worker-src': ["'self'", 'blob:'],
		'object-src': ["'none'"],
		'base-uri': ["'self'"],
		'form-action': ["'self'"],
		// 다른 사이트가 이 사이트를 iframe에 넣지 못한다 (클릭재킹)
		'frame-ancestors': ["'self'"],
	};
	return Object.entries(directives)
		.map(([name, values]) => `${name} ${values.join(' ')}`)
		.join('; ');
}

/** 모든 응답에 붙이는 보안 헤더 */
export function securityHeaders(options: SecurityHeaderOptions): Record<string, string> {
	return {
		'Content-Security-Policy': contentSecurityPolicy(options),
		'X-Content-Type-Options': 'nosniff',
		'Referrer-Policy': 'strict-origin-when-cross-origin',
		// 쓰지 않는 기기 권한은 이 페이지와 안에 띄운 사이트 모두 막는다 (전체 화면·게임패드·자동 재생·클립보드는 프로젝트 앱이 쓴다)
		'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
		'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
	};
}

/** _headers 파일의 한 덩어리 (모든 경로) */
export function headersFileBlock(headers: Record<string, string>): string {
	return ['/*', ...Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`)].join('\n') + '\n';
}
