import React, { useState } from 'react';
import { useMusic } from './MusicContext';
import '@/apps/music/SeekBar.css';

/**
 * iOS '지금 재생 중'의 음량 막대. 양 끝에 스피커 아이콘이 있고, 누르거나 끄는 동안 막대가 두꺼워진다.
 * 재생 위치 막대(SeekBar)와 같은 모양을 쓴다. 끄는 동안 바로 음량이 바뀐다.
 */
const VolumeBar: React.FC<{ className?: string }> = ({ className = '' }) => {
	const { volume, setVolume } = useMusic();
	const [dragging, setDragging] = useState(false);

	const update = (event: React.PointerEvent<HTMLDivElement>) => {
		const { left, width } = event.currentTarget.getBoundingClientRect();
		setVolume(Math.min(1, Math.max(0, (event.clientX - left) / width)));
	};

	return (
		<div className={`volume-bar seek-bar ${dragging ? 'dragging' : ''} ${className}`}>
			<i className={`fa-solid ${volume === 0 ? 'fa-volume-xmark' : 'fa-volume-off'}`} aria-hidden="true"></i>
			<div
				className="seek-bar-track"
				role="slider"
				tabIndex={0}
				aria-label="음량"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={Math.round(volume * 100)}
				onPointerDown={(event) => {
					event.stopPropagation();
					event.currentTarget.setPointerCapture(event.pointerId);
					setDragging(true);
					update(event);
				}}
				onPointerMove={(event) => {
					if (dragging) update(event);
				}}
				onPointerUp={() => setDragging(false)}
				onPointerCancel={() => setDragging(false)}
				onClick={(event) => event.stopPropagation()}
				onKeyDown={(event) => {
					if (event.key === 'ArrowRight' || event.key === 'ArrowUp') setVolume(Math.min(1, volume + 0.1));
					if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') setVolume(Math.max(0, volume - 0.1));
				}}
			>
				<div className="seek-bar-fill" style={{ width: `${volume * 100}%` }}></div>
				<div className="seek-bar-thumb" style={{ left: `${volume * 100}%` }}></div>
			</div>
			<i className="fa-solid fa-volume-high" aria-hidden="true"></i>
		</div>
	);
};

export default VolumeBar;
