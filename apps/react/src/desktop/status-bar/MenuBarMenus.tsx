import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_MANIFEST } from '@/apps/manifest';
import { REPO_URL } from '@/apps/finder/repoDocs';
import { useAppState } from '@/desktop/AppStateContext';
import { useRegisteredMenus } from '@/desktop/status-bar/appMenus';
import { buildMenuBar, findShortcutItem } from '@/desktop/status-bar/menuBar';
import { isMacPlatform, isTypingTarget, matchesShortcut, usableWhileTyping } from '@/shared/ui/menu/shortcut';
import { sendWindowCommand } from '@/desktop/window/windowCommands';
import { appAddresses, LINKED_APPS, shareLink, type LinkedApp } from '@/shared/lib/appLink';
import Menu from '@/shared/ui/menu/Menu';
import KeyboardShortcuts from '@/desktop/status-bar/KeyboardShortcuts';

const openExternal = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

/**
 * 메뉴 막대의 파일·편집·보기·이동·윈도우·도움말 (#96). 지금 쓰는 앱(activeApp)이 등록한 메뉴와 공통 메뉴를 합쳐 그린다.
 * macOS처럼 메뉴가 열린 채 다른 제목에 마우스를 올리면 그 메뉴로 넘어가고, ←·→로 옆 메뉴로 간다.
 */
const MenuBarMenus = () => {
	const { activeApp } = useAppState();
	const registered = useRegisteredMenus();
	// 연 메뉴는 자리(번호)가 아니라 제목으로 기억한다. 앱이 메뉴를 등록하며 제목 순서가 바뀌어도 연 메뉴가 그대로다
	const [open, setOpen] = useState<{ title: string; anchor: { x: number; y: number }; keyboard: boolean } | null>(null);
	const [shortcutsOpen, setShortcutsOpen] = useState(false);
	const closeShortcuts = useCallback(() => setShortcutsOpen(false), []);
	const bar = useRef<HTMLDivElement>(null);
	const titles = useRef<(HTMLButtonElement | null)[]>([]);

	const app = activeApp ?? 'finder';
	const label = APP_MANIFEST[app].label;
	const linked = activeApp !== null && (LINKED_APPS as readonly string[]).includes(activeApp);
	const address = linked ? appAddresses.getState()[activeApp as LinkedApp] : null;
	const menus = buildMenuBar({
		appLabel: label,
		appMenus: registered[app] ?? [],
		hasWindow: activeApp !== null,
		canQuit: APP_MANIFEST[app].alwaysRunning !== true,
		actions: {
			copyLink: address ? () => void shareLink({ app: activeApp as LinkedApp, id: address }, label) : undefined,
			closeWindow: () => activeApp && sendWindowCommand(activeApp, 'close'),
			minimize: () => activeApp && sendWindowCommand(activeApp, 'minimize'),
			toggleMaximize: () => activeApp && sendWindowCommand(activeApp, 'toggleMaximize'),
			quit: () => activeApp && sendWindowCommand(activeApp, 'quit'),
		},
		help: [
			{ label: '키보드 단축키…', icon: 'fa-regular fa-keyboard', onSelect: () => setShortcutsOpen(true) },
			{ label: '문제 알리기…', icon: 'fa-solid fa-bug', onSelect: () => openExternal(`${REPO_URL}/issues/new/choose`) },
		],
	});

	// 단축키: 지금 보이는 메뉴(지금 쓰는 앱 + 공통)에 있는 항목만. 메뉴는 렌더링마다 바뀌므로 최신 것을 ref로 본다
	const latest = useRef(menus);
	useEffect(() => {
		latest.current = menus;
	});
	useEffect(() => {
		const mac = isMacPlatform();
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.defaultPrevented || event.repeat) return;
			const typing = isTypingTarget(event.target);
			const item = findShortcutItem(
				latest.current,
				(shortcut) => matchesShortcut(event, shortcut, mac) && (!typing || usableWhileTyping(shortcut))
			);
			if (!item) return;
			event.preventDefault();
			setOpen(null);
			item.onSelect();
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, []);

	const openAt = (index: number, keyboard: boolean) => {
		const wrapped = (index + menus.length) % menus.length;
		const rect = titles.current[wrapped]?.getBoundingClientRect();
		if (!rect) return;
		setOpen({ title: menus[wrapped].title, anchor: { x: rect.left, y: rect.bottom + 3 }, keyboard });
	};
	const close = () => setOpen(null);
	// 앱이 바뀌어 그 제목이 없어졌으면 닫힌 것으로 본다
	const openIndex = open ? menus.findIndex((menu) => menu.title === open.title) : -1;
	const current = open && openIndex >= 0 ? { ...open, index: openIndex } : null;

	return (
		<div className="menubar-menus" ref={bar} role="group" aria-label="메뉴 막대">
			{menus.map((menu, index) => (
				<button
					key={menu.title}
					ref={(element) => {
						titles.current[index] = element;
					}}
					type="button"
					// 맨 앞은 굵은 앱 이름 메뉴 (macOS의 앱 메뉴)
					className={`menubar-title ${menu.app ? 'app-name' : ''} ${current?.index === index ? 'open' : ''}`}
					aria-haspopup="menu"
					aria-expanded={current?.index === index}
					// 키보드로 열면(detail 0) 첫 항목에 초점
					onClick={(event) => (current?.index === index ? close() : openAt(index, event.detail === 0))}
					onPointerEnter={() => current && current.index !== index && openAt(index, false)}
				>
					{menu.title}
				</button>
			))}
			{shortcutsOpen && <KeyboardShortcuts appLabel={label} menus={menus} onClose={closeShortcuts} />}
			{current && (
				<Menu
					key={current.index}
					label={menus[current.index].title}
					anchor={current.anchor}
					items={menus[current.index].items}
					trigger={bar}
					onClose={close}
					autoFocus={current.keyboard}
					onNavigate={(direction) => openAt(current.index + direction, true)}
					className="menubar-menu"
					appMenu
				/>
			)}
		</div>
	);
};

export default MenuBarMenus;
