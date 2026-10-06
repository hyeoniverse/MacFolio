import { describe, expect, it } from 'vitest';
import { localFrontendWarning, originMatcher } from './cors.js';

describe('CORS 허용 주소', () => {
	const allowed = originMatcher(['https://macfolio.hyeoniverse.com', 'https://*-macfolio.hyeoniverse.workers.dev']);

	it('그대로 적은 주소와 *(영문 소문자·숫자·-) 자리가 맞는 주소', () => {
		expect(allowed('https://macfolio.hyeoniverse.com')).toBe(true);
		expect(allowed('https://feat-app-menus-macfolio.hyeoniverse.workers.dev')).toBe(true);
		expect(allowed('https://1a2b3c4d-macfolio.hyeoniverse.workers.dev')).toBe(true);
	});

	it('*에는 점이 오지 않는다: 다른 도메인이나 다른 계정으로 넓어지지 않는다', () => {
		expect(allowed('https://evil.example')).toBe(false);
		expect(allowed('https://x.evil-macfolio.hyeoniverse.workers.dev')).toBe(false);
		expect(allowed('https://evil.com/-macfolio.hyeoniverse.workers.dev')).toBe(false);
		expect(allowed('https://a-macfolio.hyeoniverse.workers.dev.evil.com')).toBe(false);
		expect(allowed('http://a-macfolio.hyeoniverse.workers.dev')).toBe(false);
		expect(allowed('https://macfolio.hyeoniverse.workers.dev')).toBe(false);
		expect(allowed(undefined)).toBe(false);
	});
});

describe('로컬 프론트엔드를 허용하지 않을 때의 경고', () => {
	it('개발 모드에서 로컬 프론트엔드가 빠지면 경고한다', () => {
		expect(localFrontendWarning(['https://macfolio.hyeoniverse.com'], undefined)).toMatch(/http:\/\/localhost:5173/);
		expect(localFrontendWarning(['https://macfolio.hyeoniverse.com'], 'development')).not.toBeNull();
	});

	it('로컬 프론트엔드가 있거나 배포 모드면 조용하다', () => {
		expect(localFrontendWarning(['http://localhost:5173'], undefined)).toBeNull();
		expect(localFrontendWarning(['http://localhost:5173', 'https://macfolio.hyeoniverse.com'], undefined)).toBeNull();
		expect(localFrontendWarning(['https://macfolio.hyeoniverse.com'], 'production')).toBeNull();
	});
});
