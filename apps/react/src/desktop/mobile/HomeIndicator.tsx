import { useRef } from 'react';
import { useStatusBarTone, type StatusBarTone } from '@/desktop/mobile/statusBarTone';
import { useResolvedTheme } from '@/shared/settings/settingsStore';

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
	/** 밑을 읽을지 (가려진 앱의 인디케이터는 읽지 않는다) */
	active?: boolean;
	/** 밑을 읽을 수 없을 때의 색. 없으면 화면 모드를 따른다 (다크면 흰색) */
	fallbackTone?: StatusBarTone;
}

/**
 * iOS 화면 아래의 홈 인디케이터.
 * 누르거나 짧게 쓸어 올리면 홈, 길게 쓸어 올리면 앱 전환기.
 * 색은 상태 표시줄처럼 밑에 그려진 화면을 읽어 정한다: 어두운 화면 위에는 흰색, 밝은 화면 위에는 검은색 (statusBarTone.ts)
 */
const HomeIndicator = ({ onHome, onSwitcher, onDrag, className = '', active = true, fallbackTone }: Props) => {
	const startY = useRef<number | null>(null);
	const moved = useRef(false);
	const button = useRef<HTMLButtonElement>(null);
	const theme = useResolvedTheme();
	const fallback = fallbackTone ?? (theme === 'dark' ? 'light' : 'dark');
	const tone = useStatusBarTone(button, active, fallback, theme);

	return (
		<button
			ref={button}
			type="button"
			className={`home-indicator ${tone} ${className}`}
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
