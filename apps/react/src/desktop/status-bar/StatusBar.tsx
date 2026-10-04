// Path: client/src/components/common/StatusBar.tsx

import React, { useState, useEffect } from 'react';
import { useMusic } from '@/apps/music/MusicContext'; // MusicContext 사용
import AppleMenu from '@/desktop/status-bar/AppleMenu';
import ServerMenu from '@/desktop/status-bar/ServerMenu';
import VolumeMenu from '@/desktop/status-bar/VolumeMenu';
import '@/desktop/status-bar/StatusBar.css';

const StatusBar: React.FC = () => {
	const [time, setTime] = useState<string>('');

	const { isPlaying, togglePlayPause, next: playNextTrack, previous: playPreviousTrack } = useMusic(); // MusicContext에서 필요한 상태 및 함수 가져오기

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

	return (
		<div className="macos-statusbar">
			<div className="left-section">
				<AppleMenu />
				{/* 맨 앞 앱 이름은 굵게 (macOS 메뉴 막대) */}
				<span className="menu-item app-name">Finder</span>
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
					<VolumeMenu />
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
		</div>
	);
};

export default StatusBar;
