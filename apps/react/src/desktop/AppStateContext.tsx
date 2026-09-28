import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { APP_MANIFEST, APP_NAMES, AppName } from '@/apps/manifest';
import { bringToFront } from '@/desktop/appStack';

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
	openApp: (appName: AppName) => void;

	minimizeApp: (appName: AppName) => void;
	maximizeApp: (appName: AppName) => void;

	bringAppToFront: (appName: AppName) => void; // 앱을 맨 위로 올리는 함수
}

// Default initial states for all apps
const initialAppStates = Object.fromEntries(
	APP_NAMES.map((name) => [
		name,
		{
			isRunning: APP_MANIFEST[name].runningAtStart ?? false,
			isMinimized: false,
			zIndex: 1,
			hasOpened: APP_MANIFEST[name].runningAtStart ?? false,
		},
	])
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
	const [apps, setApps] = useState<Record<AppName, AppState>>(initialAppStates);

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

	const openApp = useCallback((appName: AppName) => {
		setApps((prevState) => ({
			...prevState,
			[appName]: {
				...prevState[appName],
				isRunning: true,
				isMinimized: false,
				hasOpened: true,
			},
		}));
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

	return (
		<AppContext.Provider
			value={{
				apps,
				toggleAppState,
				toggleAppSize,
				closeApp,
				openApp,
				minimizeApp,
				maximizeApp,
				bringAppToFront,
			}}
		>
			{children}
		</AppContext.Provider>
	);
};
