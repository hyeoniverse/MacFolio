import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import PhotosMobile from './PhotosMobile';
import AppWindow from '@/desktop/window/Window';
import { useAppState } from '@/desktop/AppStateContext';
import { useAppMenus } from '@/desktop/status-bar/appMenus';
import { requestOpen } from '@/shared/lib/openRequest';
import { ALBUMS, ALBUMS_BY_AGE, ALL_PHOTOS, countText } from './albums';
import { Thumb, Viewer, type Shown } from './PhotoParts';
import Menu from '@/shared/ui/menu/Menu';
import SidebarToggle from '@/shared/ui/button/SidebarToggle';
import { captionOf, loadCaptions, useCaptions } from './captions';
import '@/apps/photos/Photos.css';

/** 보는 곳: 보관함(모든 사진), 비디오만, 앨범 하나 */
type Place = { kind: 'all' } | { kind: 'videos' } | { kind: 'album'; id: string };

/** 격자 칸 크기 (−·+로 고른다) */
const CELL_SIZES = [110, 150, 200, 260] as const;
/** 창 폭: 이보다 좁으면 막대를 줄이고(보기 방식은 팝업, 프로젝트 페이지는 동그라미) 격자는 정사각형으로 채운다 */
const COMPACT_PX = 760;
/** 이보다 좁으면 사이드바는 처음에 접혀 있고, 열면 격자 위에 뜬다 (격자가 너무 좁아지지 않게) */
const OVERLAY_PX = 560;

/** 사진 창의 폭 (컨테이너 질의로 못 하는 것: 사이드바를 접을지, 막대 단추를 무엇으로 그릴지) */
function useWidth(element: React.RefObject<HTMLElement | null>) {
	const [width, setWidth] = useState(Infinity);
	useLayoutEffect(() => {
		const target = element.current;
		if (!target) return;
		// 관찰을 시작하면 곧바로 지금 폭을 한 번 알려 준다 (그리기 전에)
		const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
		observer.observe(target);
		return () => observer.disconnect();
	}, [element]);
	return width;
}

const PLACE_ICON: Record<'all' | 'videos', string> = {
	all: 'fa-solid fa-photo-film',
	videos: 'fa-solid fa-video',
};

/**
 * 사진 (#21): 프로젝트마다 페이지에 쓴 화면을 앨범으로 모아 본다. macOS 사진처럼 왼쪽에 보관함·앨범, 가운데 격자(사진을 자르지 않는다),
 * 위에 떠 있는 막대. 누르면 막대 아래를 가득 채워 크게 본다. 사진은 프로젝트 정보(shared/profile.ts)에서 꺼낸다
 */
