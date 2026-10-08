// 사진 앱의 데스크톱·휴대폰 화면이 함께 쓰는 것: 사진 칸, 크게 보기
import { useEffect, useState } from 'react';
import { shareLink } from '@/shared/lib/appLink';
import { useAdmin } from '@/shared/auth/adminStore';
import type { Album, Photo } from './albums';
import { CAPTION_MAX } from './albums';
import { captionOf, saveCaption, useCaptions } from './captions';

/** 화면에 보이는 사진 (어느 앨범의 것인지 함께) */
export type Shown = Photo & { album: Album };

/** 크게 보기의 확대 (− 막대 +) */
const ZOOM = { min: 1, max: 3, step: 0.25 } as const;

/** 영상 길이: 0:12, 1:05 */
const formatLength = (seconds: number) =>
	`${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/** 영상 칸: 첫 장면과 길이 (길이는 영상의 앞부분만 받아 안다) */
const VideoThumb = ({ src }: { src: string }) => {
	const [length, setLength] = useState<number | null>(null);
	return (
		<>
			<video
				src={`${src}#t=0.1`}
				muted
				playsInline
				preload="metadata"
				aria-hidden="true"
				onLoadedMetadata={(event) => setLength(event.currentTarget.duration)}
			/>
			<span className="photos-video-badge" aria-hidden="true">
				{length !== null && Number.isFinite(length) ? formatLength(length) : <i className="fa-solid fa-play" />}
			</span>
		</>
	);
};

/** 격자의 칸: 사진은 지연 로딩, 영상은 첫 장면과 길이 */
export const Thumb = ({ photo }: { photo: Shown }) =>
	photo.video ? (
		<VideoThumb src={photo.src} />
	) : (
		<img src={photo.src} alt="" loading="lazy" decoding="async" draggable={false} />
	);

/**
 * 사진 캡션. 관리자에게는 입력 칸: Enter나 칸을 벗어나면 저장하고, Esc로 되돌린다. 비우고 저장하면 원래 캡션으로 돌아간다.
 * 방문자에게는 글자 (사진마다 key로 새로 그린다)
 */
export const CaptionField = ({ photo, className }: { photo: Photo; className?: string }) => {
	const admin = useAdmin().status === 'signed-in';
	const current = captionOf(photo, useCaptions());
	const [draft, setDraft] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	if (!admin) return <p className={className}>{current}</p>;

	const commit = async () => {
		if (draft === null || draft.trim() === current) {
			setDraft(null);
			return;
		}
		setSaving(true);
		setError(null);
		try {
			await saveCaption(photo.src, draft);
			setDraft(null);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : '캡션을 저장하지 못했습니다.');
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className={`photos-caption-field ${className ?? ''}`}>
			<input
				aria-label="캡션"
				placeholder="캡션 추가"
				maxLength={CAPTION_MAX}
				value={draft ?? current}
				disabled={saving}
				onChange={(event) => setDraft(event.target.value)}
				onBlur={() => void commit()}
				onKeyDown={(event) => {
					if (event.key === 'Enter') event.currentTarget.blur();
					else if (event.key === 'Escape') {
						// 고치던 것만 되돌린다 (크게 보기를 닫지 않는다)
						event.preventDefault();
						event.stopPropagation();
						setDraft(null);
						setError(null);
					}
				}}
			/>
			{error && (
				<span className="photos-caption-error" role="alert">
					{error}
				</span>
			)}
		</div>
	);
};

