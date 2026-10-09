// GitHub 로그인처럼 페이지를 떠났다 돌아올 때, 켜 두었던 앱을 그대로 되살린다.
// 창 위치·크기는 이미 localStorage에 남으므로(useWindowFrame) 여기서는 어떤 앱이 켜져 있었는지만 다룬다.
import { restoreWindows } from '@macfolio/desktop-core';
import type { AppName } from '@/apps/manifest';
import type { AppState } from '@/desktop/useAppState';

const STORAGE_KEY = 'macfolio:apps-before-leaving';

interface Saved {
	mobile: boolean;
	apps: Record<AppName, AppState>;
}

let current: Saved | null = null;

/** 지금 앱 상태를 알려 둔다 (AppStateProvider가 바뀔 때마다 부른다) */
export function trackApps(mobile: boolean, apps: Record<AppName, AppState>) {
	current = { mobile, apps };
}

/** 페이지를 떠나기 직전에 부른다 */
export function saveAppsBeforeLeaving() {
	if (!current) return;
	try {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(current));
	} catch {
		// 저장하지 못하면 처음 화면으로 돌아올 뿐이다
	}
}

/**
 * 떠나기 전에 남긴 앱 상태를 한 번만 꺼낸다. 없거나, 화면 종류(데스크톱/모바일)가 바뀌었으면 null.
 * 앱 목록이 그사이 바뀌었을 수 있어서 아는 앱만 initial 위에 덮는다.
 */
export function takeAppsSavedBeforeLeaving(
	mobile: boolean,
	initial: Record<AppName, AppState>
): Record<AppName, AppState> | null {
	let saved: Saved | null;
	try {
		saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null') as Saved | null;
		sessionStorage.removeItem(STORAGE_KEY);
	} catch {
		return null;
	}
	if (!saved || saved.mobile !== mobile) return null;
	return restoreWindows(initial, saved.apps);
}
