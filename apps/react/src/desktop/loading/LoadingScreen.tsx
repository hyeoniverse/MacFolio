import { useState, useEffect, useRef } from 'react';
import '@fortawesome/fontawesome-free/css/all.min.css';
import '@/desktop/loading/LoadingScreen.css';
import { env } from '@/shared/config/env';
import { useIsMobile } from '@/shared/hooks/useIsMobile';

interface LoadingScreenProps {
	onLoadingComplete: () => void;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ onLoadingComplete }) => {
	const [progress, setProgress] = useState(0);
	const startLabel = `${useIsMobile() ? '탭' : '클릭'}하여 로딩을 시작하세요`;
	const isInteractedRef = useRef(false);
	const mp3Url = env.sfxUrl;
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);

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
							clearInterval(timerRef.current ?? undefined);
							audioRef.current?.pause();
							// 렌더링 사이클이 끝난 후 onLoadingComplete 호출 및 커스텀 이벤트 디스패치
							setTimeout(() => {
								window.dispatchEvent(new Event('startMusic'));
								// 검은 화면이 서서히 걷히며 데스크톱이 나타난다
								const fade = containerRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], {
									duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450,
									easing: 'ease-out',
									fill: 'forwards',
								});
								if (fade) fade.onfinish = onLoadingComplete;
								else onLoadingComplete();
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
			clearInterval(timerRef.current ?? undefined);
			audioRef.current?.pause();
			document.removeEventListener('click', startLoading);
		};
	}, [mp3Url, onLoadingComplete]);

	return (
		<div ref={containerRef} className="loading-container">
			<i className="fa-brands fa-apple loading-icon" />
			{!isInteractedRef.current ? (
				<p className="loading-text">{startLabel}</p>
			) : (
				<p className="loading-text" style={{ visibility: 'hidden' }}>
					{startLabel}
				</p>
			)}
			<div className="progress-bar-container">
				<div className="progress-bar" style={{ width: `${progress}%` }} />
			</div>
		</div>
	);
};

export default LoadingScreen;
