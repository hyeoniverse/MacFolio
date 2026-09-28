import { useEffect, useRef, useState } from 'react';
import { useMusic } from '@/apps/music/MusicContext';
import type { AppName } from '@/apps/manifest';
import MusicWidget from '@/desktop/mobile/MusicWidget';
import { PULL_OPEN_PX } from '@/desktop/mobile/MobileStatusBar';
import { WALLPAPERS } from '@/shared/settings/settings';
import { settingsStore, useSettings } from '@/shared/settings/settingsStore';
import { PROFILE } from '@/shared/profile';

interface Props {
	/** 열려 있는지 */
	open: boolean;
	/** 상태 표시줄을 끌어내리는 중인 거리. 끄는 동안 패널이 손가락을 따라 내려온다 */
	pull: number | null;
	onClose: () => void;
	onLaunch: (app: AppName) => void;
}

/** 세로 음량 막대. 누르거나 끌어서 음악 음량을 바꾼다. */
const VolumeSlider = () => {
	const { volume, setVolume } = useMusic();

	const update = (event: React.PointerEvent<HTMLDivElement>) => {
		const { top, height } = event.currentTarget.getBoundingClientRect();
		setVolume(Math.min(1, Math.max(0, 1 - (event.clientY - top) / height)));
	};

	return (
		<div
			className="cc-tile cc-slider"
			role="slider"
			aria-label="음량"
			aria-orientation="vertical"
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={Math.round(volume * 100)}
			tabIndex={0}
			onPointerDown={(event) => {
				event.currentTarget.setPointerCapture(event.pointerId);
				update(event);
			}}
			onPointerMove={(event) => {
				if (event.currentTarget.hasPointerCapture(event.pointerId)) update(event);
			}}
			onKeyDown={(event) => {
				if (event.key === 'ArrowUp') setVolume(Math.min(1, volume + 0.1));
				if (event.key === 'ArrowDown') setVolume(Math.max(0, volume - 0.1));
			}}
		>
			<div className="cc-slider-fill" style={{ height: `${volume * 100}%` }}></div>
			<i className={`fa-solid ${volume === 0 ? 'fa-volume-xmark' : 'fa-volume-high'}`} aria-hidden="true"></i>
		</div>
	);
};

/** 여닫는 애니메이션 시간 (MobileShell.css와 같아야 한다) */
const TRANSITION_MS = 250;

/**
 * iOS 제어 센터. 상태 표시줄을 끌어내리면 열리고, 빈 곳을 누르거나 위로 쓸어 올리면 닫힌다.
 */
const ControlCenter = (props: Props) => (props.open || props.pull !== null ? <Panel {...props} /> : null);

const Panel = ({ open, pull, onClose, onLaunch }: Props) => {
	const settings = useSettings();
	const startY = useRef<number | null>(null);
	// 처음 그릴 때는 닫힌 모양으로 그렸다가 다음 프레임에 열어야 transition이 적용된다
	const [entered, setEntered] = useState(false);
	const [leaving, setLeaving] = useState(false);

	useEffect(() => {
		const id = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
		return () => cancelAnimationFrame(id);
	}, []);

	useEffect(() => {
		if (!leaving) return;
		const id = setTimeout(onClose, TRANSITION_MS);
		return () => clearTimeout(id);
	}, [leaving, onClose]);

	const close = () => setLeaving(true);

	const isDark = document.documentElement.dataset.theme === 'dark';
	const nextWallpaper = () => {
		const index = WALLPAPERS.findIndex((wallpaper) => wallpaper.id === settings.wallpaper);
		settingsStore.setState({ wallpaper: WALLPAPERS[(index + 1) % WALLPAPERS.length].id });
	};
	const launch = (app: AppName) => {
		close();
		onLaunch(app);
	};

	// 끌어내리는 중에는 끈 만큼만 보인다
	const pulled = Math.min(1, (pull ?? 0) / (PULL_OPEN_PX * 4));
	const progress = leaving ? 0 : pull !== null ? pulled : open && entered ? 1 : 0;

	return (
		<div
			className={`control-center ${pull !== null ? 'dragging' : ''}`}
			role="dialog"
			aria-modal="true"
			aria-label="제어 센터"
			style={{ ['--cc-progress' as string]: progress }}
			onPointerDown={(event) => {
				startY.current = event.clientY;
			}}
			onPointerUp={(event) => {
				const start = startY.current;
				startY.current = null;
				if (start !== null && start - event.clientY >= PULL_OPEN_PX) close();
			}}
			onClick={(event) => {
				// 타일 사이의 빈 곳을 누르면 닫는다
				if (event.target === event.currentTarget || (event.target as Element).classList.contains('cc-grid')) close();
			}}
		>
			<div className="cc-grid">
				<MusicWidget className="cc-tile cc-music" onOpen={() => launch('music')} />

				<button
					type="button"
					className={`cc-tile cc-toggle ${isDark ? 'on' : ''}`}
					aria-pressed={isDark}
					onClick={() => settingsStore.setState({ theme: isDark ? 'light' : 'dark' })}
				>
					<i className="fa-solid fa-circle-half-stroke" aria-hidden="true"></i>
					<span className="visually-hidden">다크 모드</span>
				</button>
				<button type="button" className="cc-tile cc-toggle" onClick={nextWallpaper}>
					<i className="fa-solid fa-image" aria-hidden="true"></i>
					<span className="visually-hidden">배경화면</span>
				</button>
				<button type="button" className="cc-tile cc-toggle" onClick={() => launch('share')}>
					<i className="fa-solid fa-link" aria-hidden="true"></i>
					<span className="visually-hidden">링크 복사</span>
				</button>
				<a className="cc-tile cc-toggle" href={PROFILE.github} target="_blank" rel="noopener noreferrer">
					<i className="fa-brands fa-github" aria-hidden="true"></i>
					<span className="visually-hidden">GitHub</span>
				</a>

				<VolumeSlider />

				<button type="button" className="cc-tile cc-wide" onClick={() => launch('mail')}>
					<i className="fa-solid fa-envelope" aria-hidden="true"></i>
					<span>
						<strong>연락하기</strong>
						<small>{PROFILE.email}</small>
					</span>
				</button>
				<button type="button" className="cc-tile cc-wide" onClick={() => launch('messages')}>
					<i className="fa-solid fa-comment" aria-hidden="true"></i>
					<span>
						<strong>피드백 남기기</strong>
						<small>메시지에 감상과 의견을 남겨 주세요</small>
					</span>
				</button>
			</div>
		</div>
	);
};

export default ControlCenter;
