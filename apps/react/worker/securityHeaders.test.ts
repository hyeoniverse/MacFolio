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

	it('인라인·eval 스크립트와 플러그인을 막고, 다른 사이트의 iframe에 들어가지 않는다', () => {
		const csp = parse(contentSecurityPolicy({}));
		expect(csp['script-src']).toEqual(["'self'", 'https://challenges.cloudflare.com']);
		expect(csp['object-src']).toEqual(["'none'"]);
		expect(csp['base-uri']).toEqual(["'self'"]);
		expect(csp['frame-ancestors']).toEqual(["'self'"]);
		// API 주소가 없는 빌드에는 바깥 연결 출처가 Turnstile과 날씨 앱의 Open-Meteo뿐이다
		expect(csp['connect-src']).toEqual([
			"'self'",
			'https://challenges.cloudflare.com',
			'https://api.open-meteo.com',
			'https://geocoding-api.open-meteo.com',
		]);
	});

	it('_headers 파일의 모든 경로 덩어리로 쓴다', () => {
		const block = headersFileBlock(securityHeaders({}));
		expect(block.split('\n')[0]).toBe('/*');
		expect(block).toContain('  X-Content-Type-Options: nosniff\n');
		expect(block).toContain('  Content-Security-Policy: default-src');
	});
});
