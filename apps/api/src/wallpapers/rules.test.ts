import { describe, expect, it } from 'vitest';
import { cleanWallpaperName, isWallpaperKind } from './rules.js';

describe('배경화면 규칙', () => {
	it('묶음은 mac과 ios만', () => {
		expect(isWallpaperKind('mac')).toBe(true);
		expect(isWallpaperKind('ios')).toBe(true);
		expect(isWallpaperKind('android')).toBe(false);
		expect(isWallpaperKind(undefined)).toBe(false);
	});

	it('이름은 확장자·제어 문자를 빼고 40자까지, 비면 null', () => {
		expect(cleanWallpaperName('  제주 바다.JPG ')).toBe('제주 바다');
		expect(cleanWallpaperName('a\u0000b')).toBe('ab');
		expect(cleanWallpaperName('가'.repeat(50))).toBe('가'.repeat(40));
		expect(cleanWallpaperName('   ')).toBeNull();
		expect(cleanWallpaperName(3)).toBeNull();
	});
});
