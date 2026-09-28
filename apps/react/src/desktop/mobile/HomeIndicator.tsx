import { useRef } from 'react';

/** 위로 이만큼 쓸어 올리면 홈으로 간다 */
const SWIPE_UP_PX = 24;

/**
 * iOS 화면 아래의 홈 인디케이터. 누르거나 위로 쓸어 올리면 홈 화면으로 돌아간다.
 */
const HomeIndicator = ({ onHome }: { onHome: () => void }) => {
	const startY = useRef<number | null>(null);

	return (
		<button
			type="button"
			className="home-indicator"
			aria-label="홈 화면으로"
			onPointerDown={(event) => {
				startY.current = event.clientY;
			}}
			onPointerUp={(event) => {
				const start = startY.current;
				startY.current = null;
				// 쓸어 올리면 click이 오지 않는 브라우저가 있어서 따로 처리한다
				if (start !== null && start - event.clientY >= SWIPE_UP_PX) onHome();
			}}
			onClick={onHome}
		>
			<span></span>
		</button>
	);
};

export default HomeIndicator;
