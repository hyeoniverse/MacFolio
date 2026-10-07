import { useEffect, useRef, useState } from 'react';
import MobileNavigation from '@/desktop/window/MobileNavigation';
import Menu from '@/shared/ui/menu/Menu';
import { shareLink } from '@/shared/lib/appLink';
import { ALBUMS, ALL_PHOTOS, countText, fileNameOf, formatBytes, formatOf, megapixels, type Album } from './albums';
import { Thumb, type Shown } from './PhotoParts';
import '@/apps/photos/Photos.css';
import '@/apps/photos/PhotosMobile.css';

type Tab = 'library' | 'collections';
/** 모음에서 들어간 곳: 앨범 하나, 또는 비디오만 */
type Opened = { kind: 'album'; id: string } | { kind: 'videos' } | null;
/** 크게 보는 사진: 어느 목록의 몇 번째인지 */
type Viewing = { photos: Shown[]; index: number } | null;

const VIDEOS = ALL_PHOTOS.filter((photo) => photo.video);
/** 앨범의 대표 사진 (영상이 아닌 첫 사진) */
const coverOf = (album: Album) => album.photos.find((photo) => !photo.video)?.src;
/** 사진 하나를 가리키는 키 (같은 파일이 여러 앨범에 있어도 앨범까지 구분한다) */
const keyOf = (photo: Shown) => `${photo.album.id}:${photo.src}`;

/** 검색: 사진 설명이나 앨범 이름에 검색어가 들어간 사진 (대소문자 무시) */
const searchPhotos = (query: string) => {
	const needle = query.trim().toLowerCase();
	return needle
		? ALL_PHOTOS.filter((photo) => `${photo.caption} ${photo.album.name}`.toLowerCase().includes(needle))
		: [];
};

/** 꽉 찬 격자: iOS 사진처럼 칸 사이 1px, 사진은 칸을 채운다 */
const Grid = ({ photos, onOpen }: { photos: Shown[]; onOpen: (index: number) => void }) => (
	<ul className="photos-phone-grid">
		{photos.map((photo, index) => (
			<li key={keyOf(photo)}>
				<button
					type="button"
					className="photos-thumb"
					aria-label={`${photo.album.name}: ${photo.caption}${photo.video ? ' (영상)' : ''}`}
					onClick={() => onOpen(index)}
				>
					<Thumb photo={photo} />
				</button>
			</li>
		))}
	</ul>
);

/** 모음의 묶음: 제목(›)과 가로로 넘기는 카드들 */
const Shelf = ({ title, children }: { title: string; children: React.ReactNode }) => (
	<section className="photos-shelf" aria-label={title}>
		<h3>
			{title} <i className="fa-solid fa-chevron-right" aria-hidden="true" />
		</h3>
		<div className="photos-shelf-row">{children}</div>
	</section>
);

/** 모음·검색의 카드: 사진 위에 제목 (큰 카드는 추억) */
const Card = ({
	label,
	note,
	cover,
	big,
	onOpen,
}: {
	label: string;
	note?: string;
	cover: React.ReactNode;
	big?: boolean;
	onOpen: () => void;
}) => (
	<button type="button" className={`photos-card ${big ? 'big' : ''}`} onClick={onOpen}>
		<span className="photos-card-cover" aria-hidden="true">
			{cover}
		</span>
		<span className="photos-card-text">
			<strong>{label}</strong>
			{note && <span>{note}</span>}
		</span>
	</button>
);

/** 손가락으로 옆으로 밀었다고 보는 거리 */
const SWIPE_PX = 50;

/**
 * 크게 보기 (iOS 사진): 위에 뒤로 가기·제목 알약·•••, 가운데 사진, 아래에 사진 띠와 막대(공유 · 좋아요·정보 · 프로젝트 페이지).
 * 사진을 옆으로 밀거나 띠의 사진을 눌러 넘기고, ←·→ 키로도 넘긴다
 */
