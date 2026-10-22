import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, headersFileBlock, originOf, securityHeaders } from './securityHeaders';

/** CSP 문자열을 지시어 → 값 목록으로 */
function parse(csp: string): Record<string, string[]> {
	return Object.fromEntries(
		csp.split('; ').map((directive) => {
			const [name, ...values] = directive.split(' ');
			return [name, values];
		})
	);
}

describe('보안 헤더', () => {
	it('주소에서 출처만 뽑고, http(s)가 아니면 버린다', () => {
		expect(originOf('https://what-to-do-chi.vercel.app/path?q=1')).toBe('https://what-to-do-chi.vercel.app');
		expect(originOf('http://localhost:3000/')).toBe('http://localhost:3000');
		expect(originOf('javascript:alert(1)')).toBeNull();
		expect(originOf('autosave')).toBeNull();
	});

	it('HYEONIVERSE 데모가 있으면 그 사이트의 블로그 출처도 프레임에 연다(없으면 열지 않는다)', () => {
		const withSite = parse(contentSecurityPolicy({ frameUrls: ['https://www.hyeoniverse.com'] }));
		expect(withSite['frame-src']).toContain('https://www.hyeoniverse.com');
		expect(withSite['frame-src']).toContain('https://blog.hyeoniverse.com');
		const without = parse(contentSecurityPolicy({ frameUrls: ['https://newpick-tan.vercel.app'] }));
		expect(without['frame-src']).not.toContain('https://blog.hyeoniverse.com');
	});

	it('API 주소는 연결·미디어에, 데모 주소는 프레임에만 출처로 들어간다', () => {
		const csp = parse(
			contentSecurityPolicy({
				apiUrl: 'https://macfolio-api.hyeoniverse.com/',
				frameUrls: [
					'https://newpick-tan.vercel.app',
					'https://what-to-do-chi.vercel.app/',
					'https://newpick-tan.vercel.app/x',
				],
			})
		);
		expect(csp['connect-src']).toContain('https://macfolio-api.hyeoniverse.com');
		expect(csp['media-src']).toContain('https://macfolio-api.hyeoniverse.com');
		expect(csp['frame-src']).toEqual([
			"'self'",
			'https://challenges.cloudflare.com',
			'https://newpick-tan.vercel.app',
			'https://what-to-do-chi.vercel.app',
		]);
		expect(csp['script-src']).not.toContain('https://newpick-tan.vercel.app');
	});

	it('인라인·eval 스크립트와 플러그인을 막고(WebAssembly 컴파일만 연다), 다른 사이트의 iframe에 들어가지 않는다', () => {
		const csp = parse(contentSecurityPolicy({}));
		expect(csp['script-src']).toEqual(["'self'", "'wasm-unsafe-eval'", 'https://challenges.cloudflare.com']);
		expect(csp['object-src']).toEqual(["'none'"]);
		expect(csp['base-uri']).toEqual(["'self'"]);
		expect(csp['frame-ancestors']).toEqual(["'self'"]);
		// API 주소가 없는 빌드에는 바깥 연결 출처가 Turnstile, 날씨 앱의 Open-Meteo, 기술 칸의 npm 검색, 문서 올리기의 R2뿐이다.
		// blob:은 이 탭이 만든 주소(방문자가 놓은 PDF), data:는 이력서 PDF의 WebAssembly 몸통이라 바깥 출처가 아니다
		expect(csp['connect-src']).toEqual([
			"'self'",
			'blob:',
			'data:',
			'https://challenges.cloudflare.com',
			'https://api.open-meteo.com',
			'https://geocoding-api.open-meteo.com',
			'https://registry.npmjs.org',
			'https://*.r2.cloudflarestorage.com',
		]);
	});

	it('_headers 파일의 모든 경로 덩어리로 쓴다', () => {
		const block = headersFileBlock(securityHeaders({}));
		expect(block.split('\n')[0]).toBe('/*');
		expect(block).toContain('  X-Content-Type-Options: nosniff\n');
		expect(block).toContain('  Content-Security-Policy: default-src');
	});
});
