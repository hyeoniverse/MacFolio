import React, { useState } from 'react';
import { formatTime } from './library';
import { useMusic } from './MusicContext';
import '@/apps/music/SeekBar.css';

interface Props {
	className?: string;
	/** 막대 아래에 지난 시간과 남은 시간을 보여줄지 */
	showTimes?: boolean;
}

/**
 * 재생 위치 막대. 누르거나 끌어서 옮기고, 방향키로 5초씩 옮긴다.
 * 끄는 동안에는 손가락을 따라가고, 손을 떼면 그 위치로 옮긴다.
 */
const SeekBar: React.FC<Props> = ({ className = '', showTimes = false }) => {
	const { currentTime, duration, seekTo } = useMusic();
	/** 끄는 중인 위치 (0~1). 끄지 않을 때는 null */
	const [dragRatio, setDragRatio] = useState<number | null>(null);
	const ratio = dragRatio ?? (duration ? currentTime / duration : 0);

	const ratioAt = (event: React.PointerEvent<HTMLDivElement>) => {
		const { left, width } = event.currentTarget.getBoundingClientRect();
		return Math.min(1, Math.max(0, (event.clientX - left) / width));
	};

	return (
		<div className={`seek-bar ${dragRatio !== null ? 'dragging' : ''} ${className}`}>
			<div
				className="seek-bar-track"
				role="slider"
				tabIndex={0}
				aria-label="재생 위치"
				aria-valuemin={0}
				aria-valuemax={Math.floor(duration)}
				aria-valuenow={Math.floor(ratio * duration)}
				aria-valuetext={`${formatTime(ratio * duration)} / ${formatTime(duration)}`}
				onPointerDown={(event) => {
					if (!duration) return;
					event.stopPropagation();
					event.currentTarget.setPointerCapture(event.pointerId);
					setDragRatio(ratioAt(event));
				}}
				onPointerMove={(event) => {
					if (dragRatio !== null) setDragRatio(ratioAt(event));
				}}
				onPointerUp={(event) => {
					if (dragRatio === null) return;
					seekTo(ratioAt(event) * duration);
					setDragRatio(null);
				}}
				onPointerCancel={() => setDragRatio(null)}
				// 위젯 안에서는 막대를 눌러도 앱이 열리지 않는다
				onClick={(event) => event.stopPropagation()}
				onKeyDown={(event) => {
					if (event.key === 'ArrowRight') seekTo(Math.min(duration, currentTime + 5));
					if (event.key === 'ArrowLeft') seekTo(Math.max(0, currentTime - 5));
				}}
			>
				<div className="seek-bar-fill" style={{ width: `${ratio * 100}%` }}></div>
				<div className="seek-bar-thumb" style={{ left: `${ratio * 100}%` }}></div>
			</div>
			{showTimes && (
				<div className="seek-bar-times">
					<span>{formatTime(ratio * duration)}</span>
					<span>-{formatTime(Math.max(0, duration - ratio * duration))}</span>
				</div>
			)}
		</div>
	);
};

export default SeekBar;