const PhoneViewer = ({
	photos,
	index,
	liked,
	onToggleLike,
	onMove,
	onClose,
	onOpenProject,
}: {
	photos: Shown[];
	index: number;
	liked: boolean;
	onToggleLike: () => void;
	onMove: (index: number) => void;
	onClose: () => void;
	onOpenProject: (id: string) => void;
}) => {
	const photo = photos[index];
	const [info, setInfo] = useState(false);
	// 불러온 사진의 실제 크기와 파일 크기 (정보 판). 사진이 바뀌면 그 사진의 것으로
	const [measured, setMeasured] = useState<{ src: string; width: number; height: number; bytes: number | null } | null>(
		null
	);
	const measure = (width: number, height: number) => {
		const entry = performance.getEntriesByName(new URL(photo.src, location.href).href)[0] as
			PerformanceResourceTiming | undefined;
		const bytes = entry ? entry.encodedBodySize || entry.decodedBodySize || null : null;
		setMeasured({ src: photo.src, width, height, bytes });
	};
	const size = measured?.src === photo.src ? measured : null;
	const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
	const moreButton = useRef<HTMLButtonElement>(null);
	const strip = useRef<HTMLUListElement>(null);
	const swipe = useRef<{ x: number; y: number } | null>(null);
	const share = () => void shareLink({ app: 'safari', id: photo.album.id }, photo.album.name);

	const move = (delta: number) => onMove(Math.min(photos.length - 1, Math.max(0, index + delta)));

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'ArrowLeft') move(-1);
			else if (event.key === 'ArrowRight') move(1);
			else return;
			event.preventDefault();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	// 사진 띠: 지금 사진이 가운데 오게 넘긴다
	useEffect(() => {
		strip.current
			?.querySelector<HTMLElement>('[aria-current="true"]')
			?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
	}, [index]);

	return (
		<div
			className="photos-phone-viewer"
			role="dialog"
			aria-label={`사진 ${index + 1}/${photos.length}: ${photo.caption}`}
		>
			<MobileNavigation backLabel="돌아가기" onBack={onClose} />
			<div className="photos-phone-viewer-title">
				<strong>{photo.album.name}</strong>
				<span>{photo.caption}</span>
			</div>
			<button
				ref={moreButton}
				type="button"
				className="photos-phone-viewer-more"
				aria-label="사진 동작"
				aria-haspopup="menu"
				aria-expanded={menu !== null}
				onClick={(event) => {
					const rect = event.currentTarget.getBoundingClientRect();
					setMenu(menu ? null : { x: rect.right - 250, y: rect.bottom + 8 });
				}}
			>
				<i className="fa-solid fa-ellipsis" aria-hidden="true" />
			</button>

			<div
				className={`photos-phone-stage ${info ? 'with-info' : ''}`}
				onPointerDown={(event) => (swipe.current = { x: event.clientX, y: event.clientY })}
				onPointerUp={(event) => {
					const start = swipe.current;
					swipe.current = null;
					if (!start) return;
					const dx = event.clientX - start.x;
					if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(event.clientY - start.y)) move(dx < 0 ? 1 : -1);
				}}
				onPointerCancel={() => (swipe.current = null)}
			>
				{photo.video ? (
					<video
						key={photo.src}
						src={photo.src}
						controls
						autoPlay
						muted
						playsInline
						onLoadedMetadata={(event) => measure(event.currentTarget.videoWidth, event.currentTarget.videoHeight)}
					/>
				) : (
					<img
						key={photo.src}
						src={photo.src}
						alt={photo.caption}
						draggable={false}
						onLoad={(event) => measure(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)}
					/>
				)}
			</div>

			{/* 정보 (iOS 사진): 사진이 위로 줄고, 캡션 줄과 회색 판(기간·파일, 형식 카드, 프로젝트 페이지)이 아래에서 올라온다 */}
			{info && (
				<aside className="photos-phone-info" aria-label="사진 정보">
					<p className="photos-phone-caption">{photo.caption}</p>
					<div className="photos-phone-info-panel">
						<h3>{photo.album.period ?? photo.album.name}</h3>
						<p className="photos-phone-file">
							<i className="fa-regular fa-file-image" aria-hidden="true" /> {fileNameOf(photo.src)}
						</p>
						<section className="photos-phone-card" aria-label="파일">
							<header>
								<strong>{photo.album.name}</strong>
								<span className="photos-phone-format">{formatOf(photo.src)}</span>
							</header>
							<p>
								프로젝트 {photo.video ? '영상' : '화면'} — {index + 1}번째
							</p>
							<p>
								{size
									? [
											megapixels(size.width, size.height),
											`${size.width} × ${size.height}`,
											size.bytes ? formatBytes(size.bytes) : null,
										]
											.filter(Boolean)
											.join(' · ')
									: '불러오는 중…'}
							</p>
							<ul className="photos-phone-stats">
								<li>{photo.video ? '영상' : '사진'}</li>
								<li>
									{index + 1}/{photos.length}
								</li>
								<li>앨범 {photo.album.photos.length}장</li>
							</ul>
						</section>
						<button type="button" className="photos-phone-info-action" onClick={() => onOpenProject(photo.album.id)}>
							{photo.album.name} 페이지 열기…
						</button>
					</div>
				</aside>
			)}

			<ul ref={strip} className={`photos-phone-strip ${info ? 'hidden' : ''}`} aria-label="사진 띠">
				{photos.map((item, at) => (
					<li key={keyOf(item)}>
						<button
							type="button"
							aria-label={`${at + 1}번째 사진: ${item.caption}`}
							aria-current={at === index || undefined}
							onClick={() => onMove(at)}
						>
							<Thumb photo={item} />
						</button>
					</li>
				))}
			</ul>

			<div className="photos-phone-viewer-bar">
				<button type="button" className="photos-phone-round" aria-label="공유" onClick={share}>
					<i className="fa-solid fa-arrow-up-from-bracket" aria-hidden="true" />
				</button>
				<div className="photos-phone-pill">
					<button type="button" aria-label="좋아요" aria-pressed={liked} onClick={onToggleLike}>
						<i className={liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart'} aria-hidden="true" />
					</button>
					<button type="button" aria-label="정보" aria-pressed={info} onClick={() => setInfo(!info)}>
						<i className={info ? 'fa-solid fa-circle-info' : 'fa-solid fa-info'} aria-hidden="true" />
					</button>
				</div>
				<button
					type="button"
					className="photos-phone-round"
					aria-label={`${photo.album.name} 페이지`}
					onClick={() => onOpenProject(photo.album.id)}
				>
					<i className="fa-regular fa-compass" aria-hidden="true" />
				</button>
			</div>

			{menu && (
				<Menu
					label="사진 동작"
					className="touch"
					anchor={menu}
					trigger={moreButton}
					onClose={() => setMenu(null)}
					items={[
						{ label: '공유', icon: 'fa-solid fa-arrow-up-from-bracket', onSelect: share },
						{
							label: liked ? '좋아요 취소' : '좋아요',
							icon: liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart',
							onSelect: onToggleLike,
						},
						{ label: '정보', icon: 'fa-solid fa-circle-info', onSelect: () => setInfo(true) },
						'separator',
						{
							label: `${photo.album.name} 페이지 열기`,
							icon: 'fa-regular fa-compass',
							onSelect: () => onOpenProject(photo.album.id),
						},
					]}
				/>
			)}
		</div>
	);
};

