// Path: client/src/components/common/StatusBar.tsx

import React, { useState, useEffect } from 'react';
import { useMusic } from '@/apps/music/MusicContext'; // MusicContext 사용
import VolumeModal from '@/apps/music/MusicPlayerVolume'; // VolumeModal 가져오기
import AppleMenu from '@/desktop/status-bar/AppleMenu';
import ServerMenu from '@/desktop/status-bar/ServerMenu';
import '@/desktop/status-bar/StatusBar.css';

const StatusBar: React.FC = () => {
	const [time, setTime] = useState<string>('');
	/** 음량 창을 열 자리 (음량 아이콘 아래 가운데). 닫혀 있으면 null */
	const [volumeAnchor, setVolumeAnchor] = useState<{ x: number; y: number } | null>(null);
	// 음량 아이콘의 실제 자리를 재서 그 아래에 연다 (옆 아이콘의 폭이 바뀌어도 어긋나지 않게)
	const openVolume = (event: React.MouseEvent<HTMLElement>) => {
		const rect = event.currentTarget.getBoundingClientRect();
		setVolumeAnchor({ x: rect.left + rect.width / 2, y: rect.bottom });
	};
	const { isPlaying, volume, togglePlayPause, next: playNextTrack, previous: playPreviousTrack } = useMusic(); // MusicContext에서 필요한 상태 및 함수 가져오기

	useEffect(() => {
		const updateTime = () => {
			const now = new Date();
			const hours = now.getHours();
			const minutes = now.getMinutes();
			const ampm = hours >= 12 ? 'PM' : 'AM';
			const formattedTime = `${hours % 12 || 12}:${minutes < 10 ? '0' : ''}${minutes} ${ampm}`;
			setTime(formattedTime);
		};

		const intervalId = setInterval(updateTime, 1000);
		updateTime();

		return () => clearInterval(intervalId);
	}, []);

	const getVolumeIcon = () => {
		if (volume === 0) {
			return <i className="fas fa-volume-off" onClick={openVolume}></i>;
		} else if (volume <= 0.5) {
			return <i className="fas fa-volume-low" onClick={openVolume}></i>;
		} else {
			return <i className="fas fa-volume-high" onClick={openVolume}></i>;
		}
	};

	return (
		<div className="macos-statusbar">
			<div className="left-section">
				<AppleMenu />
				<span className="menu-item">Finder</span>
				<span className="menu-item">File</span>
				<span className="menu-item">Edit</span>
				<span className="menu-item">View</span>
				<span className="menu-item">Go</span>
				<span className="menu-item">Window</span>
				<span className="menu-item">Help</span>
			</div>

			<div className="right-section">
				<div className="menu-item-player">
					<span onClick={playPreviousTrack}>
						<i className="fas fa-fast-backward"></i>
					</span>
					<span onClick={togglePlayPause}>
						<i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
					</span>
					<span onClick={playNextTrack}>
						<i className="fas fa-fast-forward"></i>
					</span>
					<span>{getVolumeIcon()}</span>
				</div>

				{/* Wi-Fi 자리: 이 사이트 서버(API)의 상태 */}
				<ServerMenu />
				<span className="menu-item">
					<i className="fas fa-battery-three-quarters"></i>
				</span>
				{/* 시간 칸은 가장 넓은 시간(12:00 AM·PM)만큼 늘 차지한다. 시간이 바뀌어도 왼쪽 아이콘이 움찔하지 않게 */}
				<span className="menu-item time-display">
					<span className="time-display-reserve" aria-hidden="true">
						12:00 AM
					</span>
					<span className="time-display-reserve" aria-hidden="true">
						12:00 PM
					</span>
					<span className="time-display-now">{time}</span>
				</span>
			</div>

			{/* 볼륨 모달 */}
			<VolumeModal anchor={volumeAnchor} onClose={() => setVolumeAnchor(null)} />
		</div>
	);
};

export default StatusBar;
