import React, {
	createContext,
	useContext,
	useState,
	ReactNode,
	useEffect,
	useMemo,
	useRef,
	useSyncExternalStore,
} from 'react';
import {
	activeApp as activeAppOf,
	createWindowStore,
	foregroundApp,
	initialWindows,
	type AppWindow,
	type WindowStore,
} from '@macfolio/desktop-core';
import { track } from '@/shared/analytics/analytics';
import { newlyOpened, trackItemViews } from '@/shared/analytics/usage';
import { appAddresses, linkedApp, syncAddressBar } from '@/shared/lib/appLink';
import { APP_MANIFEST, APP_NAMES, AppName } from '@/apps/manifest';
import { isMobileViewport } from '@/desktop/layout';
import { takeAppsSavedBeforeLeaving, trackApps } from '@/desktop/appsBeforeLeaving';

// 창 상태와 동작은 desktop-core의 창 store가 갖고, 여기서는 React에 연결만 한다 (#16)
export type AppState = AppWindow;

// Define the structure of the context
interface AppContextType {
	apps: Record<AppName, AppState>;
	toggleAppState: (appName: AppName) => void;
	toggleAppSize: (appName: AppName) => void;

	closeApp: (appName: AppName) => void;
	/**
	 * 앱을 완전히 끈다 (모바일 앱 전환기에서 밀어 올려 닫기). 창만 닫는 closeApp과 달리
	 * 앱 컴포넌트를 내려서 입력 중인 글 같은 상태도 사라진다. 다음에 열면 처음부터 시작한다.
	 */
	quitApp: (appName: AppName) => void;
	openApp: (appName: AppName) => void;

	minimizeApp: (appName: AppName) => void;
	maximizeApp: (appName: AppName) => void;

	bringAppToFront: (appName: AppName) => void; // 앱을 맨 위로 올리는 함수

	/**
	 * 지금 쓰고 있는 앱 (메뉴 막대의 앱 이름). 맨 앞 창의 앱이고, 창이 없거나 창 밖(바탕화면·메뉴 막대·Dock)을
	 * 누른 뒤에는 null (macOS에서 바탕화면을 누르면 Finder가 앞으로 오는 것처럼). 창 순서는 그대로 둔다
	 */
	activeApp: AppName | null;
	/** 창 밖을 눌렀다. 창이나 앱을 다시 누르거나 열 때까지 activeApp은 null */
	focusDesktop: () => void;

	/** 실행 중인 앱을 모두 최소화한다. 모바일에서 홈 화면으로 돌아갈 때 쓴다. */
	goHome: () => void;
}

/**
 * 처음 창 상태. 모바일은 홈 화면에서 시작하므로 처음부터 실행되는 앱이 없다.
 * 앱 항목 주소(/memo/<글>, /safari/<프로젝트>)로 들어오면 그 앱을 맨 앞에 열어 둔다 (항목은 그 앱이 연다).
 * 로그인하러 떠났다 돌아왔으면 켜 두었던 앱을 그대로
 */
const createAppWindowStore = (): WindowStore<AppName> => {
	const mobile = isMobileViewport({ width: window.innerWidth, height: window.innerHeight });
	const initial = initialWindows(APP_NAMES, {
		linked: linkedApp(),
		runningAtStart: (name) => !mobile && (APP_MANIFEST[name].runningAtStart ?? false),
	});
	return createWindowStore(takeAppsSavedBeforeLeaving(mobile, initial) ?? initial);
};

// Create context
const AppContext = createContext<AppContextType | undefined>(undefined);

// Custom hook to use the context
export const useAppState = () => {
	const context = useContext(AppContext);
	if (!context) {
		throw new Error('useAppState must be used within AppStateProvider');
	}
	return context;
};

// Context provider component
export const AppStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
	const [store] = useState(createAppWindowStore);
	const state = useSyncExternalStore(store.subscribe, store.getState);
	const { apps } = state;

	useEffect(() => {
		trackApps(isMobileViewport({ width: window.innerWidth, height: window.innerHeight }), apps);
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
