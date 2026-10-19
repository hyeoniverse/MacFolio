import { useEffect, useRef, useState } from 'react';
import '@/desktop/WallpaperVideo.css';
import { REDUCED_MOTION, useMediaQuery } from '@/shared/lib/media';
import { useSettings } from '@/shared/settings/settingsStore';
import type { WallpaperKind } from '@/shared/settings/customWallpapers';

/**
 * 동영상 배경화면 (macOS의 움직이는 배경화면처럼). 고른 더한 배경화면이 MP4일 때만 그린다.
 * 소리 없이 반복 재생하고 화면을 꽉 채운다 (object-fit: cover). 배경(CSS 변수)에는 포스터가 깔려 있어서,
 * 동영상을 불러오는 동안·못 틀 때·움직임 줄이기를 켰을 때는 멈춘 포스터가 보인다.
 * 탭이 가려지면 멈추고 다시 보이면 이어서 튼다.
 * 데스크톱은 문서 배경 위·창 아래에, 휴대폰은 홈 화면 배경 위·아이콘 아래에 깐다 (z-index -1)
 */
const WallpaperVideo = ({ kind }: { kind: WallpaperKind }) => {
	const settings = useSettings();
	const src = kind === 'mac' ? settings.wallpaperVideo : settings.mobileWallpaperVideo;
	const poster = kind === 'mac' ? settings.wallpaperImage : settings.mobileWallpaperImage;
	const reducedMotion = useMediaQuery(REDUCED_MOTION);
	const [failed, setFailed] = useState<string | null>(null);
	const video = useRef<HTMLVideoElement>(null);
	const show = src !== null && !reducedMotion && failed !== src;

	useEffect(() => {
		const element = video.current;
		if (!show || !element) return;
		// React의 muted 속성은 HTML 속성으로 쓰이지 않아, 자동 재생 규칙(소리 없는 동영상만)에 맞게 직접 켠다
		element.muted = true;
		const sync = () => {
			if (document.hidden) element.pause();
			else void element.play().catch(() => {});
		};
		sync();
		document.addEventListener('visibilitychange', sync);
		return () => document.removeEventListener('visibilitychange', sync);
	}, [show, src]);

	if (!show) return null;
	return (
		<video
			ref={video}
			key={src}
			className={`wallpaper-video wallpaper-video-${kind}`}
			src={src}
			poster={poster ?? undefined}
			muted
			loop
			autoPlay
			playsInline
			preload="auto"
			disablePictureInPicture
			disableRemotePlayback
			aria-hidden="true"
			tabIndex={-1}
			onError={() => setFailed(src)}
		/>
	);
};

export default WallpaperVideo;
