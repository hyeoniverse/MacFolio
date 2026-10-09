import { useRef, useState } from 'react';
import { useAppState } from '@/desktop/useAppState';
import { RISK_LABEL, batteryOf, requestedTab, usageLine, useServerResources } from '@/apps/activity/serverResources';
import ServerBattery from '@/shared/server/ServerBattery';
import Menu, { type MenuItem } from '@/shared/ui/menu/Menu';

/** '방금', '3분 전', '2시간 전' */
const ago = (iso: string) => {
	const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
	if (minutes < 1) return '방금';
	if (minutes < 60) return `${minutes}분 전`;
	return `${Math.round(minutes / 60)}시간 전`;
};

/**
 * 메뉴 막대의 배터리 자리: 관리자에게는 서버(VM)의 자원. Always Free면 유휴 회수에서 먼 만큼 배터리가 차 있고,
 * 누르면 macOS 배터리 메뉴처럼 지금 사용률과 회수 위험이 보인다. 방문자에게는 평소의 배터리 아이콘
 */
const BatteryMenu = () => {
	const { enabled, status, error, refresh } = useServerResources();
	const { openApp } = useAppState();
	const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
	const button = useRef<HTMLButtonElement>(null);

	if (!enabled)
		return (
			<span className="statusbar-icon battery-icon">
				<ServerBattery fill={75} />
			</span>
		);

	const battery = batteryOf(status);
	const details = (): MenuItem[] => {
		if (error) return [{ note: `불러오지 못했습니다: ${error}` }];
		if (!status) return [{ note: '불러오는 중…' }];
		if (status.mode === 'off') return [{ note: '서버 자원 감시가 꺼져 있습니다 (RESOURCE_MONITOR)' }];
		const usage = usageLine(status);
		const risk = status.risk;
		return [
			{ info: usage ?? '아직 잰 값이 없습니다', icon: 'fa-solid fa-microchip' },
			{
				note: [
					status.mode === 'free' ? 'Always Free' : '종량제',
					status.shape,
					status.latest && `${ago(status.latest.at)} 측정`,
				]
					.filter(Boolean)
					.join(' · '),
			},
			...(risk
				? [
						{
							info: `유휴 회수: ${RISK_LABEL[risk.level]}`,
							icon: <ServerBattery fill={battery.fill} tone={battery.tone} />,
						},
						...(risk.level !== 'unknown' && risk.days < 7 ? [{ note: `${risk.days}일치로 미리 본 값` }] : []),
					]
				: []),
		];
	};
	const items: MenuItem[] = [
		{ heading: '서버 자원' },
		...details(),
		'separator',
		{
			label: '활동 상태 보기에서 자세히',
			icon: 'fa-solid fa-chart-line',
			onSelect: () => {
				requestedTab.setState({ tab: 'server' });
				openApp('activity');
			},
		},
	];

	return (
		<span className="battery-menu">
			<button
				ref={button}
				type="button"
				className={`statusbar-icon-button battery-icon battery-menu-button ${anchor ? 'open' : ''}`}
				aria-label={`서버 자원: ${battery.summary}`}
				title={`서버 자원: ${battery.summary}`}
				aria-haspopup="menu"
				aria-expanded={anchor !== null}
				onClick={(event) => {
					const rect = event.currentTarget.getBoundingClientRect();
					// 열 때 한 번 더 물어서 최신 값을 보여 준다
					if (!anchor) refresh();
					setAnchor(anchor ? null : { x: rect.left, y: rect.bottom + 3 });
				}}
			>
				<ServerBattery fill={battery.fill} tone={battery.tone} />
			</button>
			{anchor && (
				<Menu label="서버 자원" anchor={anchor} items={items} trigger={button} onClose={() => setAnchor(null)} />
			)}
		</span>
	);
};

export default BatteryMenu;
