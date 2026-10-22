import { useState, useEffect, useRef } from 'react';
import { prefersReducedMotion } from '@/shared/lib/media';
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
	// 눌러서 시작했으면 안내 문구를 감춘다 (자리는 그대로 두어 진행 막대가 움직이지 않게)
	const [started, setStarted] = useState(false);
	const mp3Url = env.sfxUrl;
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	// 로딩 화면이 화면을 덮었으니 배경화면을 보여도 된다 (index.html의 booting)
	useEffect(() => {
		document.documentElement.classList.remove('booting');
	}, []);

	useEffect(() => {
		const startLoading = () => {
			if (!isInteractedRef.current) {
				isInteractedRef.current = true;
				setStarted(true);
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
									duration: prefersReducedMotion() ? 0 : 450,
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
			{/* 사과 모양은 글꼴(Font Awesome brands, 114KB)이 아니라 SVG로 그린다: 첫 화면이 글꼴을 기다리지 않게 */}
			<svg className="loading-icon" viewBox="0 0 384 512" aria-hidden="true">
				<path
					fill="currentColor"
					d="M319.1 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7-55.8 .9-115.1 44.5-115.1 133.2 0 26.2 4.8 53.3 14.4 81.2 12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zM262.5 104.5c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
				/>
			</svg>
			<p className={`loading-text ${started ? 'started' : ''}`}>{startLabel}</p>
			<div className="progress-bar-container">
				<div className="progress-bar" style={{ width: `${progress}%` }} />
			</div>
		</div>
	);
};

export default LoadingScreen;
