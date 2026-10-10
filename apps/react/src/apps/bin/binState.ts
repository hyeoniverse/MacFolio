// Dock의 휴지통이 비었는지: 이 사이트가 이 브라우저에 남긴 것이 없으면 빈 휴지통 그림 (macOS처럼)
import { useSyncExternalStore } from 'react';
import { createStore } from '@macfolio/desktop-core';
import { settingsStore } from '@/shared/settings/settingsStore';
import { readBrowserData } from './siteStorage';

/** 앱들이 localStorage에 직접 쓰므로(같은 탭에서는 storage 이벤트가 오지 않는다) 이 간격으로 다시 본다. 키 몇 개만 읽는다 */
const RECHECK_MS = 2000;

const binStore = createStore<{ empty: boolean }>({ empty: true });

/** 지금 비었는지 다시 본다 (휴지통에서 비운 직후처럼 바로 바꿔야 할 때 부른다) */
export function refreshBin() {
	const empty = readBrowserData().length === 0;
	if (binStore.getState().empty !== empty) binStore.setState({ empty });
}

let watching = false;
function watch() {
	if (watching) return;
	watching = true;
	refreshBin();
	settingsStore.subscribe(() => queueMicrotask(refreshBin));
	window.addEventListener('storage', refreshBin);
	window.setInterval(() => {
		if (document.visibilityState === 'visible') refreshBin();
	}, RECHECK_MS);
}

export function useBinEmpty() {
	watch();
	return useSyncExternalStore(binStore.subscribe, () => binStore.getState().empty);
}
