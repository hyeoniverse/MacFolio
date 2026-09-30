import { describe, expect, it } from 'vitest';
import {
	DEFAULT_SETTINGS,
	IOS_WALLPAPERS,
	MAC_WALLPAPERS,
	parseSettings,
	resolveTheme,
	wallpaperCss,
} from './settings';

describe('parseSettings', () => {
	it('올바른 값은 그대로 읽는다', () => {
		expect(parseSettings({ theme: 'dark', wallpaper: 'sonoma', mobileWallpaper: 'earth', clickSound: false })).toEqual({
			theme: 'dark',
			wallpaper: 'sonoma',
			mobileWallpaper: 'earth',
			clickSound: false,
		});
	});

	it('예전 배경화면(그라데이션) id는 기본값으로 바꾼다', () => {
		expect(parseSettings({ theme: 'dark', wallpaper: 'ocean' }).wallpaper).toBe(DEFAULT_SETTINGS.wallpaper);
	});

	it('없거나 깨진 값은 기본값으로 채운다', () => {
		expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
		expect(parseSettings('oops')).toEqual(DEFAULT_SETTINGS);
		expect(parseSettings({ theme: 'purple', wallpaper: 'nope' })).toEqual(DEFAULT_SETTINGS);
	});

	it('클릭 소리는 켜고 끈 값만 읽고, 없거나 깨졌으면 켠다', () => {
		expect(parseSettings({ clickSound: false }).clickSound).toBe(false);
		expect(parseSettings({ clickSound: 'no' }).clickSound).toBe(true);
		expect(parseSettings({}).clickSound).toBe(true);
	});

	it('일부만 있으면 나머지를 기본값으로 채운다', () => {
		expect(parseSettings({ theme: 'system' })).toEqual({ ...DEFAULT_SETTINGS, theme: 'system' });
	});
});

describe('resolveTheme', () => {
	it('직접 고른 테마는 시스템 설정과 무관하다', () => {
		expect(resolveTheme('light', true)).toBe('light');
		expect(resolveTheme('dark', false)).toBe('dark');
	});

	it('시스템 설정 따르기', () => {
		expect(resolveTheme('system', true)).toBe('dark');
		expect(resolveTheme('system', false)).toBe('light');
	});
});

describe('wallpaperCss', () => {
	it('어두운 버전이 있으면 화면 모드를 따른다', () => {
		const settings = { ...DEFAULT_SETTINGS, wallpaper: 'sonoma', mobileWallpaper: 'kaleidoscope' } as const;
		expect(wallpaperCss(settings, 'light')).toEqual({
			desktop: "url('/imgs/wallpapers/sonoma-light.jpg')",
			mobile: "url('/imgs/wallpapers/ios-kaleidoscope-light.jpg')",
		});
		expect(wallpaperCss(settings, 'dark').desktop).toContain('sonoma-dark.jpg');
	});

	it('어두운 버전이 없으면 같은 이미지를 쓴다', () => {
		expect(wallpaperCss(DEFAULT_SETTINGS, 'dark').desktop).toContain('highsierra.jpg');
	});

	it('모든 배경화면은 파일 이름이 겹치지 않는다', () => {
		const files = [...MAC_WALLPAPERS, ...IOS_WALLPAPERS].flatMap((w) => ('dark' in w ? [w.light, w.dark] : [w.light]));
		expect(new Set(files).size).toBe(files.length);
	});
});
