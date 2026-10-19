import React, { useEffect, useRef, useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import { useAppState } from '@/desktop/useAppState';
import { fileUrl } from '@/apps/finder/documents';
import { mediaKind } from '@/apps/finder/files';
import OpenPanel, { type OpenPanelApp } from '@/apps/preview/OpenPanel';
import { openInPlayer, resetPlayer, usePlayer, type PlayerFile } from './playerStore';
import PlayerControls from './PlayerControls';
import './QuickTime.css';

/** 재생 화면: 영상(소리는 음표)과 떠 있는 재생 막대. 마우스를 움직이면 막대가 나오고, 재생 중 2.5초 가만히 있으면 사라진다. 화면을 누르면 재생·멈춤 */
const Stage: React.FC<{ file: PlayerFile }> = ({ file }) => {
	const [media, setMedia] = useState<HTMLMediaElement | null>(null);
	const [active, setActive] = useState(true);
	const timer = useRef<number | undefined>(undefined);
	const wake = () => {
		setActive(true);
		window.clearTimeout(timer.current);
		timer.current = window.setTimeout(() => setActive(false), 2500);
	};
	useEffect(() => () => window.clearTimeout(timer.current), []);
	// 멈춰 있으면 막대를 늘 보인다
	const [paused, setPaused] = useState(true);
	useEffect(() => {
		if (!media) return;
		const sync = () => setPaused(media.paused);
		sync();
		media.addEventListener('play', sync);
		media.addEventListener('pause', sync);
		return () => {
			media.removeEventListener('play', sync);
			media.removeEventListener('pause', sync);
		};
	}, [media]);
	const toggle = () => media && (media.paused ? void media.play().catch(() => undefined) : media.pause());
	return (
		<div
			className={`quicktime-stage${active || paused ? '' : ' idle'}`}
			onPointerMove={wake}
			onPointerLeave={() => setActive(false)}
			onClick={toggle}
		>
			{file.media === 'video' ? (
				<video
					ref={setMedia}
					className="quicktime-video"
					src={fileUrl(file.key)}
					autoPlay
					playsInline
					aria-label={file.name}
				/>
			) : (
				<div className="quicktime-audio">
					<i className="fa-solid fa-music" aria-hidden="true" />
					<p>{file.name}</p>
					<audio ref={setMedia} src={fileUrl(file.key)} autoPlay aria-label={file.name} />
				</div>
			)}
			<PlayerControls media={media} fileKey={file.key} name={file.name} visible={active || paused} />
		</div>
	);
};

/** 열기 창: 동영상·소리 파일만 열 수 있다 */
const OPEN_APP: OpenPanelApp = {
	name: 'QuickTime Player',
	icon: '/imgs/quicktime.svg',
	canOpen: (item) => item.kind === 'file' && mediaKind(item.name) !== null,
};

/**
 * QuickTime Player (macOS처럼): Finder·바탕화면에서 연 동영상·소리 파일을 재생한다. 검은 바탕에 macOS처럼 떠 있는 재생 막대(소리·뒤로·재생·앞으로·PIP·공유·속도, 시간 막대).
 * 파일 없이 열면 미리보기와 같은 열기 창이 뜬다 (동영상·소리가 아닌 파일은 흐리게). 창을 닫으면 비운다 (다음에 열면 고르기부터)
 */
const QuickTime: React.FC = () => {
	const file = usePlayer();
	const { apps, closeApp } = useAppState();

	// 빨간 버튼으로 닫으면 비운다 (미리보기와 같다)
	const running = apps.quicktime.isRunning;
	const wasRunning = useRef(running);
	useEffect(() => {
		if (wasRunning.current && !running) resetPlayer();
		wasRunning.current = running;
	}, [running]);

	if (!file)
		return (
			<AppWindow title="QuickTime Player" appName="quicktime" chrome="unified">
				<OpenPanel
					app={OPEN_APP}
					onOpen={(item) => openInPlayer({ key: item.key, name: item.name, media: mediaKind(item.name)! })}
					onCancel={() => closeApp('quicktime')}
				/>
			</AppWindow>
		);

	return (
		<AppWindow title={file.name} appName="quicktime">
			<div className="quicktime playing">
				<Stage key={file.key} file={file} />
			</div>
		</AppWindow>
	);
};

export default QuickTime;
