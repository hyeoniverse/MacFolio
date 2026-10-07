import { useEffect, useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import { useAppState } from '@/desktop/AppStateContext';
import { useAppMenus } from '@/desktop/status-bar/appMenus';
import { requestOpen } from '@/shared/lib/openRequest';
import { ALBUMS, ALL_PHOTOS, type Album, type Photo } from './albums';
import '@/apps/photos/Photos.css';

type Shown = Photo & { album: Album };
/** 보는 곳: 모든 사진 또는 앨범 하나 */
type Place = { kind: 'all' } | { kind: 'album'; id: string };

/** 격자의 칸: 사진은 지연 로딩, 영상은 첫 장면만 */
const Thumb = ({ photo }: { photo: Shown }) =>
	photo.video ? (
		<>
			<video src={`${photo.src}#t=0.1`} muted playsInline preload="metadata" aria-hidden="true" />
			<i className="fa-solid fa-play photos-video-badge" aria-hidden="true" />
		</>
	) : (
		<img src={photo.src} alt="" loading="lazy" decoding="async" draggable={false} />
	);

/** 크게 보기: ←·→로 넘기고 Esc로 닫는다. 프로젝트 페이지(Safari)로 갈 수 있다 */
const Viewer = ({
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
	const move = (delta: number) => onMove((index + delta + photos.length) % photos.length);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
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
		<div className="photos-viewer" role="dialog" aria-label={`사진 ${index + 1}/${photos.length}: ${photo.caption}`}>
			<header className="photos-viewer-bar">
				<button type="button" onClick={onClose} aria-label="닫기">
					<i className="fa-solid fa-chevron-left" aria-hidden="true" /> 돌아가기
				</button>
				<span className="photos-viewer-count">
					{index + 1} / {photos.length}
				</span>
				<button type="button" onClick={() => onOpenProject(photo.album.id)}>
					{photo.album.name} 페이지 <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
				</button>
			</header>
			<div className="photos-viewer-stage">
				<button type="button" className="photos-viewer-nav prev" aria-label="이전 사진" onClick={() => move(-1)}>
					<i className="fa-solid fa-chevron-left" aria-hidden="true" />
				</button>
				{photo.video ? (
					<video key={photo.src} src={photo.src} controls autoPlay muted playsInline />
				) : (
					<img key={photo.src} src={photo.src} alt={photo.caption} draggable={false} />
				)}
				<button type="button" className="photos-viewer-nav next" aria-label="다음 사진" onClick={() => move(1)}>
					<i className="fa-solid fa-chevron-right" aria-hidden="true" />
				</button>
			</div>
			<p className="photos-viewer-caption">
				<strong>{photo.album.name}</strong> {photo.caption}
			</p>
		</div>
	);
};

/**
 * 사진 (#21): 프로젝트마다 페이지에 쓴 화면을 앨범으로 모아 본다. macOS 사진처럼 왼쪽에 보관함·앨범, 가운데 격자,
 * 누르면 크게 보기. 사진은 프로젝트 정보(shared/profile.ts)에서 꺼내므로 따로 목록을 관리하지 않는다
 */
const Photos = () => {
	const { openApp } = useAppState();
	const [place, setPlace] = useState<Place>({ kind: 'all' });
	const [viewing, setViewing] = useState<number | null>(null);
	const album = place.kind === 'album' ? ALBUMS.find((entry) => entry.id === place.id) : undefined;
	const photos: Shown[] = album ? album.photos.map((photo) => ({ ...photo, album })) : ALL_PHOTOS;
	const title = album?.name ?? '모든 사진';

	const go = (next: Place) => {
		setPlace(next);
		setViewing(null);
	};
	const openProject = (id: string) => {
		requestOpen('safari', id);
		openApp('safari');
	};

	useAppMenus('photos', [
		{
			title: '보기',
			items: [
				{ label: '모든 사진', checked: place.kind === 'all', onSelect: () => go({ kind: 'all' }) },
				'separator',
				...ALBUMS.map((entry) => ({
					label: entry.name,
					checked: album?.id === entry.id,
					onSelect: () => go({ kind: 'album', id: entry.id }),
				})),
			],
		},
		...(viewing !== null
			? [
					{
						title: '이동',
						items: [
							{
								label: '이전 사진',
								onSelect: () => setViewing((viewing - 1 + photos.length) % photos.length),
							},
							{ label: '다음 사진', onSelect: () => setViewing((viewing + 1) % photos.length) },
							'separator' as const,
							{ label: '돌아가기', onSelect: () => setViewing(null) },
						],
					},
				]
			: []),
	]);

	return (
		<AppWindow title="사진" appName="photos" chrome="unified">
			<div className="photos-shell">
				<div className="photos">
					<aside className="photos-sidebar" aria-label="사진 보관함">
						<div className="photos-sidebar-top" />
						<p className="photos-sidebar-heading">보관함</p>
						<button
							type="button"
							className={`photos-place ${place.kind === 'all' ? 'selected' : ''}`}
							aria-current={place.kind === 'all' || undefined}
							onClick={() => go({ kind: 'all' })}
						>
							<i className="fa-regular fa-images" aria-hidden="true" />
							<span>모든 사진</span>
							<span className="photos-count">{ALL_PHOTOS.length}</span>
						</button>
						<p className="photos-sidebar-heading">앨범</p>
						{ALBUMS.map((entry) => (
							<button
								key={entry.id}
								type="button"
								className={`photos-place ${album?.id === entry.id ? 'selected' : ''}`}
								aria-current={album?.id === entry.id || undefined}
								onClick={() => go({ kind: 'album', id: entry.id })}
							>
								<i className="fa-regular fa-folder" aria-hidden="true" />
								<span>{entry.name}</span>
								<span className="photos-count">{entry.photos.length}</span>
							</button>
						))}
					</aside>

					<section className="photos-main" aria-label={title}>
						<header className="photos-header">
							<h2>{title}</h2>
							<p>
								사진 {photos.filter((photo) => !photo.video).length}장
								{photos.some((photo) => photo.video) && `, 영상 ${photos.filter((photo) => photo.video).length}개`}
							</p>
							{album && viewing === null && (
								<button type="button" className="photos-project-link" onClick={() => openProject(album.id)}>
									프로젝트 페이지 <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
								</button>
							)}
						</header>
						{/* 휴대폰: 사이드바 대신 앨범을 가로로 고른다 */}
						{viewing === null && (
							<nav className="photos-chips" aria-label="앨범 고르기">
								<button type="button" aria-pressed={place.kind === 'all'} onClick={() => go({ kind: 'all' })}>
									모든 사진
								</button>
								{ALBUMS.map((entry) => (
									<button
										key={entry.id}
										type="button"
										aria-pressed={album?.id === entry.id}
										onClick={() => go({ kind: 'album', id: entry.id })}
									>
										{entry.name}
									</button>
								))}
							</nav>
						)}
						<ul className="photos-grid">
							{photos.map((photo, index) => (
								<li key={`${photo.album.id}:${photo.src}`}>
									<button
										type="button"
										className="photos-thumb"
										aria-label={`${photo.album.name}: ${photo.caption}${photo.video ? ' (영상)' : ''}`}
										title={photo.caption}
										onClick={() => setViewing(index)}
									>
										<Thumb photo={photo} />
									</button>
								</li>
							))}
						</ul>
						{viewing !== null && photos[viewing] && (
							<Viewer
								photos={photos}
								index={viewing}
								onMove={setViewing}
								onClose={() => setViewing(null)}
								onOpenProject={openProject}
							/>
						)}
					</section>
				</div>
			</div>
		</AppWindow>
	);
};

export default Photos;
