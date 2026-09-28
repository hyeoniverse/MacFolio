import { useRef } from 'react';

/** 위로 이만큼 쓸어 올리면 홈으로 간다 */
const SWIPE_HOME_PX = 24;
/** 이만큼 넘게 쓸어 올리면 앱 전환기를 연다 */
export const SWIPE_SWITCHER_PX = 140;

interface Props {
	/** 누르거나 짧게 쓸어 올렸을 때 */
	onHome?: () => void;
	/** 길게 쓸어 올렸을 때 */
	onSwitcher: () => void;
	/** 쓸어 올리는 중인 거리 (손을 떼면 null). 앱 화면을 손가락을 따라 줄일 때 쓴다 */
	onDrag?: (distance: number | null) => void;
	className?: string;
}

/**
 * iOS 화면 아래의 홈 인디케이터.
 * 누르거나 짧게 쓸어 올리면 홈, 길게 쓸어 올리면 앱 전환기.
 */
const HomeIndicator = ({ onHome, onSwitcher, onDrag, className = '' }: Props) => {
	const startY = useRef<number | null>(null);
	const moved = useRef(false);

	return (
		<button
			type="button"
			className={`home-indicator ${className}`}
			aria-label="홈 화면으로"
			onPointerDown={(event) => {
				startY.current = event.clientY;
				moved.current = false;
				event.currentTarget.setPointerCapture(event.pointerId);
			}}
			onPointerMove={(event) => {
				if (startY.current === null) return;
				const distance = Math.max(0, startY.current - event.clientY);
				if (distance > 6) moved.current = true;
				if (moved.current) onDrag?.(distance);
			}}
			onPointerUp={(event) => {
				const start = startY.current;
				startY.current = null;
				onDrag?.(null);
				if (start === null || !moved.current) return;
				const distance = start - event.clientY;
				if (distance >= SWIPE_SWITCHER_PX) onSwitcher();
				else if (distance >= SWIPE_HOME_PX) onHome?.();
			}}
			onPointerCancel={() => {
				startY.current = null;
				onDrag?.(null);
			}}
			// 쓸어 올리지 않고 눌렀을 때 (끌었을 때는 pointerup에서 처리했다)
			onClick={() => {
				if (!moved.current) onHome?.();
			}}
		>
			<span></span>
		</button>
	);
};

export default HomeIndicator;
