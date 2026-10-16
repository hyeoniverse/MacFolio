import React, { useState, ReactNode, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
	activeApp as activeAppOf,
	createWindowStore,
	foregroundApp,
	initialWindows,
	type WindowStore,
} from '@macfolio/desktop-core';
import { track } from '@/shared/analytics/analytics';
import { newlyOpened, trackItemViews } from '@/shared/analytics/usage';
import { appAddresses, linkedApp, syncAddressBar } from '@/shared/lib/appLink';
import { APP_MANIFEST, APP_NAMES, AppName } from '@/apps/manifest';
import { isMobileViewport } from '@/desktop/layout';
import { takeAppsSavedBeforeLeaving, trackApps } from '@/desktop/appsBeforeLeaving';
import { AppContext } from '@/desktop/useAppState';
import { getViewport } from '@/shared/hooks/useViewport';

/**
 * 처음 창 상태. 모바일은 홈 화면에서 시작하므로 처음부터 실행되는 앱이 없다.
 * 앱 항목 주소(/memo/<글>, /safari/<프로젝트>)로 들어오면 그 앱을 맨 앞에 열어 둔다 (항목은 그 앱이 연다).
 * 로그인하러 떠났다 돌아왔으면 켜 두었던 앱을 그대로
 */
const createAppWindowStore = (): WindowStore<AppName> => {
	const mobile = isMobileViewport(getViewport());
	const initial = initialWindows(APP_NAMES, {
		linked: linkedApp(),
		runningAtStart: (name) => !mobile && (APP_MANIFEST[name].runningAtStart ?? false),
	});
	return createWindowStore(takeAppsSavedBeforeLeaving(mobile, initial) ?? initial);
};

// Context provider component
export const AppStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
	const [store] = useState(createAppWindowStore);
	const state = useSyncExternalStore(store.subscribe, store.getState);
	const { apps } = state;

	useEffect(() => {
		trackApps(isMobileViewport(getViewport()), apps);
	}, [apps]);

	// 트래픽 분석 (#102): 새로 연 앱과, 앱이 보여 주는 글·프로젝트. 처음 떠 있는 창은 연 것으로 치지 않는다
	const appsBefore = useRef(apps);
	useEffect(() => {
		for (const app of newlyOpened(appsBefore.current, apps)) track({ type: 'app', app });
		appsBefore.current = apps;
	}, [apps]);
	useEffect(() => trackItemViews(), []);

	// 주소 막대: 맨 앞 창이 가리키는 항목 (메모의 글, Safari의 프로젝트). 창이 없거나 주소가 없는 앱이면 사이트 주소
	useEffect(() => {
		syncAddressBar(foregroundApp(apps));
		return appAddresses.subscribe(() => syncAddressBar(foregroundApp(apps)));
	}, [apps]);

	// 화면 밖 창을 되돌리는 처리는 창이 렌더링될 때 한다 (desktop/window/geometry.ts의 clampRect)
	const actions = useMemo(
		() => ({
			toggleAppState: store.toggleRunning,
			toggleAppSize: store.toggleMinimized,
			closeApp: store.close,
			quitApp: store.quit,
			openApp: store.open,
			minimizeApp: store.minimize,
			maximizeApp: store.restore,
			bringAppToFront: store.bringToFront,
			focusDesktop: store.focusDesktop,
			goHome: store.goHome,
		}),
		[store]
	);

	return (
		<AppContext.Provider value={{ apps, activeApp: activeAppOf(state), ...actions }}>{children}</AppContext.Provider>
	);
};
