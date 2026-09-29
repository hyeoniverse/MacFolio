import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { APP_MANIFEST, APP_NAMES, AppName } from '@/apps/manifest';
import { bringToFront, minimizeAll } from '@/desktop/appStack';
import { isMobileViewport } from '@/desktop/layout';
import { takeAppsSavedBeforeLeaving, trackApps } from '@/desktop/appsBeforeLeaving';

export type AppState = {
	isRunning: boolean;
	isMinimized: boolean;
	zIndex: number;
	/** 한 번이라도 열린 적이 있는지. 처음 열 때부터 앱을 렌더링한다 (지연 로딩 앱은 이때 코드를 불러온다) */
	hasOpened: boolean;
};

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

	/** 실행 중인 앱을 모두 최소화한다. 모바일에서 홈 화면으로 돌아갈 때 쓴다. */
	goHome: () => void;
}

/** 처음 상태. 모바일은 홈 화면에서 시작하므로 처음부터 실행되는 앱이 없다. */
const createInitialAppStates = (mobile: boolean) =>
	Object.fromEntries(
		APP_NAMES.map((name) => {
			const running = !mobile && (APP_MANIFEST[name].runningAtStart ?? false);
			return [name, { isRunning: running, isMinimized: false, zIndex: 1, hasOpened: running }];
		})
	) as Record<AppName, AppState>;

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
	const [apps, setApps] = useState<Record<AppName, AppState>>(() => {
		const mobile = isMobileViewport({ width: window.innerWidth, height: window.innerHeight });
		const initial = createInitialAppStates(mobile);
		// 로그인하러 떠났다 돌아왔으면 켜 두었던 앱을 그대로
		return takeAppsSavedBeforeLeaving(mobile, initial) ?? initial;
	});

	useEffect(() => {
		trackApps(isMobileViewport({ width: window.innerWidth, height: window.innerHeight }), apps);
	}, [apps]);

	// 화면 밖 창을 되돌리는 처리는 창이 렌더링될 때 한다 (desktop/window/geometry.ts의 clampRect)
	const bringAppToFront = useCallback((appName: AppName) => {
		setApps((prevState) => bringToFront(prevState, appName));
	}, []);

	const toggleAppState = useCallback((appName: AppName) => {
		setApps((prevState) => ({
			...prevState,
			[appName]: {
				...prevState[appName],
				isRunning: !prevState[appName].isRunning,
				isMinimized: false, // 항상 실행되면 최대화 상태로 변경
				hasOpened: true,
			},
		}));
	}, []);

	const toggleAppSize = useCallback((appName: AppName) => {
		setApps((prevState) => ({
			...prevState,
			[appName]: {
				...prevState[appName],
				isMinimized: !prevState[appName].isMinimized,
			},
		}));
	}, []);

	const closeApp = useCallback((appName: AppName) => {
		setApps((prevState) => ({
			...prevState,
			[appName]: {
				...prevState[appName],
				isRunning: false,
			},
		}));
	}, []);

	const quitApp = useCallback((appName: AppName) => {
		setApps((prevState) => ({
			...prevState,
			[appName]: { ...prevState[appName], isRunning: false, isMinimized: false, hasOpened: false },
		}));
	}, []);

	// 여는 앱은 늘 맨 앞에 (Apple 메뉴의 시스템 설정처럼 다른 창이 떠 있을 때 열어도 뒤에 숨지 않게)
	const openApp = useCallback((appName: AppName) => {
		setApps((prevState) => {
			const fronted = bringToFront(prevState, appName);
			return { ...fronted, [appName]: { ...fronted[appName], isRunning: true, hasOpened: true } };
		});
	}, []);

	const maximizeApp = useCallback((appName: AppName) => {
		setApps((prevState) => ({
			...prevState,
			[appName]: {
				...prevState[appName],
				isMinimized: false,
			},
		}));
	}, []);

	const minimizeApp = useCallback((appName: AppName) => {
		setApps((prevState) => ({
			...prevState,
			[appName]: {
				...prevState[appName],
				isMinimized: true,
			},
		}));
	}, []);

	const goHome = useCallback(() => {
		setApps((prevState) => minimizeAll(prevState));
	}, []);

	return (
		<AppContext.Provider
			value={{
				apps,
				toggleAppState,
				toggleAppSize,
				closeApp,
				quitApp,
				openApp,
				minimizeApp,
				maximizeApp,
				bringAppToFront,
				goHome,
			}}
		>
			{children}
		</AppContext.Provider>
	);
};
