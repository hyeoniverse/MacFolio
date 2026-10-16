import { useSyncExternalStore } from 'react';
import { createStore } from '@macfolio/desktop-core';
import { DARK_SCHEME, onMediaChange, prefersDarkScheme, useMediaQuery } from '@/shared/lib/media';
import { readJson, STORAGE_KEYS, writeJson } from '@/shared/lib/storage';
import { parseSettings, resolveTheme, wallpaperCss, type Settings } from '@/shared/settings/settings';
import { fadeOutWallpaper } from '@/shared/settings/wallpaperFade';

export const settingsStore = createStore<Settings>(parseSettings(readJson(STORAGE_KEYS.settings)));

/** 설정을 문서에 반영한다: <html data-theme>, 배경화면 CSS 변수 */
function apply(settings: Settings) {
	const root = document.documentElement;
	const theme = resolveTheme(settings.theme, prefersDarkScheme());
	root.dataset.theme = theme;
	const wallpaper = wallpaperCss(settings, theme);
	// 바뀌면 옛 배경이 흐려지며 새 배경이 드러난다 (처음 그릴 때는 그대로)
	const old = {
		desktop: root.style.getPropertyValue('--wallpaper'),
		mobile: root.style.getPropertyValue('--wallpaper-mobile'),
	};
	if (old.desktop && (old.desktop !== wallpaper.desktop || old.mobile !== wallpaper.mobile)) fadeOutWallpaper(old);
	root.style.setProperty('--wallpaper', wallpaper.desktop);
	root.style.setProperty('--wallpaper-mobile', wallpaper.mobile);
}

/** 앱 시작 시 한 번 호출한다. 설정이 바뀌거나 시스템 테마가 바뀌면 다시 반영한다. */
export function initSettings() {
	apply(settingsStore.getState());
	settingsStore.subscribe((settings) => {
		apply(settings);
		// 저장하지 못해도 이번 방문 동안은 적용된다
		writeJson(STORAGE_KEYS.settings, settings);
	});
	onMediaChange(DARK_SCHEME, () => apply(settingsStore.getState()));
}

export function useSettings(): Settings {
	return useSyncExternalStore(settingsStore.subscribe, settingsStore.getState);
}

/** 실제로 그리는 화면 모드: 설정이 '시스템'이면 시스템 값을 따른다. 설정이나 시스템이 바뀌면 다시 렌더링한다 */
export function useResolvedTheme(): 'light' | 'dark' {
	const { theme } = useSettings();
	return resolveTheme(theme, useMediaQuery(DARK_SCHEME));
}