/**
 * 사진 (휴대폰): iOS 사진처럼 아래의 떠 있는 탭(보관함·모음)과 검색 단추는 어느 화면에서나 같다.
 * 보관함은 꽉 찬 격자 위에 큰 제목(앨범별·전체는 오른쪽 위 •••), 모음은 추억·고정됨·앨범을 가로로 넘기는 카드.
 * 검색은 최근 항목 카드와 앨범 추천, 아래의 검색 칸. 사진을 누르면 크게 본다
 */
const PhotosMobile = ({ onOpenProject }: { onOpenProject: (id: string) => void }) => {
	const [tab, setTab] = useState<Tab>('library');
	const [grouped, setGrouped] = useState(false);
	const [opened, setOpened] = useState<Opened>(null);
	const [viewing, setViewing] = useState<Viewing>(null);
	const [searching, setSearching] = useState(false);
	const [query, setQuery] = useState('');
	const [recent, setRecent] = useState<Shown | null>(null);
	const [liked, setLiked] = useState<Set<string>>(() => new Set());
	const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
	const moreButton = useRef<HTMLButtonElement>(null);
	// 화면이 바뀐 방식: 앨범으로 들어가면 오른쪽에서, 나오면 왼쪽에서, 탭을 바꾸면 서서히 (처음에는 움직이지 않는다)
	const [motion, setMotion] = useState<'forward' | 'back' | 'fade' | null>(null);

	const album = opened?.kind === 'album' ? ALBUMS.find((entry) => entry.id === opened.id) : undefined;
	const photos: Shown[] = album
		? album.photos.map((photo) => ({ ...photo, album }))
		: opened?.kind === 'videos'
			? VIDEOS
			: ALL_PHOTOS;
	const title = album?.name ?? (opened?.kind === 'videos' ? '비디오' : '보관함');
	const showGrid = tab === 'library' || opened !== null;

	const view = (list: Shown[], index: number) => {
		setViewing({ photos: list, index });
		setRecent(list[index]);
	};
	const open = (next: Opened) => {
		setMotion(next ? 'forward' : 'back');
		setOpened(next);
		setViewing(null);
	};
	const switchTab = (next: Tab) => {
		setTab(next);
		setSearching(false);
		setOpened(null);
		setViewing(null);
		setMotion('fade');
	};

	if (viewing && viewing.photos[viewing.index]) {
		const current = viewing.photos[viewing.index];
		return (
			<div className="photos-phone">
				<PhoneViewer
					photos={viewing.photos}
					index={viewing.index}
					liked={liked.has(keyOf(current))}
					onToggleLike={() =>
						setLiked((set) => {
							const next = new Set(set);
							if (!next.delete(keyOf(current))) next.add(keyOf(current));
							return next;
						})
					}
					onMove={(index) => view(viewing.photos, index)}
					onClose={() => setViewing(null)}
					onOpenProject={onOpenProject}
				/>
			</div>
		);
	}

	const tabBar = (
		<nav className="photos-phone-bar" aria-label="사진 탭">
			<div className="photos-phone-tabs" role="tablist" aria-label="사진 탭">
				<button
					type="button"
					role="tab"
					aria-selected={!searching && tab === 'library'}
					onClick={() => switchTab('library')}
				>
					<i className="fa-regular fa-images" aria-hidden="true" />
					보관함
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={!searching && tab === 'collections'}
					onClick={() => switchTab('collections')}
				>
					<i className="fa-solid fa-layer-group" aria-hidden="true" />
					모음
				</button>
			</div>
			<button type="button" className="photos-phone-round" aria-label="검색" onClick={() => setSearching(true)}>
				<i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
			</button>
		</nav>
	);

	if (searching) {
		const results = searchPhotos(query);
		const firstPicture = ALL_PHOTOS.find((photo) => !photo.video);
		const recentCover = recent ?? firstPicture;
		return (
			<div className="photos-phone search">
				{/* 검색은 아래의 ×로 닫는다: 위에 뒤로 가기를 두지 않는다 */}
				<MobileNavigation hideHome />
				<div className="photos-phone-scroll">
					<header className="photos-phone-title">
						<h2>검색</h2>
					</header>
					{query.trim() ? (
						<>
							<p className="photos-phone-results">
								{results.length > 0 ? `${results.length}개의 결과` : '찾는 사진이 없습니다.'}
							</p>
							<Grid photos={results} onOpen={(index) => view(results, index)} />
						</>
					) : (
						<>
							<section className="photos-shelf" aria-label="최근 항목">
								<h3>최근 항목</h3>
								<div className="photos-shelf-row">
									{recentCover && (
										<Card
											label="최근 확인한 항목"
											cover={<Thumb photo={recentCover} />}
											onOpen={() => {
												const index = ALL_PHOTOS.findIndex((photo) => keyOf(photo) === keyOf(recentCover));
												view(ALL_PHOTOS, Math.max(0, index));
											}}
										/>
									)}
									<Card
										label="비디오"
										note={`${VIDEOS.length}개`}
										cover={<video src={`${VIDEOS[0]?.src}#t=0.1`} muted playsInline preload="metadata" />}
										onOpen={() => {
											setSearching(false);
											setTab('collections');
											open({ kind: 'videos' });
										}}
									/>
								</div>
							</section>
							<ul className="photos-phone-suggestions" aria-label="추천 검색어">
								{ALBUMS.map((entry) => (
									<li key={entry.id}>
										<button type="button" onClick={() => setQuery(entry.name)}>
											{entry.name}
										</button>
									</li>
								))}
							</ul>
						</>
					)}
				</div>
				<div className="photos-phone-bar">
					<label className="photos-phone-search">
						<i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
						<input
							type="search"
							placeholder="보관함 검색…"
							aria-label="보관함 검색"
							value={query}
							autoFocus
							onChange={(event) => setQuery(event.target.value)}
						/>
					</label>
					<button
						type="button"
						className="photos-phone-round"
						aria-label="검색 닫기"
						onClick={() => {
							setSearching(false);
							setQuery('');
						}}
					>
						<i className="fa-solid fa-xmark" aria-hidden="true" />
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="photos-phone">
			{/* 모음에서 들어간 앨범은 뒤로 가기가 '모음', 첫 화면은 홈 */}
			<MobileNavigation {...(opened ? { backLabel: '모음', onBack: () => open(null) } : {})} />
			{/* 보관함의 오른쪽 위: 앨범별·전체 (iOS 사진의 보기 메뉴) */}
			{tab === 'library' && !opened && (
				<button
					ref={moreButton}
					type="button"
					className="photos-phone-more"
					aria-label="보기 방식"
					aria-haspopup="menu"
					aria-expanded={menu !== null}
					onClick={(event) => {
						const rect = event.currentTarget.getBoundingClientRect();
						setMenu(menu ? null : { x: rect.right - 250, y: rect.bottom + 8 });
					}}
				>
					<i className="fa-solid fa-ellipsis" aria-hidden="true" />
				</button>
			)}
			<div
				key={opened ? (opened.kind === 'album' ? opened.id : 'videos') : tab}
				className="photos-phone-scroll"
				data-motion={motion ?? undefined}
			>
				{showGrid ? (
					<>
						<header className="photos-phone-title overlay">
							<h2>{title}</h2>
							<p>{countText(photos)}</p>
						</header>
						{tab === 'library' && !opened && grouped ? (
							ALBUMS.map((entry) => {
								const list = entry.photos.map((photo) => ({ ...photo, album: entry }));
								return (
									<section key={entry.id} className="photos-phone-group" aria-label={entry.name}>
										<h3>
											<button type="button" onClick={() => open({ kind: 'album', id: entry.id })}>
												{entry.name} <i className="fa-solid fa-chevron-right" aria-hidden="true" />
											</button>
										</h3>
										<Grid photos={list} onOpen={(index) => view(list, index)} />
									</section>
								);
							})
						) : (
							<Grid photos={photos} onOpen={(index) => view(photos, index)} />
						)}
					</>
				) : (
					<>
						<header className="photos-phone-title">
							<h2>모음</h2>
							<p>
								앨범 {ALBUMS.length}개 · {countText(ALL_PHOTOS)}
							</p>
						</header>
						<Shelf title="추억">
							{ALBUMS.map((entry) => (
								<Card
									key={entry.id}
									big
									label={entry.name}
									note={entry.period}
									cover={<img src={coverOf(entry)} alt="" loading="lazy" />}
									onOpen={() => open({ kind: 'album', id: entry.id })}
								/>
							))}
						</Shelf>
						<Shelf title="고정됨">
							<Card
								label="비디오"
								note={`${VIDEOS.length}개`}
								cover={<video src={`${VIDEOS[0]?.src}#t=0.1`} muted playsInline preload="metadata" />}
								onOpen={() => open({ kind: 'videos' })}
							/>
							<Card
								label="모든 사진"
								note={`${ALL_PHOTOS.length}개`}
								cover={
									<span className="photos-mosaic">
										{ALL_PHOTOS.filter((photo) => !photo.video)
											.slice(0, 9)
											.map((photo) => (
												<img key={photo.src} src={photo.src} alt="" loading="lazy" />
											))}
									</span>
								}
								onOpen={() => switchTab('library')}
							/>
						</Shelf>
						<Shelf title="앨범">
							{ALBUMS.map((entry) => (
								<Card
									key={entry.id}
									label={entry.name}
									note={`${entry.photos.length}개`}
									cover={<img src={coverOf(entry)} alt="" loading="lazy" />}
									onOpen={() => open({ kind: 'album', id: entry.id })}
								/>
							))}
						</Shelf>
					</>
				)}
			</div>

			{tabBar}

			{menu && (
				<Menu
					label="보기 방식"
					className="touch"
					anchor={menu}
					trigger={moreButton}
					onClose={() => setMenu(null)}
					items={[
						{ label: '앨범별', icon: 'fa-solid fa-layer-group', checked: grouped, onSelect: () => setGrouped(true) },
						{ label: '전체', icon: 'fa-regular fa-images', checked: !grouped, onSelect: () => setGrouped(false) },
					]}
				/>
			)}
		</div>
	);
};

export default PhotosMobile;
