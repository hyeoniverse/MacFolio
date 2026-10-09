// 창 상태: 어떤 앱이 켜져 있고, 최소화됐고, 어떤 순서로 쌓였는지. 창 위치·크기는 각 창이 따로 다룬다
import { createStore } from '../store.js';
import { bringToFront, foregroundApp, minimizeAll } from './stack.js';

export interface AppWindow {
	isRunning: boolean;
	isMinimized: boolean;
	zIndex: number;
	/** 한 번이라도 열린 적이 있는지. 처음 열 때부터 앱을 렌더링한다 (지연 로딩 앱은 이때 코드를 불러온다) */
	hasOpened: boolean;
}

export type AppWindows<Name extends string> = Record<Name, AppWindow>;

export interface WindowState<Name extends string> {
	apps: AppWindows<Name>;
	/** 창 밖(바탕화면·메뉴 막대·Dock)을 눌렀는지. 창을 누르거나 앱을 열면 다시 false */
	desktopFocused: boolean;
}

/**
 * 지금 쓰고 있는 앱 (메뉴 막대의 앱 이름). 맨 앞 창의 앱이고, 창이 없거나 창 밖을 누른 뒤에는 null
 * (macOS에서 바탕화면을 누르면 Finder가 앞으로 오는 것처럼). 창 순서는 그대로 둔다
 */
export const activeApp = <Name extends string>(state: WindowState<Name>): Name | null =>
	state.desktopFocused ? null : foregroundApp(state.apps);

export function createWindowStore<Name extends string>(apps: AppWindows<Name>) {
	const store = createStore<WindowState<Name>>({ apps, desktopFocused: false });
	const update = (change: (apps: AppWindows<Name>) => AppWindows<Name>, desktopFocused?: boolean) =>
		store.setState((state) => ({
			apps: change(state.apps),
			desktopFocused: desktopFocused ?? state.desktopFocused,
		}));
	const patch = (name: Name, change: Partial<AppWindow>) =>
		update((apps) => ({ ...apps, [name]: { ...apps[name], ...change } }));

	return {
		getState: store.getState,
		subscribe: store.subscribe,
		/** Dock 아이콘처럼 켜고 끈다. 켤 때는 최소화를 푼다 */
		toggleRunning: (name: Name) =>
			update((apps) => ({
				...apps,
				[name]: { ...apps[name], isRunning: !apps[name].isRunning, isMinimized: false, hasOpened: true },
			})),
		toggleMinimized: (name: Name) =>
			update((apps) => ({ ...apps, [name]: { ...apps[name], isMinimized: !apps[name].isMinimized } })),
		/** 여는 앱은 늘 맨 앞에 (다른 창이 떠 있을 때 열어도 뒤에 숨지 않게) */
		open: (name: Name) =>
			update((apps) => {
				const fronted = bringToFront(apps, name);
				return { ...fronted, [name]: { ...fronted[name], isRunning: true, hasOpened: true } };
			}, false),
		/** 창만 닫는다. 앱 상태(입력 중인 글 등)는 남는다 */
		close: (name: Name) => patch(name, { isRunning: false }),
		/**
		 * 앱을 완전히 끈다 (모바일 앱 전환기에서 밀어 올려 닫기). close와 달리 앱을 내려서 입력 중인 글 같은 상태도
		 * 사라진다. 다음에 열면 처음부터 시작한다
		 */
		quit: (name: Name) => patch(name, { isRunning: false, isMinimized: false, hasOpened: false }),
		minimize: (name: Name) => patch(name, { isMinimized: true }),
		restore: (name: Name) => patch(name, { isMinimized: false }),
		/** 창을 맨 앞으로 (최소화돼 있었으면 되살린다) */
		bringToFront: (name: Name) => update((apps) => bringToFront(apps, name), false),
		/** 창 밖을 눌렀다. 창이나 앱을 다시 누르거나 열 때까지 activeApp은 null */
		focusDesktop: () => store.setState((state) => (state.desktopFocused ? state : { ...state, desktopFocused: true })),
		/** 실행 중인 앱을 모두 최소화한다 (모바일에서 홈 화면으로) */
		goHome: () => update(minimizeAll),
	};
}

export type WindowStore<Name extends string> = ReturnType<typeof createWindowStore<Name>>;
