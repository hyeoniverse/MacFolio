// 프레임워크에 의존하지 않는 데스크톱 로직 (#16). React 쪽은 store를 useSyncExternalStore로 구독한다
export { createStore, type Store } from './store';
export {
	bringToFront,
	foregroundApp,
	minimizeAll,
	runningByRecency,
	type RunningApp,
	type StackedApp,
} from './window/stack';
export {
	activeApp,
	createWindowStore,
	type AppWindow,
	type AppWindows,
	type WindowState,
	type WindowStore,
} from './window/windowStore';
export { initialWindows, restoreWindows } from './window/initialWindows';
