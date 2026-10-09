import { useEffect, useState } from 'react';
import { batteryOf, useServerResources } from '@/apps/activity/serverResources';
import { useVisitTrend, visitBattery } from '@/apps/activity/visitTrend';
import type { StatusBarTone } from '@/desktop/mobile/statusBarTone';
import ServerSignal from '@/shared/server/ServerSignal';
import { useServerStatus } from '@/shared/server/serverStatus';

const formatClock = (date: Date) => `${date.getHours() % 12 || 12}:${String(date.getMinutes()).padStart(2, '0')}`;

function useClock() {
	const [now, setNow] = useState(() => new Date());
	useEffect(() => {
		const id = setInterval(() => setNow(new Date()), 1000);
		return () => clearInterval(id);
	}, []);
	return now;
}

interface Props {
	ref?: React.Ref<HTMLDivElement>;
	/** 글자 색: 흰색(light) 또는 검은색(dark). 앱 위에서는 밑의 화면을 읽어 정한다 (statusBarTone.ts) */
	tone: StatusBarTone;
	/** 앱 위: 바탕은 투명하게 두고 밑으로 지나가는 내용만 아주 약하게 흐린다 */
	onApp: boolean;
	/** 화면만 보기 (사진만 보기): 흐려지며 사라진다 */
	hidden?: boolean;
	onOpen: () => void;
}

/**
 * iOS 상태 표시줄 (시간, 신호, Wi-Fi, 배터리). 누르면 제어 센터를 연다.
 * 끌어내려 여는 동작은 화면 어디서나 되도록 MobileShell이 듣는다 (useVerticalSwipe).
 */
const MobileStatusBar = ({ ref, tone, onApp, hidden = false, onOpen }: Props) => {
	const now = useClock();
	// 배터리 자리 (데스크톱 메뉴 막대와 같다): 관리자에게는 서버 자원 (유휴 회수에서 먼 만큼),
	// 방문자에게는 방문 추이 (최근 7일이 앞 7일보다 늘어난 만큼)
	const resources = useServerResources();
	const visits = useVisitTrend();
	const battery = resources.enabled
		? batteryOf(resources.status)
		: visits.trend && !visits.failed
			? visitBattery(visits.trend)
			: null;

	return (
		<div
			ref={ref}
			className={`mobile-statusbar ${tone}${onApp ? ' on-app' : ''}${hidden ? ' hidden' : ''}`}
			aria-hidden={hidden || undefined}
			role="button"
			aria-label="제어 센터 열기"
			onClick={onOpen}
		>
			<time className="mobile-statusbar-time" dateTime={now.toISOString()}>
				{formatClock(now)}
			</time>
			<span className="mobile-statusbar-icons" aria-hidden="true">
				<i className="fa-solid fa-signal"></i>
				<MobileServerSignal />
				<span className={`mobile-battery ${battery?.tone ?? ''}`} data-fill={battery?.fill}>
					<span style={battery ? { flex: 'none', width: `${battery.fill}%` } : undefined}></span>
				</span>
			</span>
		</div>
	);
};

export default MobileStatusBar;

/** 휴대폰 상태 표시줄의 Wi-Fi 자리: 서버 상태 막대 */
function MobileServerSignal() {
	return <ServerSignal status={useServerStatus()} />;
}
