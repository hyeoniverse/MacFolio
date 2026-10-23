import { useState, useEffect, useRef } from 'react';
import { prefersReducedMotion } from '@/shared/lib/media';
import '@fortawesome/fontawesome-free/css/all.min.css';
import '@/desktop/loading/LoadingScreen.css';
import AppleLogo from '@/shared/ui/AppleLogo';
import { env } from '@/shared/config/env';
import { useIsMobile } from '@/shared/hooks/useIsMobile';

declare global {
	interface Window {
		/** 앱이 뜨기 전에 첫 그림(#boot-splash)을 눌렀는지 (public/theme-boot.js가 적는다) */
		__macfolioTapped?: boolean;
	}
}

interface LoadingScreenProps {
	/** 눌러서 시작했다 (진행 막대가 차기 시작한다) */
	onStart?: () => void;
	onLoadingComplete: () => void;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ onStart, onLoadingComplete }) => {
	const [progress, setProgress] = useState(0);
	const startLabel = `${useIsMobile() ? '탭' : '클릭'}하여 로딩을 시작하세요`;
	const isInteractedRef = useRef(false);
	// 눌러서 시작했으면 안내 문구를 감춘다 (자리는 그대로 두어 진행 막대가 움직이지 않게)
	const [started, setStarted] = useState(false);
	const mp3Url = env.sfxUrl;
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	// 부르는 쪽이 그릴 때마다 새 함수를 넘겨도 진행 막대를 다시 시작하지 않게, 늘 지금의 함수를 부른다
	const callbacks = useRef({ onStart, onLoadingComplete });
	useEffect(() => {
		callbacks.current = { onStart, onLoadingComplete };
	}, [onStart, onLoadingComplete]);

	useEffect(() => {
		const startLoading = () => {
			if (!isInteractedRef.current) {
				isInteractedRef.current = true;
				setStarted(true);
				// 누르면 배경화면을 표시한다 (index.html의 booting). 누르기 전에는 html·body가 검은색이라, 휴대폰 도구 막대 뒤나
				// 화면을 끌어 내린 영역처럼 로딩 화면 밖이 보여도 같은 검은색이다. 배경화면은 진행 막대가 차는 2.5초 동안 수신한다
				document.documentElement.classList.remove('booting');
				callbacks.current.onStart?.();
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
								const done = () => callbacks.current.onLoadingComplete();
								if (fade) fade.onfinish = done;
								else done();
							}, 0);
							return 100;
						}
						return oldProgress + 2;
					});
				}, 50);
			}
		};

		document.addEventListener('click', startLoading);
		// 스크립트를 받는 동안 첫 그림을 이미 눌렀으면 바로 시작한다 (public/theme-boot.js)
		if (window.__macfolioTapped) startLoading();

		return () => {
			clearInterval(timerRef.current ?? undefined);
			audioRef.current?.pause();
			document.removeEventListener('click', startLoading);
		};
	}, [mp3Url]);

	return (
		<div ref={containerRef} className="loading-container">
			{/* 사과는 글꼴(Font Awesome brands, 113KB) 대신 SVG: 첫 화면이 글꼴을 기다리지 않게 */}
			<AppleLogo className="loading-icon" />
			<p className={`loading-text ${started ? 'started' : ''}`}>{startLabel}</p>
			<div className="progress-bar-container">
				<div className="progress-bar" style={{ width: `${progress}%` }} />
			</div>
		</div>
	);
};

export default LoadingScreen;
