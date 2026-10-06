// 메뉴 막대에 놓을 메뉴를 정한다. 순수 함수만 둔다 (#96).
import type { MenuItem } from '@/shared/ui/menu/Menu';
import type { Shortcut } from '@/shared/ui/menu/shortcut';
import type { AppMenu } from '@/desktop/status-bar/appMenus';

/** macOS 메뉴 막대의 공통 제목. 앱만의 메뉴는 '이동' 뒤, '윈도우' 앞에 온다 */
export const COMMON_TITLES = ['파일', '편집', '보기', '이동'] as const;
export const WINDOW_TITLE = '윈도우';
export const HELP_TITLE = '도움말';

/** 공통 항목의 단축키. macOS의 ⌘W·⌘M 대신 ⌥ (브라우저가 ⌘W를 먼저 가져간다) */
export const SHORTCUTS = {
	closeWindow: { code: 'KeyW', alt: true },
	minimize: { code: 'KeyM', alt: true },
} satisfies Record<string, Shortcut>;

/** 메뉴들에서 이 키에 맞는 항목을 찾는다. 앞쪽 메뉴가 먼저다 (Safari의 '탭 닫기' ⌥W가 공통 '윈도우 닫기' ⌥W보다 먼저) */
export function findShortcutItem(
	menus: AppMenu[],
	matches: (shortcut: Shortcut) => boolean
): Extract<MenuItem, { onSelect: () => void }> | null {
	for (const menu of menus)
		for (const item of menu.items)
			if (typeof item === 'object' && 'onSelect' in item && item.shortcut && !item.disabled && matches(item.shortcut))
				return item;
	return null;
}

export interface MenuBarContext {
	/** 앱이 등록한 메뉴 (없으면 []) */
	appMenus: AppMenu[];
	/** 지금 쓰는 앱에 창이 있는지 (창 밖을 눌러 Finder가 되었거나 창이 없으면 false) */
	hasWindow: boolean;
	/** 공통 항목의 동작 (없으면 그 항목을 두지 않는다) */
	actions: {
		copyLink?: () => void;
		closeWindow: () => void;
		minimize: () => void;
		toggleMaximize: () => void;
		toggleDark: () => void;
	};
	dark: boolean;
	/** 열려 있는 창 목록 (윈도우 메뉴 아래쪽). active가 지금 쓰는 창 */
	windows: { label: string; active: boolean; onSelect: () => void }[];
	/** 도움말 메뉴 */
	help: MenuItem[];
}

const join = (...groups: MenuItem[][]): MenuItem[] =>
	groups
		.filter((group) => group.length > 0)
		.flatMap((group, index) => (index === 0 ? group : (['separator', ...group] as MenuItem[])));

/**
 * 메뉴 막대의 메뉴들. 앱이 등록한 항목을 같은 제목의 공통 메뉴 위쪽에 두고, 항목이 하나도 없는 제목은 뺀다
 * (macOS처럼 앱마다 보이는 제목이 다르다. 쓰지 않는 메뉴를 비활성으로 남기지 않는다)
 */
export function buildMenuBar({ appMenus, hasWindow, actions, dark, windows, help }: MenuBarContext): AppMenu[] {
	const fromApp = (title: string) => appMenus.filter((menu) => menu.title === title).flatMap((menu) => menu.items);

	const common: Record<(typeof COMMON_TITLES)[number], MenuItem[]> = {
		파일: join(
			fromApp('파일'),
			actions.copyLink ? [{ label: '링크 복사', icon: 'fa-solid fa-link', onSelect: actions.copyLink }] : [],
			hasWindow ? [{ label: '윈도우 닫기', shortcut: SHORTCUTS.closeWindow, onSelect: actions.closeWindow }] : []
		),
		편집: fromApp('편집'),
		보기: join(fromApp('보기'), [{ label: '다크 모드', checked: dark, onSelect: actions.toggleDark }]),
		이동: fromApp('이동'),
	};

	const own = appMenus.filter((menu) => !(COMMON_TITLES as readonly string[]).includes(menu.title));

	const windowMenu: MenuItem[] = join(
		hasWindow
			? [
					{ label: '최소화', shortcut: SHORTCUTS.minimize, onSelect: actions.minimize },
					{ label: '확대/축소', onSelect: actions.toggleMaximize },
				]
			: [],
		windows.map((window) => ({ label: window.label, checked: window.active, onSelect: window.onSelect }))
	);

	return [
		...COMMON_TITLES.map((title) => ({ title, items: common[title] })),
		...own,
		{ title: WINDOW_TITLE, items: windowMenu },
		{ title: HELP_TITLE, items: help },
	].filter((menu) => menu.items.length > 0);
}
