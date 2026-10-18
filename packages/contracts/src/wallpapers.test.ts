import { describe, expect, it } from 'vitest';
import { parse } from './parse.js';
import { cleanWallpaperName, Wallpaper, WallpaperRename } from './wallpapers.js';

describe('배경화면 이름', () => {
	it('확장자·제어 문자를 빼고 40자까지, 비면 null', () => {
		expect(cleanWallpaperName('  제주 바다.JPG ')).toBe('제주 바다');
		expect(cleanWallpaperName('a\u0000b')).toBe('ab');
		expect(cleanWallpaperName('가'.repeat(50))).toBe('가'.repeat(40));
		expect(cleanWallpaperName('   ')).toBeNull();
		expect(cleanWallpaperName(3)).toBeNull();
	});

	it('이름 바꾸기 몸통: 다듬은 이름이 비면 이유를 알린다', () => {
		expect(parse(WallpaperRename, { name: '  제주 바다  ' })).toEqual({ value: { name: '제주 바다' } });
		expect(parse(WallpaperRename, { name: '   ' })).toEqual({ errors: ['이름을 입력해 주세요.'] });
		expect(parse(WallpaperRename, null)).toEqual({ errors: ['이름을 입력해 주세요.'] });
	});
});

describe('Wallpaper', () => {
	it('목록 항목의 모양', () => {
		const row = {
			id: 'a1',
			name: '노을',
			image: '/files/a1',
			thumbnail: '/files/a2',
			createdAt: '2026-10-11T00:00:00.000Z',
		};
		expect(parse(Wallpaper, { ...row, createdBy: 'admin' })).toEqual({ value: { ...row, video: false } });
	});

	it('동영상 배경화면은 video: true, 이름에서 .mp4를 뺀다', () => {
		const row = {
			id: 'a1',
			name: '파도',
			image: '/files/a1',
			thumbnail: '/files/a2',
			video: true,
			createdAt: '2026-10-11T00:00:00.000Z',
		};
		expect(parse(Wallpaper, row)).toEqual({ value: row });
		expect(parse(Wallpaper, { ...row, video: 'yes' })).toHaveProperty('errors');
		expect(cleanWallpaperName('파도.MP4')).toBe('파도');
	});
});
