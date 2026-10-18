import { createContext, useContext } from 'react';
import type { AppWindow } from '@macfolio/desktop-core';
import type { AppName } from '@/apps/manifest';

// 창 상태와 동작은 desktop-core의 창 store가 갖고, 여기서는 React에 연결만 한다 (#16)
export type AppState = AppWindow;

export interface AppContextType {
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
	/**
	 * 앱이 실행 중인지 (Dock의 점): 끌 수 없는 앱(Finder), 창이 있는 앱, 창 없이 살아 있는 앱(keepAlive).
	 * apps[name].isRunning은 '창이 있다'는 뜻이라 실행 중인지는 이것으로 본다
	 */
	isAppRunning: (appName: AppName) => boolean;
	/** 창 없이도 실행 중으로 둔다 (음악이 재생을 시작하면). 빨간 버튼으로 닫거나 종료하면 꺼진다 */
	keepAlive: (appName: AppName, on: boolean) => void;

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

export const AppContext = createContext<AppContextType | undefined>(undefined);

// Custom hook to use the context
export const useAppState = () => {
	const context = useContext(AppContext);
	if (!context) {
		throw new Error('useAppState must be used within AppStateProvider');
	}
	return context;
};
