import { useRef, useState } from 'react';
import { useAppState } from '@/desktop/useAppState';
import { RISK_LABEL, batteryOf, requestedTab, usageLine, useServerResources } from '@/apps/activity/serverResources';
import { useVisitTrend, visitBattery } from '@/apps/activity/visitTrend';
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
 * 메뉴 막대의 배터리 자리. 누르면 macOS 배터리 메뉴처럼 짧게 보인다.
 * - 관리자: 서버(VM)의 자원. Always Free면 유휴 회수에서 먼 만큼 차 있다. 메뉴에는 사용률·회수 위험과 방문
 * - 방문자: 방문 추이. 최근 7일 방문이 앞 7일보다 늘어난 만큼 차 있다 (같으면 절반). 메뉴에는 방문 수
 * 서버가 없으면 평소의 배터리 그림
 */
const BatteryMenu = () => {
	const resources = useServerResources();
	const visits = useVisitTrend();
	const { openApp } = useAppState();
	const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
	const button = useRef<HTMLButtonElement>(null);

	if (!visits.enabled)
		return (
			<span className="statusbar-icon battery-icon">
				<ServerBattery fill={75} />
			</span>
		);

	const admin = resources.enabled;
	const { status, error } = resources;
	const trend = visits.trend;
	const visitSummary = visits.failed ? { fill: 75, tone: null, summary: '불러오지 못함' } : visitBattery(trend);
	const battery = admin ? batteryOf(status) : visitSummary;
	const what = admin ? '서버 자원' : '방문';

	const visitItems = (): MenuItem[] => {
		if (visits.failed) return [{ note: '방문 수를 불러오지 못했습니다' }];
		if (!trend) return [{ note: '불러오는 중…' }];
		return [
			{
				info: `${trend.visits.toLocaleString()}회 방문`,
				icon: admin ? 'fa-solid fa-eye' : <ServerBattery fill={visitSummary.fill} />,
			},
			{
				note: trend.change
					? `앞 7일(${trend.previous.toLocaleString()}회)보다 ${trend.change.text} ${{ up: '▲', down: '▼', same: '' }[trend.change.direction]}`.trim()
					: '앞 7일에는 방문이 없었습니다',
			},
			{ note: `오늘 ${trend.today.toLocaleString()}회` },
		];
	};
	const serverItems = (): MenuItem[] => {
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
	const open = (tab: 'overview' | 'server') => () => {
		requestedTab.setState({ tab });
		openApp('activity');
	};
	const items: MenuItem[] = admin
		? [
				{ heading: '서버 자원' },
				...serverItems(),
				'separator',
				{ heading: '방문 (최근 7일)' },
				...visitItems(),
				'separator',
				{ label: '활동 상태 보기에서 자세히', icon: 'fa-solid fa-chart-line', onSelect: open('server') },
			]
		: [
				{ heading: '방문 (최근 7일)' },
				...visitItems(),
				'separator',
				{ label: '활동 상태 보기에서 자세히', icon: 'fa-solid fa-chart-line', onSelect: open('overview') },
			];

	return (
		<span className="battery-menu">
			<button
				ref={button}
				type="button"
				className={`statusbar-icon-button battery-icon battery-menu-button ${anchor ? 'open' : ''}`}
				aria-label={`${what}: ${battery.summary}`}
				title={`${what}: ${battery.summary}`}
				aria-haspopup="menu"
				aria-expanded={anchor !== null}
				onClick={(event) => {
					const rect = event.currentTarget.getBoundingClientRect();
					// 열 때 한 번 더 물어서 최신 값을 보여 준다
					if (!anchor) resources.refresh();
					setAnchor(anchor ? null : { x: rect.left, y: rect.bottom + 3 });
				}}
			>
				<ServerBattery fill={battery.fill} tone={battery.tone} />
			</button>
			{anchor && <Menu label={what} anchor={anchor} items={items} trigger={button} onClose={() => setAnchor(null)} />}
		</span>
	);
};

export default BatteryMenu;
