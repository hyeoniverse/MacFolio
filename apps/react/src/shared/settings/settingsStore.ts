import { useSyncExternalStore } from 'react';
import { createStore } from '@/shared/lib/createStore';
import { parseSettings, resolveTheme, wallpaperCss, type Settings } from '@/shared/settings/settings';

/** index.html의 깜빡임 방지 스크립트도 이 키를 읽는다 */
export const SETTINGS_STORAGE_KEY = 'macfolio:settings';

function load(): Settings {
	try {
		return parseSettings(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? 'null'));
	} catch {
		return parseSettings(null);
	}
}

export const settingsStore = createStore<Settings>(load());

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

/** 설정을 문서에 반영한다: <html data-theme>, 배경화면 CSS 변수 */
function apply(settings: Settings) {
	const root = document.documentElement;
	const theme = resolveTheme(settings.theme, darkQuery().matches);
	root.dataset.theme = theme;
	const wallpaper = wallpaperCss(settings, theme);
	root.style.setProperty('--wallpaper', wallpaper.desktop);
	root.style.setProperty('--wallpaper-mobile', wallpaper.mobile);
}

/** 앱 시작 시 한 번 호출한다. 설정이 바뀌거나 시스템 테마가 바뀌면 다시 반영한다. */
export function initSettings() {
	apply(settingsStore.getState());
	settingsStore.subscribe((settings) => {
		apply(settings);
		try {
			localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
		} catch {
			// 저장하지 못해도 이번 방문 동안은 적용된다
		}
	});
	darkQuery().addEventListener('change', () => apply(settingsStore.getState()));
}

export function useSettings(): Settings {
	return useSyncExternalStore(settingsStore.subscribe, settingsStore.getState);
}