/** 크게 보기 (macOS 사진처럼 막대 아래를 가득): ←·→로 넘기고 Esc로 닫는다. 막대로 확대한다 */
export const Viewer = ({
	photos,
	index,
	onMove,
	onClose,
	onOpenProject,
}: {
	photos: Shown[];
	index: number;
	onMove: (index: number) => void;
	onClose: () => void;
	onOpenProject: (id: string) => void;
}) => {
	const photo = photos[index];
	const caption = captionOf(photo, useCaptions());
	const [zoom, setZoom] = useState<number>(ZOOM.min);
	const [info, setInfo] = useState(false);
	const move = (delta: number) => {
		setZoom(ZOOM.min);
		onMove((index + delta + photos.length) % photos.length);
	};

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			// 캡션 칸 안의 키는 칸의 것이다
			if (event.target instanceof HTMLInputElement || event.defaultPrevented) return;
			if (event.key === 'Escape') onClose();
			else if (event.key === 'ArrowLeft') move(-1);
			else if (event.key === 'ArrowRight') move(1);
			else return;
			event.preventDefault();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	return (
		<div className="photos-viewer" role="dialog" aria-label={`사진 ${index + 1}/${photos.length}: ${caption}`}>
			<header className="photos-toolbar viewer">
				<div className="photos-toolbar-group">
					<button type="button" className="photos-circle" onClick={onClose} aria-label="돌아가기">
						<i className="fa-solid fa-chevron-left" aria-hidden="true" />
					</button>
					{!photo.video && (
						<div className="photos-capsule photos-zoom">
							<button
								type="button"
								aria-label="축소"
								onClick={() => setZoom((value) => Math.max(ZOOM.min, value - ZOOM.step))}
							>
								−
							</button>
							<input
								type="range"
								aria-label="확대"
								min={ZOOM.min}
								max={ZOOM.max}
								step={ZOOM.step}
								value={zoom}
								onChange={(event) => setZoom(Number(event.target.value))}
							/>
							<button
								type="button"
								aria-label="확대하기"
								onClick={() => setZoom((value) => Math.min(ZOOM.max, value + ZOOM.step))}
							>
								+
							</button>
						</div>
					)}
				</div>
				<div className="photos-toolbar-title">
					<strong>{caption}</strong>
					<span>
						{index + 1}/{photos.length}
					</span>
				</div>
				<div className="photos-toolbar-group end">
					<div className="photos-capsule">
						<button
							type="button"
							aria-label="정보"
							aria-pressed={info}
							className={info ? 'on' : undefined}
							onClick={() => setInfo((value) => !value)}
						>
							<i className="fa-solid fa-circle-info" aria-hidden="true" />
						</button>
						<button
							type="button"
							aria-label="프로젝트 페이지 링크 공유"
							onClick={() => void shareLink({ app: 'safari', id: photo.album.id }, photo.album.name)}
						>
							<i className="fa-solid fa-arrow-up-from-bracket" aria-hidden="true" />
						</button>
					</div>
					{/* 좁은 창에서는 나침반 동그라미만 (Photos.css) */}
					<button
						type="button"
						className="photos-pill photos-project-button"
						aria-label={`${photo.album.name} 페이지`}
						title={`${photo.album.name} 페이지`}
						onClick={() => onOpenProject(photo.album.id)}
					>
						<i className="fa-regular fa-compass" aria-hidden="true" />
						<span>{photo.album.name} 페이지</span>
					</button>
				</div>
			</header>
			<div className="photos-viewer-body">
				<div className={`photos-viewer-stage ${zoom > 1 ? 'zoomed' : ''}`}>
					{photo.video ? (
						<video key={photo.src} src={photo.src} controls autoPlay muted playsInline />
					) : (
						<img
							key={photo.src}
							src={photo.src}
							alt={caption}
							draggable={false}
							style={zoom > 1 ? { width: `${zoom * 100}%`, maxWidth: 'none', maxHeight: 'none' } : undefined}
						/>
					)}
					<button type="button" className="photos-viewer-nav prev" aria-label="이전 사진" onClick={() => move(-1)}>
						<i className="fa-solid fa-chevron-left" aria-hidden="true" />
					</button>
					<button type="button" className="photos-viewer-nav next" aria-label="다음 사진" onClick={() => move(1)}>
						<i className="fa-solid fa-chevron-right" aria-hidden="true" />
					</button>
				</div>
				{info && (
					<aside className="photos-info" aria-label="사진 정보">
						<CaptionField key={photo.src} photo={photo} className="photos-info-caption" />
						<dl>
							<dt>앨범</dt>
							<dd>{photo.album.name}</dd>
							<dt>종류</dt>
							<dd>{photo.video ? '영상' : '사진'}</dd>
							<dt>파일</dt>
							<dd>{photo.src.split('/').pop()}</dd>
						</dl>
					</aside>
				)}
			</div>
		</div>
	);
};
