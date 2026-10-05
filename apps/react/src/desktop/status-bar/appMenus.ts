// 앱이 메뉴 막대에 내놓는 메뉴. 앱이 열려 있는(마운트된) 동안 등록하고, 내려가면 지운다 (#96).
// 메뉴의 동작은 앱 안의 상태에 있어서, 상태를 바깥으로 꺼내지 않고 앱이 직접 등록한다.
// 메뉴 막대는 지금 쓰는 앱(activeApp)의 메뉴와 공통 메뉴를 합쳐 그린다 (menuBar.ts)
import { useEffect, useSyncExternalStore } from 'react';
import type { AppName } from '@/apps/manifest';
import { createStore } from '@/shared/lib/createStore';
import type { MenuItem } from '@/shared/ui/menu/Menu';

/** 메뉴 하나: 제목과 항목. 제목이 공통 제목(파일·편집·보기·이동)이면 그 메뉴에 합쳐지고, 아니면 앱만의 메뉴가 된다 (예: 음악의 '제어') */
export interface AppMenu {
	title: string;
	items: MenuItem[];
}

const menuStore = createStore<Partial<Record<AppName, AppMenu[]>>>({});

/** 앱의 메뉴를 등록한다. menus가 바뀔 때마다 다시 등록하므로, 항목의 체크·비활성 상태를 그대로 보여 준다 */
export function useAppMenus(app: AppName, menus: AppMenu[]) {
	useEffect(() => {
		menuStore.setState((current) => ({ ...current, [app]: menus }));
	}, [app, menus]);

	useEffect(
		() => () =>
			menuStore.setState((current) => {
				const next = { ...current };
				delete next[app];
				return next;
			}),
		[app]
	);
}

/** 등록된 메뉴 (메뉴 막대가 읽는다) */
export const useRegisteredMenus = () => useSyncExternalStore(menuStore.subscribe, menuStore.getState);
