import { describe, expect, it } from 'vitest';
import { isChunkLoadError } from './chunkLoadError';

describe('isChunkLoadError', () => {
	it('브라우저마다 다른 코드 불러오기 실패 문구를 알아본다', () => {
		expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://a/x.js'))).toBe(true);
		expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
		expect(isChunkLoadError(new TypeError('error loading dynamically imported module: https://a/x.js'))).toBe(true);
		expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/x.css'))).toBe(true);
	});

	it('다른 에러는 아니다', () => {
		expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'map')"))).toBe(false);
		expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(false);
	});
});
