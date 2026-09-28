// 사용자 설정(화면 모드, 배경화면). React와 DOM에 의존하지 않는 순수 코드만 둔다.

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const WALLPAPERS = [
	{ id: 'sierra', name: 'High Sierra', css: "url('/imgs/background.png')" },
	{ id: 'dawn', name: '새벽', css: 'linear-gradient(160deg, #2e1a47 0%, #8e3b6d 45%, #f08a5d 100%)' },
	{ id: 'ocean', name: '바다', css: 'linear-gradient(160deg, #0f2027 0%, #203a43 45%, #2c7da0 100%)' },
	{ id: 'graphite', name: '흑연', css: 'radial-gradient(circle at 30% 20%, #5a5a5f 0%, #2c2c2e 55%, #111113 100%)' },
] as const;

export type WallpaperId = (typeof WALLPAPERS)[number]['id'];

export interface Settings {
	theme: ThemePreference;
	wallpaper: WallpaperId;
}

export const DEFAULT_SETTINGS: Settings = { theme: 'system', wallpaper: 'sierra' };

const THEMES: readonly ThemePreference[] = ['light', 'dark', 'system'];

/** 저장된 값이 깨졌거나 예전 형식이어도 안전한 설정을 돌려준다. */
export function parseSettings(raw: unknown): Settings {
	const value = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<Record<keyof Settings, unknown>>;
	return {
		theme: THEMES.includes(value.theme as ThemePreference) ? (value.theme as ThemePreference) : DEFAULT_SETTINGS.theme,
		wallpaper: WALLPAPERS.some((wallpaper) => wallpaper.id === value.wallpaper)
			? (value.wallpaper as WallpaperId)
			: DEFAULT_SETTINGS.wallpaper,
	};
}

/** '시스템 설정 따르기'를 실제 테마로 바꾼다. */
export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
	if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
	return preference;
}

export function wallpaperCss(id: WallpaperId): string {
	return WALLPAPERS.find((wallpaper) => wallpaper.id === id)!.css;
}
