import { describe, expect, it } from 'vitest';
import { isAppRoute } from './notFound';

describe('isAppRoute', () => {
	it('앱 주소는 첫 화면으로', () => {
		for (const path of ['/', '/memo/db-backup', '/safari/sproutfarm', '/memo/%ED%95%9C%EA%B8%80'])
			expect(isAppRoute(path)).toBe(true);
	});

	it('빌드 결과와 파일 주소는 404', () => {
		for (const path of [
			'/assets/Memo-old123.js',
			'/assets/Memo-old123.css',
			'/assets/x',
			'/imgs/nope.png',
			'/robots2.txt',
		])
			expect(isAppRoute(path)).toBe(false);
	});
});
