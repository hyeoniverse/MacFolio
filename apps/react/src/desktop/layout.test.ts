import { describe, expect, it } from 'vitest';
import { isMobileViewport } from './layout';

describe('isMobileViewport', () => {
	it('휴대폰 세로 화면은 모바일이다', () => {
		expect(isMobileViewport({ width: 390, height: 844 })).toBe(true);
		expect(isMobileViewport({ width: 412, height: 915 })).toBe(true);
	});

	it('휴대폰 가로 화면도 모바일이다', () => {
		expect(isMobileViewport({ width: 844, height: 390 })).toBe(true);
	});

	it('태블릿과 데스크톱은 데스크톱이다', () => {
		expect(isMobileViewport({ width: 768, height: 1024 })).toBe(false);
		expect(isMobileViewport({ width: 1440, height: 900 })).toBe(false);
	});

	it('넓고 낮은 데스크톱 브라우저 창은 데스크톱이다', () => {
		expect(isMobileViewport({ width: 1400, height: 450 })).toBe(false);
	});
});
