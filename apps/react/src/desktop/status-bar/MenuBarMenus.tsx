import { useRef, useState } from 'react';
import { APP_MANIFEST, APP_NAMES } from '@/apps/manifest';
import { REPO_URL } from '@/apps/finder/repoDocs';
import { useAppState } from '@/desktop/AppStateContext';
import { useRegisteredMenus } from '@/desktop/status-bar/appMenus';
import { buildMenuBar } from '@/desktop/status-bar/menuBar';
import { sendWindowCommand } from '@/desktop/window/windowCommands';
import { appAddresses, LINKED_APPS, shareLink, type LinkedApp } from '@/shared/lib/appLink';
import { settingsStore } from '@/shared/settings/settingsStore';
import Menu from '@/shared/ui/menu/Menu';

const openExternal = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

/**
 * 메뉴 막대의 파일·편집·보기·이동·윈도우·도움말 (#96). 지금 쓰는 앱(activeApp)이 등록한 메뉴와 공통 메뉴를 합쳐 그린다.
 * macOS처럼 메뉴가 열린 채 다른 제목에 마우스를 올리면 그 메뉴로 넘어가고, ←·→로 옆 메뉴로 간다.
 */
const MenuBarMenus = () => {
	const { apps, activeApp, openApp } = useAppState();
	const registered = useRegisteredMenus();
	const [open, setOpen] = useState<{ index: number; anchor: { x: number; y: number }; keyboard: boolean } | null>(null);
	const bar = useRef<HTMLDivElement>(null);
	const titles = useRef<(HTMLButtonElement | null)[]>([]);

	const app = activeApp ?? 'finder';
	const label = APP_MANIFEST[app].label;
	const linked = activeApp !== null && (LINKED_APPS as readonly string[]).includes(activeApp);
	const address = linked ? appAddresses.getState()[activeApp as LinkedApp] : null;
	const dark = document.documentElement.dataset.theme === 'dark';

	const menus = buildMenuBar({
		appMenus: registered[app] ?? [],
		hasWindow: activeApp !== null,
		dark,
		actions: {
			copyLink: address ? () => void shareLink({ app: activeApp as LinkedApp, id: address }, label) : undefined,
			closeWindow: () => activeApp && sendWindowCommand(activeApp, 'close'),
			minimize: () => activeApp && sendWindowCommand(activeApp, 'minimize'),
			toggleMaximize: () => activeApp && sendWindowCommand(activeApp, 'toggleMaximize'),
			toggleDark: () => settingsStore.setState({ theme: dark ? 'light' : 'dark' }),
		},
		windows: APP_NAMES.filter((name) => apps[name].isRunning).map((name) => ({
			label: APP_MANIFEST[name].label,
			active: name === activeApp,
			onSelect: () => openApp(name),
		})),
		help: [
			{ label: 'API 문서', icon: 'fa-solid fa-book', onSelect: () => openApp('apidocs') },
			{ label: 'GitHub 저장소', icon: 'fa-brands fa-github', onSelect: () => openExternal(REPO_URL) },
			{ label: '문제 알리기…', icon: 'fa-solid fa-bug', onSelect: () => openExternal(`${REPO_URL}/issues/new/choose`) },
		],
	});

	const openAt = (index: number, keyboard: boolean) => {
		const wrapped = (index + menus.length) % menus.length;
		const rect = titles.current[wrapped]?.getBoundingClientRect();
		if (!rect) return;
		setOpen({ index: wrapped, anchor: { x: rect.left, y: rect.bottom + 3 }, keyboard });
	};
	const close = () => setOpen(null);
	// 앱이 바뀌어 제목 수가 줄었으면 닫힌 것으로 본다
	const current = open && menus[open.index] ? open : null;

	return (
		// data-app-menu: 눌러도 지금 쓰는 앱이 바뀌지 않는다 (Desktop.tsx의 바탕화면 판)
		<div className="menubar-menus" ref={bar} role="group" aria-label="메뉴 막대" data-app-menu>
			{menus.map((menu, index) => (
				<button
					key={menu.title}
					ref={(element) => {
						titles.current[index] = element;
					}}
					type="button"
					className={`menubar-title ${current?.index === index ? 'open' : ''}`}
					aria-haspopup="menu"
					aria-expanded={current?.index === index}
					// 키보드로 열면(detail 0) 첫 항목에 초점
					onClick={(event) => (current?.index === index ? close() : openAt(index, event.detail === 0))}
					onPointerEnter={() => current && current.index !== index && openAt(index, false)}
				>
					{menu.title}
				</button>
			))}
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
