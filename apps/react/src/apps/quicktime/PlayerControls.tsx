import React, { useEffect, useRef, useState } from 'react';
import {
	ChevronsRight,
	FastForward,
	Pause,
	PictureInPicture2,
	Play,
	Rewind,
	Share,
	Volume1,
	Volume2,
	VolumeX,
} from 'lucide-react';
import { downloadFile } from '@/apps/finder/documents';
import { formatTime } from './time';

/** 재생 요소의 값을 바꾼다 (React가 넘겨받은 요소를 직접 고치지 않게 한 곳에서) */
function update(
	media: HTMLMediaElement,
	patch: Partial<Pick<HTMLMediaElement, 'currentTime' | 'volume' | 'muted' | 'playbackRate'>>
) {
	Object.assign(media, patch);
}

const SPEEDS = [1, 1.25, 1.5, 2, 0.5];

/**
 * macOS QuickTime Player의 떠 있는 재생 막대: 아래 가운데의 반투명 둥근 판.
 * 위 줄은 소리(아이콘·막대), 가운데 뒤로·재생·앞으로, 오른쪽 PIP·공유(받기)·속도. 아래 줄은 지난 시간·위치 막대·전체 시간
 */
const PlayerControls: React.FC<{
	media: HTMLMediaElement | null;
	fileKey: string;
	name: string;
	visible: boolean;
}> = ({ media, fileKey, name, visible }) => {
	const [playing, setPlaying] = useState(false);
	const [time, setTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [volume, setVolume] = useState(1);
	const [muted, setMuted] = useState(false);
	const [speed, setSpeed] = useState(1);
	const seeking = useRef(false);

	useEffect(() => {
		if (!media) return;
		const sync = () => {
			setPlaying(!media.paused);
			if (!seeking.current) setTime(media.currentTime);
			setDuration(media.duration || 0);
			setVolume(media.volume);
			setMuted(media.muted);
			setSpeed(media.playbackRate);
		};
		sync();
		const events = ['play', 'pause', 'timeupdate', 'durationchange', 'loadedmetadata', 'volumechange', 'ratechange'];
		events.forEach((event) => media.addEventListener(event, sync));
		return () => events.forEach((event) => media.removeEventListener(event, sync));
	}, [media]);

	if (!media) return null;
	const toggle = () => (media.paused ? void media.play().catch(() => undefined) : media.pause());
	const skip = (delta: number) => {
		update(media, {
			currentTime: Math.min(Math.max(0, media.currentTime + delta), duration || media.currentTime + delta),
		});
	};
	const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
	const video = media instanceof HTMLVideoElement ? media : null;
	const pip = video && 'requestPictureInPicture' in video && document.pictureInPictureEnabled;

	return (
		<div
			className={`qt-controls${visible ? '' : ' hidden'}`}
			role="group"
			aria-label="재생 막대"
			onClick={(event) => event.stopPropagation()}
			onDoubleClick={(event) => event.stopPropagation()}
		>
			<div className="qt-row">
				<div className="qt-volume">
					<button
						type="button"
						aria-label={muted ? '소리 켜기' : '소리 끄기'}
						onClick={() => update(media, { muted: !media.muted })}
					>
						<VolumeIcon size={20} strokeWidth={2} />
					</button>
					<input
						type="range"
						className="qt-slider"
						aria-label="음량"
						min={0}
						max={1}
						step={0.01}
						value={muted ? 0 : volume}
						style={{ '--fill': `${(muted ? 0 : volume) * 100}%` } as React.CSSProperties}
						onChange={(event) => {
							const next = Number(event.target.value);
							update(media, { volume: next, muted: next === 0 });
						}}
					/>
				</div>
				<div className="qt-transport">
					<button type="button" aria-label="10초 뒤로" onClick={() => skip(-10)}>
						<Rewind size={24} fill="currentColor" strokeWidth={0} />
					</button>
					<button type="button" className="qt-play" aria-label={playing ? '일시 정지' : '재생'} onClick={toggle}>
						{playing ? (
							<Pause size={34} fill="currentColor" strokeWidth={0} />
						) : (
							<Play size={34} fill="currentColor" strokeWidth={0} />
						)}
					</button>
					<button type="button" aria-label="10초 앞으로" onClick={() => skip(10)}>
						<FastForward size={24} fill="currentColor" strokeWidth={0} />
					</button>
				</div>
				<div className="qt-extra">
					{pip && (
						<button
							type="button"
							aria-label="PIP 모드로 보기"
							onClick={() =>
								document.pictureInPictureElement
									? void document.exitPictureInPicture()
									: void video!.requestPictureInPicture().catch(() => undefined)
							}
						>
							<PictureInPicture2 size={20} strokeWidth={1.8} />
						</button>
					)}
					<button type="button" aria-label="공유 (받기)" onClick={() => downloadFile(fileKey, name)}>
						<Share size={20} strokeWidth={1.8} />
					</button>
					<button
						type="button"
						aria-label={`재생 속도 ${speed}배`}
						title={`재생 속도 ${speed}×`}
						onClick={() => update(media, { playbackRate: SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] })}
					>
						{speed === 1 ? <ChevronsRight size={22} strokeWidth={1.8} /> : <span className="qt-speed">{speed}×</span>}
					</button>
				</div>
			</div>
			<div className="qt-row qt-timeline">
				<span className="qt-time">{formatTime(time)}</span>
				<input
					type="range"
					className="qt-slider"
					aria-label="재생 위치"
					min={0}
					max={duration || 0}
					step={0.1}
					value={Math.min(time, duration || 0)}
					style={{ '--fill': `${duration ? (time / duration) * 100 : 0}%` } as React.CSSProperties}
					onPointerDown={() => (seeking.current = true)}
					onPointerUp={() => (seeking.current = false)}
					onChange={(event) => {
						const next = Number(event.target.value);
						setTime(next);
						update(media, { currentTime: next });
					}}
				/>
				<span className="qt-time">{formatTime(duration)}</span>
			</div>
		</div>
	);
};

export default PlayerControls;
