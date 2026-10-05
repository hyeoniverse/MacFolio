import { useRef, useState } from 'react';
import { useAppState } from '@/desktop/AppStateContext';
import { env } from '@/shared/config/env';
import ServerSignal from '@/shared/server/ServerSignal';
import { checkServer, STATE_LABEL, useServerStatus } from '@/shared/server/serverStatus';
import Menu, { type MenuItem } from '@/shared/ui/menu/Menu';

/** '3초 전', '2분 전' */
const ago = (time: number) => {
	const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
	if (seconds < 5) return '방금';
	if (seconds < 60) return `${seconds}초 전`;
	return `${Math.round(seconds / 60)}분 전`;
};

/**
 * 메뉴 막대의 Wi-Fi 자리: 이 사이트의 서버(API) 상태. 누르면 macOS Wi-Fi 메뉴처럼 자세히 보인다.
 * 주기적으로 /health를 불러 응답 시간과 DB 상태를 막대로 보여 준다.
 */
const ServerMenu = () => {
	const status = useServerStatus();
	const { openApp } = useAppState();
	const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
	const button = useRef<HTMLButtonElement>(null);
	const label = STATE_LABEL[status.state];
	const host = env.apiUrl.replace(/^https?:\/\//, '');
	const detail = [
		status.latency !== null && `응답 ${status.latency}ms`,
		status.checkedAt !== null && `${ago(status.checkedAt)} 확인`,
	]
		.filter(Boolean)
		.join(' · ');

	const items: MenuItem[] = env.apiUrl
		? [
				{ heading: '서버' },
				// 지금 상태: 누를 수 없는 정보 줄 (다시 확인은 아래 '지금 확인')
				{ info: `MacFolio API · ${label}`, icon: <ServerSignal status={status} /> },
				...(detail ? [{ note: detail }] : []),
				{ note: host },
				'separator',
				{ label: '지금 확인', icon: 'fa-solid fa-rotate-right', onSelect: () => void checkServer() },
				// 새 탭이 아니라 사이트 안의 'API 문서' 앱으로 연다
				{ label: 'API 문서 열기', icon: 'fa-solid fa-book', onSelect: () => openApp('apidocs') },
			]
		: [{ heading: '서버' }, { note: '연결된 서버가 없습니다 (VITE_API_URL)' }];

	return (
		<span className="server-menu">
			<button
				ref={button}
				type="button"
				className={`statusbar-icon-button server-menu-button ${anchor ? 'open' : ''}`}
				aria-label={`서버 상태: ${label}${status.latency !== null ? `, 응답 ${status.latency}ms` : ''}`}
				title={`서버: ${label}`}
				aria-haspopup="menu"
				aria-expanded={anchor !== null}
				onClick={(event) => {
					const rect = event.currentTarget.getBoundingClientRect();
					// 열 때 한 번 더 확인해서 최신 상태를 보여 준다
					if (!anchor) void checkServer();
					setAnchor(anchor ? null : { x: rect.left, y: rect.bottom + 3 });
				}}
			>
				<ServerSignal status={status} />
			</button>
			{anchor && (
				<Menu label="서버 상태" anchor={anchor} items={items} trigger={button} onClose={() => setAnchor(null)} />
			)}
		</span>
	);
};

export default ServerMenu;
