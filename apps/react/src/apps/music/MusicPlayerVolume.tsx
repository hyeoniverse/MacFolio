// Path: client/src/components/common/VolumeModal.tsx

import React from 'react';
import { useMusic } from '@/apps/music/MusicContext'; // MusicContext 사용
import '@/apps/music/MusicPlayerVolume.css';

interface VolumeModalProps {
	/** 음량 아이콘 아래 가운데 (화면 기준). null이면 닫혀 있다 */
	anchor: { x: number; y: number } | null;
	onClose: () => void;
}

/** 음량 아이콘과 창 사이 간격 */
const GAP = 6;

const VolumeModal: React.FC<VolumeModalProps> = ({ anchor, onClose }) => {
	const { volume, setVolume } = useMusic();

	const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setVolume(Number(e.target.value));
	};

	const getVolumeIcon = () => {
		if (volume === 0) {
			return <i className="fas fa-volume-off volume-icon"></i>;
		} else if (volume <= 0.5) {
			return <i className="fas fa-volume-low volume-icon"></i>;
		} else {
			return <i className="fas fa-volume-high volume-icon"></i>;
		}
	};

	if (!anchor) return null;

	return (
		<div className="volume-modal-overlay" onClick={onClose}>
			{/* 음량 아이콘 바로 아래 가운데 (가로 가운데는 CSS의 translate로 맞춘다) */}
			<div className="volume-container" style={{ left: anchor.x, top: anchor.y + GAP }}>
				<div
					className="volume-level" // 볼륨 수준을 표시하는 컨테이너
					style={{
						height: `${volume * 100}%`, // 볼륨 값을 기반으로 컨테이너 높이를 설정
					}}
				></div>
				<input
					type="range"
					min="0"
					max="1"
					step="0.01"
					value={volume}
					onChange={handleVolumeChange}
					className="volume-slider"
					aria-label="Volume Slider"
					onClick={(e) => e.stopPropagation()}
				/>
				{getVolumeIcon()}
			</div>
		</div>
	);
};

export default VolumeModal;
