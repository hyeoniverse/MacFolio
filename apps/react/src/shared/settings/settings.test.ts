import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings, resolveTheme, wallpaperCss } from './settings';

describe('parseSettings', () => {
	it('올바른 값은 그대로 읽는다', () => {
		expect(parseSettings({ theme: 'dark', wallpaper: 'ocean' })).toEqual({ theme: 'dark', wallpaper: 'ocean' });
	});

	it('없거나 깨진 값은 기본값으로 채운다', () => {
		expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
		expect(parseSettings('oops')).toEqual(DEFAULT_SETTINGS);
		expect(parseSettings({ theme: 'purple', wallpaper: 'nope' })).toEqual(DEFAULT_SETTINGS);
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
	it('배경화면 id로 CSS 값을 찾는다', () => {
		expect(wallpaperCss('sierra')).toContain('background.png');
		expect(wallpaperCss('ocean')).toContain('linear-gradient');
	});
});
