import { useEffect, useState } from 'react';
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
	/**
	 * 홈 화면에서는 흰 글자(light), 앱 위에서는 앱 글자색(app), 둘 다 바탕 없이 투명하다.
	 * 웹 페이지 앱 위(glass)에서는 페이지가 밑까지 그려져 글자가 페이지 메뉴와 겹치므로, 페이지가 비치는 흐린 유리를 깐다
	 */
	tone: 'light' | 'app' | 'glass';
	onOpen: () => void;
}

/**
 * iOS 상태 표시줄 (시간, 신호, Wi-Fi, 배터리). 누르면 제어 센터를 연다.
 * 끌어내려 여는 동작은 화면 어디서나 되도록 MobileShell이 듣는다 (useVerticalSwipe).
 */
const MobileStatusBar = ({ tone, onOpen }: Props) => {
	const now = useClock();

	return (
		<div className={`mobile-statusbar ${tone}`} role="button" aria-label="제어 센터 열기" onClick={onOpen}>
			<time className="mobile-statusbar-time" dateTime={now.toISOString()}>
				{formatClock(now)}
			</time>
			<span className="mobile-statusbar-icons" aria-hidden="true">
				<i className="fa-solid fa-signal"></i>
				<MobileServerSignal />
				<span className="mobile-battery">
					<span></span>
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
