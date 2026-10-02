// 사용자 설정(화면 모드, 배경화면, 소리). React와 DOM에 의존하지 않는 순수 코드만 둔다.

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

/** 역대 iOS 기본 배경화면 (모바일 홈 화면). 버전마다 분위기가 다른 것으로 골랐다 */
export const IOS_WALLPAPERS = [
	{ id: 'celosia', name: 'iOS 27', light: 'ios-celosia-light', dark: 'ios-celosia-dark' },
	{ id: 'sky', name: 'iOS 26', light: 'ios-sky-light', dark: 'ios-sky-dark' },
	{ id: 'ios18', name: 'iOS 18', light: 'ios-18-light', dark: 'ios-18-dark' },
	{ id: 'kaleidoscope', name: 'iOS 17', light: 'ios-kaleidoscope-light', dark: 'ios-kaleidoscope-dark' },
	{ id: 'earth', name: 'iOS 16', light: 'ios-earth' },
	{ id: 'ios14', name: 'iOS 14', light: 'ios-14-light', dark: 'ios-14-dark' },
] as const satisfies readonly Wallpaper[];

export type WallpaperId = (typeof MAC_WALLPAPERS)[number]['id'];
export type MobileWallpaperId = (typeof IOS_WALLPAPERS)[number]['id'];
/** 관리자가 더한 배경화면 (서버의 /wallpapers). 기본 배경화면과 겹치지 않게 앞에 custom:을 붙인다 */
export type CustomWallpaperId = `custom:${string}`;

export const isCustomWallpaperId = (id: unknown): id is CustomWallpaperId =>
	typeof id === 'string' && /^custom:[\w-]{1,64}$/.test(id);

/** CSS url('…')에 그대로 넣어도 되는 이미지 주소 (따옴표·괄호·공백이 없는 http(s)) */
export const isSafeImageUrl = (url: unknown): url is string =>
	typeof url === 'string' && /^https?:\/\/[^\s'"()\\]+$/.test(url);

export interface Settings {
	theme: ThemePreference;
	/** 데스크톱(macOS) 배경화면 */
	wallpaper: WallpaperId | CustomWallpaperId;
	/** 모바일(iOS) 홈 화면 배경화면 */
	mobileWallpaper: MobileWallpaperId | CustomWallpaperId;
	/**
	 * 더한 배경화면을 골랐을 때 그 이미지 주소. 다음에 열 때 서버에 목록을 묻기 전에도 바로 그린다.
	 * 기본 배경화면이면 null
	 */
	wallpaperImage: string | null;
	mobileWallpaperImage: string | null;
	/** 누르고 뗄 때 딸깍 소리 */
	clickSound: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
	theme: 'system',
	wallpaper: 'sierra',
	mobileWallpaper: 'sky',
	wallpaperImage: null,
	mobileWallpaperImage: null,
	clickSound: true,
};

const THEMES: readonly ThemePreference[] = ['light', 'dark', 'system'];

function pickWallpaper<Id extends string>(
	list: readonly { id: Id }[],
	id: unknown,
	image: unknown,
	fallback: Id
): { id: Id | CustomWallpaperId; image: string | null } {
	if (isCustomWallpaperId(id) && isSafeImageUrl(image)) return { id, image };
	if (list.some((wallpaper) => wallpaper.id === id)) return { id: id as Id, image: null };
	return { id: fallback, image: null };
}

/** 저장된 값이 깨졌거나 예전 형식이어도 안전한 설정을 돌려준다. */
export function parseSettings(raw: unknown): Settings {
	const value = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<Record<keyof Settings, unknown>>;
	// 더한 배경화면은 이미지 주소가 함께 있어야 그린다. 예전 배경화면(그라데이션)처럼 없는 id는 기본값으로
	const desktop = pickWallpaper(MAC_WALLPAPERS, value.wallpaper, value.wallpaperImage, DEFAULT_SETTINGS.wallpaper);
	const mobile = pickWallpaper(
		IOS_WALLPAPERS,
		value.mobileWallpaper,
		value.mobileWallpaperImage,
		DEFAULT_SETTINGS.mobileWallpaper
	);
	return {
		theme: THEMES.includes(value.theme as ThemePreference) ? (value.theme as ThemePreference) : DEFAULT_SETTINGS.theme,
		wallpaper: desktop.id,
		mobileWallpaper: mobile.id,
		wallpaperImage: desktop.image,
		mobileWallpaperImage: mobile.image,
		clickSound: typeof value.clickSound === 'boolean' ? value.clickSound : DEFAULT_SETTINGS.clickSound,
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

const cssFor = (list: readonly Wallpaper[], id: string, image: string | null, theme: ResolvedTheme) =>
	`url('${isCustomWallpaperId(id) && isSafeImageUrl(image) ? image : wallpaperUrl(findWallpaper(list, id), theme)}')`;

/** 설정과 화면 모드로 CSS 배경 값을 만든다 (데스크톱, 모바일). 더한 배경화면은 화면 모드와 상관없이 한 장 */
export function wallpaperCss(settings: Settings, theme: ResolvedTheme): { desktop: string; mobile: string } {
	return {
		desktop: cssFor(MAC_WALLPAPERS, settings.wallpaper, settings.wallpaperImage, theme),
		mobile: cssFor(IOS_WALLPAPERS, settings.mobileWallpaper, settings.mobileWallpaperImage, theme),
	};
}
