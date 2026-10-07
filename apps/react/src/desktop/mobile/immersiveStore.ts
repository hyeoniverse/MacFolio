import { useSyncExternalStore } from 'react';
import { createStore } from '@/shared/lib/createStore';
import type { AppName } from '@/apps/manifest';

/**
 * 화면만 보기 중인 앱 (사진만 보기처럼). 그 앱이 맨 앞이면 상태 표시줄도 숨는다 (iOS).
 * 앱은 MobileNavigation의 immersive로 켜고, MobileAppFrame이 여기에 알린다
 */
const immersiveStore = createStore<{ app: AppName | null }>({ app: null });

export const setImmersiveApp = (app: AppName | null) => immersiveStore.setState({ app });

/** 끝낸 앱이 아직 그 앱일 때만 지운다 (다른 앱이 이미 켰으면 그대로) */
export const clearImmersiveApp = (app: AppName) =>
	immersiveStore.setState((state) => (state.app === app ? { app: null } : state));

export const useImmersiveApp = () =>
	useSyncExternalStore(immersiveStore.subscribe, () => immersiveStore.getState().app);
