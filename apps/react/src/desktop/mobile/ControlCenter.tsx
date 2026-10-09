import { cssVars } from '@/shared/lib/cssVars';
import { useEffect, useState } from 'react';
import { useMusic } from '@/apps/music/useMusic';
import type { AppName } from '@/apps/manifest';
import MusicWidget from '@/desktop/mobile/MusicWidget';
import { PULL_OPEN_PX } from '@/desktop/mobile/swipe';
import { useVerticalSwipe } from '@/desktop/mobile/useVerticalSwipe';
import { IOS_WALLPAPERS } from '@/shared/settings/settings';
import { settingsStore, useSettings } from '@/shared/settings/settingsStore';
import { PROFILE } from '@/shared/profile';
import { signIn, useAdmin } from '@/shared/auth/adminStore';
import type { AdminStatus } from '@/shared/auth/admin';
import { env } from '@/shared/config/env';

/** 제어 센터의 관리자 타일에 보일 상태 */
const ADMIN_STATUS: Record<AdminStatus, (login: string | null) => string> = {
	disabled: () => '관리자 서버 준비 중',
	checking: () => '확인하는 중…',
	offline: () => '관리자 서버에 연결할 수 없음',
	'signed-out': () => 'GitHub로 로그인',
	'signed-in': (login) => `${login}(으)로 로그인됨`,
};

interface Props {
	/** 열려 있는지 */
	open: boolean;
	/** 아래로 쓸어 여는 중인 거리. 끄는 동안 패널이 손가락을 따라 내려온다 */
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
 * iOS 제어 센터. 화면 어디서든 아래로 쓸면 열리고, 빈 곳을 누르거나 어디서든 위로 쓸어 올리면 닫힌다.
 */
const ControlCenter = (props: Props) => (props.open || props.pull !== null ? <Panel {...props} /> : null);

const Panel = ({ open, pull, onClose, onLaunch }: Props) => {
	const settings = useSettings();
	const admin = useAdmin();
	/** 위로 쓸어 닫는 중인 거리 */
	const [lift, setLift] = useState<number | null>(null);
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

	// 타일 위에서 시작해도 위로 쓸면 닫힌다 (음량 막대처럼 스스로 끄는 것은 빼고). 패널이 손가락을 따라 올라간다
	useVerticalSwipe({
		enabled: open && !leaving,
		direction: 'up',
		onMove: setLift,
		onEnd: (distance) => {
			setLift(null);
			if (distance >= PULL_OPEN_PX) setLeaving(true);
		},
		onCancel: () => setLift(null),
	});

	const isDark = document.documentElement.dataset.theme === 'dark';
	const nextWallpaper = () => {
		// 제어 센터는 모바일에만 있으므로 홈 화면(iOS) 배경화면을 바꾼다
		const index = IOS_WALLPAPERS.findIndex((wallpaper) => wallpaper.id === settings.mobileWallpaper);
		settingsStore.setState({
			mobileWallpaper: IOS_WALLPAPERS[(index + 1) % IOS_WALLPAPERS.length].id,
			mobileWallpaperImage: null,
		});
	};
	const launch = (app: AppName) => {
		close();
		onLaunch(app);
	};

	// 쓰는 중에는 쓴 만큼만 보인다
	const travel = (distance: number) => Math.min(1, distance / (PULL_OPEN_PX * 4));
	const progress = leaving
		? 0
		: pull !== null
			? travel(pull)
			: lift !== null
				? 1 - travel(lift)
				: open && entered
					? 1
					: 0;
	const dragging = pull !== null || lift !== null;

	return (
		<div
			className={`control-center ${dragging ? 'dragging' : ''}`}
			role="dialog"
			aria-modal="true"
			aria-label="제어 센터"
			style={cssVars({ 'cc-progress': progress })}
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

				{/* 관리자: 로그인하지 않았으면 바로 GitHub 로그인, 로그인했거나 서버가 없으면 암호 앱 */}
				<button
					type="button"
					className={`cc-tile cc-wide cc-admin ${admin.status === 'signed-in' ? 'on' : ''}`}
					aria-pressed={admin.status === 'signed-in'}
					onClick={() => (admin.status === 'signed-out' ? signIn() : launch('passwords'))}
				>
					<img src={`${env.imageUrl}/passwords.svg`} alt="" />
					<span>
						<strong>관리자 로그인</strong>
						<small>{ADMIN_STATUS[admin.status](admin.login)}</small>
					</span>
				</button>
			</div>
		</div>
	);
};

export default ControlCenter;
