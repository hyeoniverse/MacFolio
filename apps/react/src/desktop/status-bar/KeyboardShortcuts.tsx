import { useExitMotion } from '@/shared/ui/motion/useExitMotion';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { AppMenu } from '@/desktop/status-bar/appMenus';
import { shortcutList } from '@/desktop/status-bar/menuBar';
import { formatShortcut, isMacPlatform } from '@/shared/ui/menu/shortcut';
import '@/desktop/status-bar/KeyboardShortcuts.css';

interface Props {
	/** 지금 쓰는 앱의 이름 (제목에) */
	appLabel: string;
	/** 지금 메뉴 막대의 메뉴 (지금 쓰는 앱 + 공통) */
	menus: AppMenu[];
	onClose: () => void;
}

/**
 * 도움말 → 키보드 단축키: 지금 쓸 수 있는 단축키를 메뉴별로 보여 준다 (#96). 앱이 바뀌면 목록도 바뀐다.
 * Esc나 바깥을 누르면 닫힌다
 */
const KeyboardShortcuts = ({ appLabel, menus, onClose }: Props) => {
	const close = useRef<HTMLButtonElement>(null);
	const mac = isMacPlatform();
	const groups = shortcutList(menus);

	useEffect(() => {
		close.current?.focus();
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			onClose();
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [onClose]);
	// 바탕은 흐려지고 창은 작아지며 사라진다 (motion.css)
	const overlay = useExitMotion<HTMLDivElement>('fade-out');

	return createPortal(
		<div
			ref={overlay}
			className="keyboard-shortcuts-overlay"
			onPointerDown={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<div className="keyboard-shortcuts" role="dialog" aria-modal="true" aria-label="키보드 단축키">
				<h2>키보드 단축키</h2>
				<p className="keyboard-shortcuts-sub">
					{appLabel}에서 쓸 수 있는 단축키입니다. 브라우저가 먼저 쓰는 ⌘N·⌘T·⌘W 대신 ⌥를 씁니다.
				</p>
				{groups.length === 0 ? (
					<p className="keyboard-shortcuts-empty">이 앱에는 단축키가 없습니다.</p>
				) : (
					groups.map((group) => (
						<section key={group.title} aria-label={group.title}>
							<h3>{group.title}</h3>
							<dl>
								{group.items.map((item) => (
									<div key={item.label}>
										<dt>{item.label}</dt>
										<dd>
											<kbd>{formatShortcut(item.shortcut, mac)}</kbd>
										</dd>
									</div>
								))}
							</dl>
						</section>
					))
				)}
				<button ref={close} type="button" className="keyboard-shortcuts-close" onClick={onClose}>
					닫기
				</button>
			</div>
		</div>,
		document.body
	);
};

export default KeyboardShortcuts;
