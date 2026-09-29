import { useEffect, useRef, useState } from 'react';

/** 이만큼 끌어내리면 제어 센터가 열린다 */
export const PULL_OPEN_PX = 60;

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
	/** 앱 위에 있으면 글자를 앱 색에 맞추고, 홈 화면에서는 흰색 */
	tone: 'light' | 'app';
	/** 끌어내리는 중인 거리. 손을 떼면 null */
	onPull: (distance: number | null) => void;
	onOpen: () => void;
}

/**
 * iOS 상태 표시줄 (시간, 신호, Wi-Fi, 배터리).
 * 누르거나 아래로 끌어내리면 제어 센터를 연다.
 */
const MobileStatusBar = ({ tone, onPull, onOpen }: Props) => {
	const now = useClock();
	const startY = useRef<number | null>(null);
	const dragged = useRef(false);

	const finish = (event: React.PointerEvent) => {
		if (startY.current === null) return;
		const distance = event.clientY - startY.current;
		startY.current = null;
		onPull(null);
		if (distance >= PULL_OPEN_PX) onOpen();
	};

	return (
		<div
			className={`mobile-statusbar ${tone}`}
			role="button"
			aria-label="제어 센터 열기"
			// 누르기는 click에서 연다. pointerup에서 열면 뒤따르는 click이 막 열린 제어 센터의 빈 곳에 떨어져 바로 닫힌다.
			onClick={() => {
				if (!dragged.current) onOpen();
			}}
			onPointerDown={(event) => {
				startY.current = event.clientY;
				dragged.current = false;
				event.currentTarget.setPointerCapture(event.pointerId);
			}}
			onPointerMove={(event) => {
				if (startY.current === null) return;
				const distance = event.clientY - startY.current;
				if (Math.abs(distance) >= 6) dragged.current = true;
				if (dragged.current) onPull(Math.max(0, distance));
			}}
			onPointerUp={finish}
			onPointerCancel={() => {
				startY.current = null;
				onPull(null);
			}}
		>
			<time className="mobile-statusbar-time" dateTime={now.toISOString()}>
				{formatClock(now)}
			</time>
			<span className="mobile-statusbar-icons" aria-hidden="true">
				<i className="fa-solid fa-signal"></i>
				<i className="fa-solid fa-wifi"></i>
				<span className="mobile-battery">
					<span></span>
				</span>
			</span>
		</div>
	);
};

export default MobileStatusBar;
