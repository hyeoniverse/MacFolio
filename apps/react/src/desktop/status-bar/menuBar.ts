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
	/** 앱이 ⌥W를 쓰면 (Safari의 탭 닫기) 윈도우 닫기는 ⌥⇧W. macOS Safari의 ⌘W·⇧⌘W와 같다 */
	closeWindowShifted: { code: 'KeyW', alt: true, shift: true },
	minimize: { code: 'KeyM', alt: true },
	hide: { code: 'KeyH', alt: true },
	quit: { code: 'KeyQ', alt: true },
} satisfies Record<string, Shortcut>;

const sameShortcut = (a: Shortcut, b: Shortcut) =>
	a.code === b.code && !!a.mod === !!b.mod && !!a.alt === !!b.alt && !!a.shift === !!b.shift;

const shortcutsOf = (menus: AppMenu[]) =>
	menus.flatMap((menu) =>
		menu.items.flatMap((item) =>
			typeof item === 'object' && 'onSelect' in item && item.shortcut ? [item.shortcut] : []
		)
	);

/**
 * 메뉴마다 단축키가 있는 항목 (도움말 → 키보드 단축키 목록). 단축키가 없는 메뉴는 뺀다.
 * 같은 단축키가 또 나오면 앞쪽 것만 실제로 듣으므로(findShortcutItem) 뒤쪽 것은 목록에서도 뺀다
 */
export function shortcutList(menus: AppMenu[]): { title: string; items: { label: string; shortcut: Shortcut }[] }[] {
	const seen: Shortcut[] = [];
	return menus
		.map((menu) => ({
			title: menu.title,
			items: menu.items.flatMap((item) => {
				if (typeof item !== 'object' || !('onSelect' in item) || !item.shortcut) return [];
				const shortcut = item.shortcut;
				if (seen.some((other) => sameShortcut(other, shortcut))) return [];
				seen.push(shortcut);
				return [{ label: item.label, shortcut }];
			}),
		}))
		.filter((menu) => menu.items.length > 0);
}

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
	/** 지금 쓰는 앱의 이름 (맨 앞의 굵은 앱 메뉴 제목) */
	appLabel: string;
	/** 앱이 등록한 메뉴 (없으면 []) */
	appMenus: AppMenu[];
	/** 지금 쓰는 앱에 창이 있는지 (창 밖을 눌러 Finder가 되었거나 창이 없으면 false) */
	hasWindow: boolean;
	/** 종료할 수 있는 앱인지 (Finder는 끌 수 없다) */
	canQuit: boolean;
	/** 공통 항목의 동작 (없으면 그 항목을 두지 않는다) */
	actions: {
		copyLink?: () => void;
		closeWindow: () => void;
		minimize: () => void;
		toggleMaximize: () => void;
		quit: () => void;
	};
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
export function buildMenuBar({ appLabel, appMenus, hasWindow, canQuit, actions, help }: MenuBarContext): AppMenu[] {
	const fromApp = (title: string) => appMenus.filter((menu) => menu.title === title).flatMap((menu) => menu.items);
	const closeWindowShortcut = shortcutsOf(appMenus).some((shortcut) => sameShortcut(shortcut, SHORTCUTS.closeWindow))
		? SHORTCUTS.closeWindowShifted
		: SHORTCUTS.closeWindow;

	// 맨 앞의 굵은 앱 이름 메뉴 (macOS의 앱 메뉴): 가리기, 종료
	const appMenu: MenuItem[] = join(
		[{ label: `${appLabel} 가리기`, shortcut: SHORTCUTS.hide, disabled: !hasWindow, onSelect: actions.minimize }],
		canQuit && hasWindow ? [{ label: `${appLabel} 종료`, shortcut: SHORTCUTS.quit, onSelect: actions.quit }] : []
	);

	const common: Record<(typeof COMMON_TITLES)[number], MenuItem[]> = {
		파일: join(
			fromApp('파일'),
			actions.copyLink ? [{ label: '링크 복사', icon: 'fa-solid fa-link', onSelect: actions.copyLink }] : [],
			hasWindow ? [{ label: '윈도우 닫기', shortcut: closeWindowShortcut, onSelect: actions.closeWindow }] : []
		),
		편집: fromApp('편집'),
		보기: fromApp('보기'),
		이동: fromApp('이동'),
	};

	const own = appMenus.filter(
		(menu) => !([...COMMON_TITLES, WINDOW_TITLE, HELP_TITLE] as string[]).includes(menu.title)
	);

	// 윈도우: 이 앱의 창에 대한 것만 (다른 앱의 창은 Dock으로 바꾼다. macOS의 윈도우 메뉴도 그 앱의 창만 보여 준다)
	const windowMenu: MenuItem[] = join(
		hasWindow
			? [
					{ label: '최소화', shortcut: SHORTCUTS.minimize, onSelect: actions.minimize },
					{ label: '확대/축소', onSelect: actions.toggleMaximize },
				]
			: [],
		fromApp(WINDOW_TITLE)
	);

	const menus: AppMenu[] = [
		{ title: appLabel, items: appMenu, app: true },
		...COMMON_TITLES.map((title) => ({ title, items: common[title] })),
		...own,
		{ title: WINDOW_TITLE, items: windowMenu },
		{ title: HELP_TITLE, items: help },
	];
	return menus.filter((menu) => menu.app || menu.items.length > 0);
}
