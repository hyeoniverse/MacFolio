import { useEffect, useRef, useState } from 'react';
import { useAppState } from '@/desktop/useAppState';
import { refreshAdmin, signIn, signOut, useAdmin } from '@/shared/auth/adminStore';
import Menu, { type MenuItem } from '@/shared/ui/menu/Menu';
import { REPO_URL } from '@/apps/finder/repoDocs';
import { settingsStore } from '@/shared/settings/settingsStore';
import { fetchTodayVisitors, openExternal } from '@/shared/analytics/analytics';
import { useOpenDocument } from '@/apps/textedit/openDocument';
import { openAbout } from '@/desktop/about/aboutStore';

/**
 * 메뉴 막대의 Apple 메뉴. 이 Mac에 관하여(만든 사람의 프로필), 오늘 방문자 수, 시스템 설정, 다크 모드, 사이트 바로가기(API 문서, 저장소, 개인정보 처리 방침),
 * 관리자 로그인·로그아웃.
 * 메뉴는 공통 메뉴(shared/ui/menu)로 body에 그린다 (메뉴 막대는 넘치는 항목을 잘라 낸다).
 */
const AppleMenu = () => {
	const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
	const button = useRef<HTMLButtonElement>(null);
	const { openApp } = useAppState();
	const openDocument = useOpenDocument();
	const { status, login } = useAdmin();
	// 오늘 방문자 수 (#102): 메뉴를 열 때마다 묻는다. 서버가 1분 동안 같은 값을 준다
	const [visitors, setVisitors] = useState<number | null>(null);
	useEffect(() => {
		if (anchor) void fetchTodayVisitors().then(setVisitors);
	}, [anchor]);

	const dark = document.documentElement.dataset.theme === 'dark';
	const items: MenuItem[] = [
		// macOS처럼 맨 위. 이 Mac 대신 만든 사람의 프로필을 보여 준다 (desktop/about)
		{ label: '이 Mac에 관하여', onSelect: openAbout },
		'separator',
		...(visitors !== null ? ([{ note: `오늘 방문자 ${visitors.toLocaleString()}명` }, 'separator'] as MenuItem[]) : []),
		{ label: '시스템 설정…', onSelect: () => openApp('settings') },
		// 화면 모드는 앱이 아니라 시스템의 것이라 앱의 보기 메뉴가 아니라 여기에 둔다
		{ label: '다크 모드', checked: dark, onSelect: () => settingsStore.setState({ theme: dark ? 'light' : 'dark' }) },
		'separator',
		{ label: 'API 문서', onSelect: () => openApp('apidocs') },
		{ label: 'GitHub 저장소', onSelect: () => openExternal(REPO_URL) },
		{
			label: '개인정보 처리 방침',
			onSelect: () => {
				openDocument('docs/privacy.md');
			},
		},
		'separator',
		...(status === 'signed-in'
			? ([{ note: `${login}(으)로 로그인됨` }, { label: '로그아웃', onSelect: () => void signOut() }] as MenuItem[])
			: status === 'offline'
				? // 서버에 닿지 못했으면 설정에 가지 않고 여기서 바로 다시 묻는다 (닿으면 로그인할 수 있게 된다)
					([
						{ note: '관리자 서버에 연결할 수 없습니다' },
						{ label: '다시 확인', onSelect: () => void refreshAdmin() },
					] as MenuItem[])
				: [
						{
							label: status === 'checking' ? '로그인 확인하는 중…' : '관리자 로그인…',
							disabled: status !== 'signed-out',
							hint: status === 'disabled' ? '관리자 서버가 아직 연결되지 않았습니다' : undefined,
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
