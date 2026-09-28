import { useSyncExternalStore } from 'react';
import { createStore } from '@/shared/lib/createStore';
import type { AppName } from '@/apps/manifest';

interface SwitcherState {
	/** 앱 전환기가 열려 있는지 */
	open: boolean;
	/** 카드를 골라 돌아온 앱. 이 앱은 아이콘에서 열리는 애니메이션 대신 카드에서 커진다 */
	switchedTo: AppName | null;
}

/** 모바일 앱 전환기 (홈 인디케이터를 길게 쓸어 올리면 열린다) */
export const switcherStore = createStore<SwitcherState>({ open: false, switchedTo: null });

export const openSwitcher = () => {
	setSwitcherScroll(0);
	switcherStore.setState({ open: true, switchedTo: null });
};

export const closeSwitcher = (switchedTo: AppName | null = null) => switcherStore.setState({ open: false, switchedTo });

export function useSwitcherOpen(): boolean {
	return useSyncExternalStore(switcherStore.subscribe, () => switcherStore.getState().open);
}

/**
 * 카드를 옆으로 끈 거리. 끄는 동안 렌더링하지 않도록 React 상태 대신 CSS 변수에 둔다.
 */
export function setSwitcherScroll(px: number) {
	document.documentElement.style.setProperty('--switcher-scroll', `${px}px`);
}

export function getSwitcherScroll(): number {
	return parseFloat(document.documentElement.style.getPropertyValue('--switcher-scroll')) || 0;
}
