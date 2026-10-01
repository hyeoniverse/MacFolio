import { useRef, useState } from 'react';
import { useAppState } from '@/desktop/AppStateContext';
import { signIn, signOut, useAdmin } from '@/shared/auth/adminStore';
import Menu, { type MenuItem } from '@/shared/ui/menu/Menu';

/**
 * 메뉴 막대의 Apple 메뉴. 관리자 로그인·로그아웃과 시스템 설정을 연다.
 * 메뉴는 공통 메뉴(shared/ui/menu)로 body에 그린다 (메뉴 막대는 넘치는 항목을 잘라 낸다).
 */
const AppleMenu = () => {
	const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
	const button = useRef<HTMLButtonElement>(null);
	const { openApp } = useAppState();
	const { status, login } = useAdmin();

	const items: MenuItem[] = [
		{ label: '시스템 설정…', onSelect: () => openApp('settings') },
		'separator',
		...(status === 'signed-in'
			? ([{ note: `${login}(으)로 로그인됨` }, { label: '로그아웃', onSelect: () => void signOut() }] as MenuItem[])
			: [
					{
						label: '관리자 로그인…',
						disabled: status !== 'signed-out',
						hint: status === 'signed-out' ? undefined : '관리자 서버에 연결되어 있지 않습니다',
						onSelect: signIn,
					},
				]),
	];

	return (
		<div className="apple-menu">
			<button
				ref={button}
				type="button"
				className={`apple-logo ${anchor ? 'open' : ''}`}
				aria-label="Apple 메뉴"
				aria-haspopup="menu"
				aria-expanded={anchor !== null}
				onClick={(event) => {
					const rect = event.currentTarget.getBoundingClientRect();
					setAnchor(anchor ? null : { x: rect.left, y: rect.bottom + 3 });
				}}
			>
				<i className="fa-brands fa-apple" aria-hidden="true" />
			</button>
			{anchor && (
				<Menu label="Apple 메뉴" anchor={anchor} items={items} trigger={button} onClose={() => setAnchor(null)} />
			)}
		</div>
	);
};

export default AppleMenu;
