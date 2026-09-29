import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppState } from '@/desktop/AppStateContext';
import { signIn, signOut, useAdmin } from '@/shared/auth/adminStore';

/**
 * 메뉴 막대의 Apple 메뉴. 관리자 로그인·로그아웃과 시스템 설정을 연다.
 * 메뉴 막대는 넘치는 항목을 잘라 내므로(overflow: hidden) 메뉴는 body에 그린다. 바깥을 누르거나 Esc를 누르면 닫힌다.
 */
const AppleMenu = () => {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const [anchor, setAnchor] = useState({ left: 0, top: 0 });
	const { openApp } = useAppState();
	const { status, login } = useAdmin();

	useEffect(() => {
		if (!open) return;
		const close = (event: Event) => {
			const inside = ref.current?.contains(event.target as Node) || menuRef.current?.contains(event.target as Node);
			if (event instanceof KeyboardEvent ? event.key === 'Escape' : !inside) setOpen(false);
		};
		document.addEventListener('pointerdown', close);
		document.addEventListener('keydown', close);
		return () => {
			document.removeEventListener('pointerdown', close);
			document.removeEventListener('keydown', close);
		};
	}, [open]);

	const run = (action: () => void) => () => {
		setOpen(false);
		action();
	};

	return (
		<div className="apple-menu" ref={ref}>
			<button
				type="button"
				className={`apple-logo ${open ? 'open' : ''}`}
				aria-label="Apple 메뉴"
				aria-haspopup="menu"
				aria-expanded={open}
				onClick={(event) => {
					const rect = event.currentTarget.getBoundingClientRect();
					setAnchor({ left: rect.left, top: rect.bottom + 3 });
					setOpen((value) => !value);
				}}
			>
				<i className="fa-brands fa-apple" aria-hidden="true" />
			</button>
			{open &&
				createPortal(
					<div ref={menuRef} className="apple-menu-list" role="menu" aria-label="Apple 메뉴" style={anchor}>
						<button type="button" role="menuitem" onClick={run(() => openApp('settings'))}>
							시스템 설정…
						</button>
						<hr />
						{status === 'signed-in' ? (
							<>
								<p className="apple-menu-note">{login}(으)로 로그인됨</p>
								<button type="button" role="menuitem" onClick={run(() => void signOut())}>
									로그아웃
								</button>
							</>
						) : (
							<button
								type="button"
								role="menuitem"
								disabled={status !== 'signed-out'}
								title={status === 'signed-out' ? undefined : '관리자 서버에 연결되어 있지 않습니다'}
								onClick={run(signIn)}
							>
								관리자 로그인…
							</button>
						)}
					</div>,
					document.body
				)}
		</div>
	);
};

export default AppleMenu;
