// 사용자 설정(화면 모드, 배경화면). React와 DOM에 의존하지 않는 순수 코드만 둔다.

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/** 배경화면 이미지 폴더 (public/imgs/wallpapers). 썸네일은 thumbs/에 같은 이름으로 있다 */
const WALLPAPER_DIR = '/imgs/wallpapers';

export interface Wallpaper {
	id: string;
	name: string;
	/** 파일 이름 (확장자 제외). 화면 모드마다 다르면 light/dark */
	light: string;
	dark?: string;
}

/** macOS 기본 배경화면 (데스크톱). 화면 모드에 따라 밝은·어두운 버전이 바뀐다 */
export const MAC_WALLPAPERS = [
	{ id: 'sierra', name: 'High Sierra', light: 'highsierra' },
	{ id: 'bigsur', name: 'Big Sur', light: 'bigsur-light', dark: 'bigsur-dark' },
	{ id: 'ventura', name: 'Ventura', light: 'ventura-light', dark: 'ventura-dark' },
	{ id: 'sonoma', name: 'Sonoma', light: 'sonoma-light', dark: 'sonoma-dark' },
	{ id: 'sequoia', name: 'Sequoia', light: 'sequoia-light', dark: 'sequoia-dark' },
	{ id: 'tahoe', name: 'Tahoe', light: 'tahoe-light', dark: 'tahoe-dark' },
] as const satisfies readonly Wallpaper[];

/** iOS 26 기본 배경화면 (모바일 홈 화면) */
export const IOS_WALLPAPERS = [
	{ id: 'sky', name: 'Sky', light: 'ios-sky-light', dark: 'ios-sky-dark' },
	{ id: 'shadow', name: 'Shadow', light: 'ios-shadow-light', dark: 'ios-shadow-dark' },
	{ id: 'halo', name: 'Halo', light: 'ios-halo-light', dark: 'ios-halo-dark' },
	{ id: 'dusk', name: 'Dusk', light: 'ios-dusk-light', dark: 'ios-dusk-dark' },
] as const satisfies readonly Wallpaper[];

export type WallpaperId = (typeof MAC_WALLPAPERS)[number]['id'];
export type MobileWallpaperId = (typeof IOS_WALLPAPERS)[number]['id'];

export interface Settings {
	theme: ThemePreference;
	/** 데스크톱(macOS) 배경화면 */
	wallpaper: WallpaperId;
	/** 모바일(iOS) 홈 화면 배경화면 */
	mobileWallpaper: MobileWallpaperId;
}

export const DEFAULT_SETTINGS: Settings = { theme: 'system', wallpaper: 'sierra', mobileWallpaper: 'sky' };

const THEMES: readonly ThemePreference[] = ['light', 'dark', 'system'];

/** 저장된 값이 깨졌거나 예전 형식이어도 안전한 설정을 돌려준다. */
export function parseSettings(raw: unknown): Settings {
	const value = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<Record<keyof Settings, unknown>>;
	return {
		theme: THEMES.includes(value.theme as ThemePreference) ? (value.theme as ThemePreference) : DEFAULT_SETTINGS.theme,
		// 예전 배경화면(그라데이션)처럼 없는 id는 기본값으로
		wallpaper: MAC_WALLPAPERS.some((wallpaper) => wallpaper.id === value.wallpaper)
			? (value.wallpaper as WallpaperId)
			: DEFAULT_SETTINGS.wallpaper,
		mobileWallpaper: IOS_WALLPAPERS.some((wallpaper) => wallpaper.id === value.mobileWallpaper)
			? (value.mobileWallpaper as MobileWallpaperId)
			: DEFAULT_SETTINGS.mobileWallpaper,
	};
}

/** '시스템 설정 따르기'를 실제 테마로 바꾼다. */
export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
	if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
	return preference;
}

/** 배경화면 이미지 주소. 어두운 버전이 있으면 화면 모드를 따른다 */
export function wallpaperUrl(wallpaper: Wallpaper, theme: ResolvedTheme, thumbnail = false): string {
	const file = theme === 'dark' && wallpaper.dark ? wallpaper.dark : wallpaper.light;
	return `${WALLPAPER_DIR}/${thumbnail ? 'thumbs/' : ''}${file}.jpg`;
}

const findWallpaper = <W extends Wallpaper>(list: readonly W[], id: string): W =>
	list.find((w) => w.id === id) ?? list[0];

/** 설정과 화면 모드로 CSS 배경 값을 만든다 (데스크톱, 모바일) */
export function wallpaperCss(settings: Settings, theme: ResolvedTheme): { desktop: string; mobile: string } {
	return {
		desktop: `url('${wallpaperUrl(findWallpaper(MAC_WALLPAPERS, settings.wallpaper), theme)}')`,
		mobile: `url('${wallpaperUrl(findWallpaper(IOS_WALLPAPERS, settings.mobileWallpaper), theme)}')`,
	};
}