const Photos = () => {
	const mobile = useIsMobile();
	const { openApp } = useAppState();
	const [place, setPlace] = useState<Place>({ kind: 'all' });
	// 보관함은 모든 사진을 한 격자로, 또는 앨범별로 나눠 본다
	const [grouped, setGrouped] = useState(false);
	const [size, setSize] = useState(1);
	const [viewing, setViewing] = useState<number | null>(null);
	// 창 폭에 따라: 좁으면 막대를 줄이고, 더 좁으면 사이드바를 접는다 (macOS 사진). 사이드바 단추로 직접 여닫으면 그것을 따른다
	const shell = useRef<HTMLDivElement>(null);
	const width = useWidth(shell);
	const compact = width < COMPACT_PX;
	const overlay = width < OVERLAY_PX;
	const [sidebarChoice, setSidebarChoice] = useState<boolean | null>(null);
	const sidebarOpen = sidebarChoice ?? !overlay;
	const toggleSidebar = () => setSidebarChoice(!sidebarOpen);
	const [viewMenu, setViewMenu] = useState<{ x: number; y: number } | null>(null);
	const viewButton = useRef<HTMLButtonElement>(null);
	// 관리자가 고친 캡션 (서버). 앱을 열 때 한 번 받는다
	const captions = useCaptions();
	useEffect(() => loadCaptions(), []);
	const album = place.kind === 'album' ? ALBUMS.find((entry) => entry.id === place.id) : undefined;
	const photos: Shown[] = album
		? album.photos.map((photo) => ({ ...photo, album }))
		: place.kind === 'videos'
			? ALL_PHOTOS.filter((photo) => photo.video)
			: ALL_PHOTOS;
	const title = album?.name ?? (place.kind === 'videos' ? '비디오' : '보관함');
	const showGroups = place.kind === 'all' && grouped;
	// 격자는 맨 아래(최신)부터 보인다. 크게 보기는 격자 위에 열려 닫으면 보던 자리 그대로
	const scrollBox = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		if (scrollBox.current) scrollBox.current.scrollTop = scrollBox.current.scrollHeight;
	}, [place, grouped, mobile]);

	const go = (next: Place) => {
		setPlace(next);
		setViewing(null);
		// 격자 위에 뜬 사이드바는 고르면 접는다
		if (overlay) setSidebarChoice(null);
	};
	const openProject = (id: string) => {
		requestOpen('safari', id);
		openApp('safari');
	};
	const zoomGrid = (delta: number) => setSize((value) => Math.min(CELL_SIZES.length - 1, Math.max(0, value + delta)));

	useAppMenus('photos', [
		{
			title: '보기',
			items: [
				{ label: '보관함', checked: place.kind === 'all', onSelect: () => go({ kind: 'all' }) },
				{ label: '비디오', checked: place.kind === 'videos', onSelect: () => go({ kind: 'videos' }) },
				'separator',
				...ALBUMS.map((entry) => ({
					label: entry.name,
					checked: album?.id === entry.id,
					onSelect: () => go({ kind: 'album', id: entry.id }),
				})),
				'separator',
				{ label: '확대', onSelect: () => zoomGrid(1) },
				{ label: '축소', onSelect: () => zoomGrid(-1) },
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

	const placeButton = (target: Place, label: string, icon: React.ReactNode, count: number) => {
		const selected =
			target.kind === place.kind && (target.kind !== 'album' || (place.kind === 'album' && place.id === target.id));
		return (
			<button
				key={target.kind === 'album' ? target.id : target.kind}
				type="button"
				className={`photos-place ${selected ? 'selected' : ''}`}
				aria-current={selected || undefined}
				onClick={() => go(target)}
			>
				{icon}
				<span className="photos-place-label">{label}</span>
				<span className="photos-count">{count}</span>
			</button>
		);
	};

	const cell = (photo: Shown, index: number) => (
		<li key={`${photo.album.id}:${photo.src}`}>
			<button
				type="button"
				className="photos-thumb"
				aria-label={`${photo.album.name}: ${captionOf(photo, captions)}${photo.video ? ' (영상)' : ''}`}
				title={captionOf(photo, captions)}
				onClick={() => setViewing(index)}
			>
				<Thumb photo={photo} />
			</button>
		</li>
	);

	return (
		<AppWindow title="사진" appName="photos" chrome="unified">
			{/* 휴대폰은 iOS 사진처럼 따로 짠다 (PhotosMobile) */}
			{mobile ? (
				<PhotosMobile onOpenProject={openProject} />
			) : (
				<div ref={shell} className="photos-shell">
					<div
						className={`photos ${sidebarOpen ? '' : 'no-sidebar'} ${sidebarOpen && overlay ? 'overlay' : ''} ${compact ? 'compact' : ''}`}
						style={{ '--photos-cell': `${CELL_SIZES[size]}px` } as React.CSSProperties}
					>
						<aside className="photos-sidebar" aria-label="사진 보관함" hidden={!sidebarOpen}>
							<div className="photos-sidebar-top">
								<SidebarToggle open onToggle={toggleSidebar} className="photos-sidebar-toggle" />
							</div>
							{placeButton(
								{ kind: 'all' },
								'보관함',
								<i className={PLACE_ICON.all} aria-hidden="true" />,
								ALL_PHOTOS.length
							)}
							<p className="photos-sidebar-heading">고정됨</p>
							{placeButton(
								{ kind: 'videos' },
								'비디오',
								<i className={PLACE_ICON.videos} aria-hidden="true" />,
								ALL_PHOTOS.filter((photo) => photo.video).length
							)}
							<p className="photos-sidebar-heading">앨범</p>
							{ALBUMS.map((entry) =>
								placeButton(
									{ kind: 'album', id: entry.id },
									entry.name,
									<span className="photos-album-cover" aria-hidden="true">
										{entry.photos.find((photo) => !photo.video) && (
											<img src={entry.photos.find((photo) => !photo.video)!.src} alt="" loading="lazy" />
										)}
									</span>,
									entry.photos.length
								)
							)}
						</aside>

						<section
							className="photos-main"
							aria-label={title}
							// 격자 위에 뜬 사이드바는 격자 쪽을 누르면 접힌다
							onPointerDown={overlay && sidebarOpen ? () => setSidebarChoice(null) : undefined}
						>
							<div ref={scrollBox} className="photos-scroll">
								{showGroups ? (
									ALBUMS_BY_AGE.map((entry) => {
										const start = photos.findIndex((photo) => photo.album.id === entry.id);
										return (
											<section key={entry.id} className="photos-group" aria-label={entry.name}>
												<h3>
													<button type="button" onClick={() => go({ kind: 'album', id: entry.id })}>
														{entry.name} <i className="fa-solid fa-chevron-right" aria-hidden="true" />
													</button>
												</h3>
												<ul className="photos-grid">
													{photos
														.filter((photo) => photo.album.id === entry.id)
														.map((photo, offset) => cell(photo, start + offset))}
												</ul>
											</section>
										);
									})
								) : (
									<ul className="photos-grid">{photos.map(cell)}</ul>
								)}
							</div>
							{/* 떠 있는 막대는 격자 뒤에 둔다: z-index 없이도 격자 위에 그려지고, 안의 단추가 창 끌기 영역 위로 올라간다 */}
							{viewing === null && (
								<header className="photos-toolbar">
									{!sidebarOpen && (
										<SidebarToggle open={false} onToggle={toggleSidebar} className="photos-sidebar-toggle" />
									)}
									<div className="photos-toolbar-heading">
										<h2>{title}</h2>
										<p>{countText(photos)}</p>
									</div>
									<div className="photos-toolbar-group">
										<div className="photos-capsule">
											<button type="button" aria-label="축소" disabled={size === 0} onClick={() => zoomGrid(-1)}>
												<i className="fa-solid fa-minus" aria-hidden="true" />
											</button>
											<button
												type="button"
												aria-label="확대"
												disabled={size === CELL_SIZES.length - 1}
												onClick={() => zoomGrid(1)}
											>
												<i className="fa-solid fa-plus" aria-hidden="true" />
											</button>
										</div>
										{place.kind === 'all' && compact && (
											// 좁은 창: 보기 방식은 팝업 단추 하나로 (macOS 사진의 "모든 사진 ⌃⌄")
											<button
												ref={viewButton}
												type="button"
												className="photos-pill photos-view-button"
												aria-label={`보기 방식: ${grouped ? '앨범별' : '모든 사진'}`}
												aria-haspopup="menu"
												aria-expanded={viewMenu !== null}
												onClick={(event) => {
													const rect = event.currentTarget.getBoundingClientRect();
													setViewMenu(viewMenu ? null : { x: rect.left, y: rect.bottom + 6 });
												}}
											>
												{grouped ? '앨범별' : '모든 사진'}
												<i className="fa-solid fa-sort" aria-hidden="true" />
											</button>
										)}
										{place.kind === 'all' && !compact && (
											<div className="photos-capsule photos-segments" role="group" aria-label="보기 방식">
												<button type="button" aria-pressed={grouped} onClick={() => setGrouped(true)}>
													앨범별
												</button>
												<button type="button" aria-pressed={!grouped} onClick={() => setGrouped(false)}>
													모든 사진
												</button>
											</div>
										)}
									</div>
									<div className="photos-toolbar-group end">
										{album &&
											(compact ? (
												<button
													type="button"
													className="photos-circle"
													aria-label="프로젝트 페이지"
													title="프로젝트 페이지"
													onClick={() => openProject(album.id)}
												>
													<i className="fa-regular fa-compass" aria-hidden="true" />
												</button>
											) : (
												<button type="button" className="photos-pill" onClick={() => openProject(album.id)}>
													프로젝트 페이지
												</button>
											))}
									</div>
								</header>
							)}
							{viewMenu && (
								<Menu
									label="보기 방식"
									anchor={viewMenu}
									trigger={viewButton}
									onClose={() => setViewMenu(null)}
									items={[
										{ label: '앨범별', checked: grouped, onSelect: () => setGrouped(true) },
										{ label: '모든 사진', checked: !grouped, onSelect: () => setGrouped(false) },
									]}
								/>
							)}
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
			)}
		</AppWindow>
	);
};

export default Photos;
