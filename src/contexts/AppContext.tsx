import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

// Define app names and states
export type AppName =
	| 'finder'
	| 'music'
	| 'safari'
	| 'photos'
	| 'messages'
	| 'memo'
	| 'github'
	| 'blog'
	| 'notion'
	| 'mail'
	| 'share'
	| 'settings'
	| 'bin';

export type AppState = {
	isRunning: boolean;
	isMinimized: boolean;
	zIndex: number;
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
const initialAppStates: Record<AppName, AppState> = {
	finder: { isRunning: true, isMinimized: false, zIndex: 1 },
	music: { isRunning: true, isMinimized: false, zIndex: 1 },
	safari: { isRunning: true, isMinimized: false, zIndex: 1 },
	photos: { isRunning: false, isMinimized: false, zIndex: 1 },
	messages: { isRunning: false, isMinimized: false, zIndex: 1 },
	memo: { isRunning: false, isMinimized: false, zIndex: 1 },
	github: { isRunning: false, isMinimized: false, zIndex: 1 },
	blog: { isRunning: false, isMinimized: false, zIndex: 1 },
	notion: { isRunning: false, isMinimized: false, zIndex: 1 },
	mail: { isRunning: false, isMinimized: false, zIndex: 1 },
	share: { isRunning: false, isMinimized: false, zIndex: 1 },
	settings: { isRunning: false, isMinimized: false, zIndex: 1 },
	bin: { isRunning: false, isMinimized: false, zIndex: 1 },
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
	const [apps, setApps] = useState<Record<AppName, AppState>>(initialAppStates);

	const bringAppToFront = useCallback((appName: AppName) => {
		setApps((prevState) => {
			const updatedApps = { ...prevState };

			// Step 1: zIndex를 정렬하여 target app이 최상위가 되도록 설정
			const sortedApps = Object.entries(updatedApps).sort(([, a], [, b]) => a.zIndex - b.zIndex);
			sortedApps.forEach(([name], index) => {
				updatedApps[name as AppName].zIndex = index;
			});
			updatedApps[appName].zIndex = sortedApps.length; // Bring to front

			// Step 2: 앱이 최소화된 상태라면 복원
			if (updatedApps[appName].isMinimized) {
				updatedApps[appName].isMinimized = false;
			}

			// Step 3: 화면 밖에 있으면 중앙으로 이동
			setTimeout(() => {
				const appElement = document.getElementById(`app-${appName}`);
				if (appElement) {
					const rect = appElement.getBoundingClientRect();
					const isOutOfBounds =
						rect.right < 0 ||
						rect.left > window.innerWidth ||
						rect.bottom < 0 ||
						rect.top > window.innerHeight;

					if (isOutOfBounds) {
						appElement.style.transition = 'transform 0.5s ease-in-out';
						appElement.style.transform = `translate(${window.innerWidth / 2 - rect.width / 2}px, 
                                                            ${window.innerHeight / 2 - rect.height / 2}px)`;
					}
				}
			}, 100);

			return updatedApps;
		});
	}, []);

	const toggleAppState = useCallback((appName: AppName) => {
		setApps((prevState) => ({
			...prevState,
			[appName]: {
				...prevState[appName],
				isRunning: !prevState[appName].isRunning,
				isMinimized: false, // 항상 실행되면 최대화 상태로 변경
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
			},
		}));
	}, []);

	const maximizeApp = useCallback((appName: AppName) => {
		setApps((prevState) => ({
			...prevState,
			[appName]: {
				...prevState[appName],
				isMinimized: false,
				isMaximized: true, // isMaximized 상태 추가
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
