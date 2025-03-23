import { useState, useEffect, useRef } from 'react';
import '@fortawesome/fontawesome-free/css/all.min.css';
import '../styles/Loading.css';

interface LoadingPageProps {
	onLoadingComplete: () => void;
}

const LoadingPage: React.FC<LoadingPageProps> = ({ onLoadingComplete }) => {
	const [progress, setProgress] = useState(0);
	const isInteractedRef = useRef(false);
	const mp3Url = import.meta.env.VITE_APP_SFX_URL;
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const timerRef = useRef<number | null>(null);

	useEffect(() => {
		const startLoading = () => {
			if (!isInteractedRef.current) {
				isInteractedRef.current = true;
				audioRef.current = new Audio(`${mp3Url}/mac-startup.mp3`);

				audioRef.current.play().catch((error) => {
					console.error('Audio playback failed:', error);
				});

				timerRef.current = setInterval(() => {
					setProgress((oldProgress) => {
						if (oldProgress >= 100) {
							clearInterval(timerRef.current as number);
							audioRef.current?.pause();
							// 렌더링 사이클이 끝난 후 onLoadingComplete 호출 및 커스텀 이벤트 디스패치
							setTimeout(() => {
								onLoadingComplete();
								window.dispatchEvent(new Event('startMusic'));
							}, 0);
							return 100;
						}
						return oldProgress + 2;
					});
				}, 50);
			}
		};

		document.addEventListener('click', startLoading);

		return () => {
			clearInterval(timerRef.current as number);
			audioRef.current?.pause();
			document.removeEventListener('click', startLoading);
		};
	}, [mp3Url, onLoadingComplete]);

	return (
		<div className="loading-container">
			<i className="fa-brands fa-apple loading-icon" />
			{!isInteractedRef.current ? (
				<p className="loading-text">클릭하여 로딩을 시작하세요</p>
			) : (
				<p className="loading-text" style={{ visibility: 'hidden' }}>
					클릭하여 로딩을 시작하세요
				</p>
			)}
			<div className="progress-bar-container">
				<div className="progress-bar" style={{ width: `${progress}%` }} />
			</div>
		</div>
	);
};

export default LoadingPage;
