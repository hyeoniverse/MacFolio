import { useSyncExternalStore } from 'react';
import { createStore } from '@macfolio/desktop-core';
import type { AppName } from '@/apps/manifest';

export interface Notice {
	id: number;
	/** 알림을 보낸 앱 (아이콘과 이름) */
	app: AppName;
	title: string;
	body: string;
	/** 사라지는 애니메이션 중 */
	leaving: boolean;
}

/** 알림이 떠 있는 시간 */
const DURATION_MS = 3500;
/** 사라지는 애니메이션 시간 (Notifications.css와 같아야 한다) */
const LEAVE_MS = 250;

const store = createStore<{ items: Notice[] }>({ items: [] });
let nextId = 1;

/** 알림을 띄운다. macOS에서는 오른쪽 위, iOS에서는 위쪽 가운데에 배너로 나타난다 */
export function notify(notice: Omit<Notice, 'id' | 'leaving'>): number {
	const id = nextId++;
	store.setState((state) => ({ items: [...state.items, { ...notice, id, leaving: false }] }));
	setTimeout(() => dismiss(id), DURATION_MS);
	return id;
}

/** 알림을 닫는다 (사라지는 애니메이션 뒤에 목록에서 뺀다) */
export function dismiss(id: number) {
	if (!store.getState().items.some((item) => item.id === id && !item.leaving)) return;
	store.setState((state) => ({
		items: state.items.map((item) => (item.id === id ? { ...item, leaving: true } : item)),
	}));
	setTimeout(() => store.setState((state) => ({ items: state.items.filter((item) => item.id !== id) })), LEAVE_MS);
}

export function useNotifications(): Notice[] {
	return useSyncExternalStore(store.subscribe, () => store.getState().items);
}
