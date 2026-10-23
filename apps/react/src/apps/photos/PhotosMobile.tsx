import { useLayoutEffect, useRef, useState } from 'react';
import MobileNavigation from '@/desktop/window/MobileNavigation';
import Menu from '@/shared/ui/menu/Menu';
import { countText } from './albums';
import { usePhotoLibrary } from './usePhotoLibrary';
import { useOpenPhoto } from './useOpenPhoto';
import { Thumb, type Shown } from './PhotoParts';
import { useCaptions } from './captionsApi';
import { Card, Grid, Shelf } from './PhotoGrid';
import { type Opened, type Tab, type Viewing, coverOf, keyOf, searchPhotos } from './photosMobile.model';
import { PhoneViewer } from './PhoneViewer';
import '@/apps/photos/Photos.css';
import '@/apps/photos/PhotosMobile.css';
import SearchField from '@/shared/ui/search-field/SearchField';
import IconButton from '@/shared/ui/button/IconButton';

/**
 * 사진 (휴대폰): iOS 사진처럼 아래의 떠 있는 탭(보관함·모음)과 검색 버튼은 어느 화면에서나 같다.
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
	const captions = useCaptions();
	// 프로젝트 앨범과 Finder › 그림의 폴더
	const { albums, albumsByAge, allPhotos } = usePhotoLibrary();
	const videos = allPhotos.filter((photo) => photo.video);
	// 화면이 바뀐 방식: 앨범으로 들어가면 오른쪽에서, 나오면 왼쪽에서, 탭을 바꾸면 서서히 (처음에는 움직이지 않는다)
	const [motion, setMotion] = useState<'forward' | 'back' | 'fade' | null>(null);

	const album = opened?.kind === 'album' ? albums.find((entry) => entry.id === opened.id) : undefined;
	const photos: Shown[] = album
		? album.photos.map((photo) => ({ ...photo, album }))
		: opened?.kind === 'videos'
			? videos
			: allPhotos;
	const title = album?.name ?? (opened?.kind === 'videos' ? '비디오' : '보관함');
	const showGrid = tab === 'library' || opened !== null;

	// 격자는 맨 아래(최신)부터 보인다. 사진을 크게 봤다가 돌아오면 보던 자리로
	const scrollBox = useRef<HTMLDivElement>(null);
	const savedScroll = useRef(new Map<string, number>());
	const scrollKey = `${opened ? (opened.kind === 'album' ? opened.id : 'videos') : tab}:${grouped}`;
	// 사진이 제목 밑으로 들어갔는지: 그때만 제목 뒤를 어둡게 하고 글자를 흰색으로 (PhotosMobile.css).
	// 보는 곳(scrollKey)마다 따로 센다: 다른 앨범으로 가면 그 칸의 스크롤 위치를 다시 읽을 때까지 맨 위로 본다
	const [scrolledAt, setScrolledAt] = useState<string | null>(null);
	const scrolled = scrolledAt === scrollKey;
	useLayoutEffect(() => {
		const box = scrollBox.current;
		if (!box || viewing || searching) return;
		const saved = savedScroll.current.get(scrollKey);
		box.scrollTop = saved ?? (showGrid ? box.scrollHeight : 0);
	}, [scrollKey, viewing, searching, showGrid]);

	const view = (list: Shown[], index: number) => {
		if (scrollBox.current) savedScroll.current.set(scrollKey, scrollBox.current.scrollTop);
		setViewing({ photos: list, index });
		setRecent(list[index]);
	};
	const open = (next: Opened) => {
		savedScroll.current.clear();
		setMotion(next ? 'forward' : 'back');
		setOpened(next);
		setViewing(null);
	};
	// 사진 위젯을 누르면 보관함 › 그 앨범의 격자 위에 그 사진을 크게 본다 (닫으면 그 앨범, 좌우로 넘기면 같은 앨범의 사진)
	useOpenPhoto(albums, (target, index) => {
		savedScroll.current.clear();
		setTab('library');
		setSearching(false);
		setOpened({ kind: 'album', id: target.id });
		setMotion(null);
		const list = target.photos.map((photo) => ({ ...photo, album: target }));
		setViewing({ photos: list, index });
		setRecent(list[index]);
	});
	const switchTab = (next: Tab) => {
		savedScroll.current.clear();
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
			<IconButton
				variant="circle"
				className="photos-phone-round"
				label="검색"
				icon="fa-solid fa-magnifying-glass"
				onClick={() => setSearching(true)}
			/>
		</nav>
	);

	if (searching) {
		const results = searchPhotos(allPhotos, query, captions);
		const firstPicture = allPhotos.find((photo) => !photo.video);
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
												const index = allPhotos.findIndex((photo) => keyOf(photo) === keyOf(recentCover));
												view(allPhotos, Math.max(0, index));
											}}
										/>
									)}
									<Card
										label="비디오"
										note={`${videos.length}개`}
										cover={<video src={`${videos[0]?.src}#t=0.1`} muted playsInline preload="metadata" />}
										onOpen={() => {
											setSearching(false);
											setTab('collections');
											open({ kind: 'videos' });
										}}
									/>
								</div>
							</section>
							<ul className="photos-phone-suggestions" aria-label="추천 검색어">
								{albums.map((entry) => (
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
					<SearchField
						className="photos-phone-search"
						label="보관함 검색"
						placeholder="보관함 검색…"
						value={query}
						autoFocus
						onChange={(event) => setQuery(event.target.value)}
					/>
					<IconButton
						variant="circle"
						className="photos-phone-round"
						label="검색 닫기"
						icon="fa-solid fa-xmark"
						onClick={() => {
							setSearching(false);
							setQuery('');
						}}
					/>
				</div>
			</div>
		);
	}

	return (
		<div className="photos-phone">
			{/* 모음에서 들어간 앨범은 뒤로 가기가 '모음', 첫 화면은 홈 */}
			{/* 보관함·앨범은 어두운 제목을 직접 그려(data-scrolled) 스크롤 가장자리 효과를 끈다 */}
			<MobileNavigation scrollEdge={!showGrid} {...(opened ? { backLabel: '모음', onBack: () => open(null) } : {})} />
			{/* 보관함의 오른쪽 위: 앨범별·전체 (iOS 사진의 보기 메뉴) */}
			{tab === 'library' && !opened && (
				<IconButton
					ref={moreButton}
					className="photos-phone-more"
					label="보기 방식"
					icon="fa-solid fa-ellipsis"
					aria-haspopup="menu"
					aria-expanded={menu !== null}
					onClick={(event) => {
						const rect = event.currentTarget.getBoundingClientRect();
						setMenu(menu ? null : { x: rect.right - 250, y: rect.bottom + 8 });
					}}
				/>
			)}
			<div
				ref={scrollBox}
				key={opened ? (opened.kind === 'album' ? opened.id : 'videos') : tab}
				className="photos-phone-scroll"
				data-motion={motion ?? undefined}
				data-scrolled={scrolled || undefined}
				onScroll={(event) => setScrolledAt(event.currentTarget.scrollTop > 0 ? scrollKey : null)}
			>
				{showGrid ? (
					<>
						<header className="photos-phone-title overlay">
							<h2>{title}</h2>
							<p>{countText(photos)}</p>
						</header>
						{tab === 'library' && !opened && grouped ? (
							albumsByAge.map((entry) => {
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
								앨범 {albums.length}개 · {countText(allPhotos)}
							</p>
						</header>
						<Shelf title="추억">
							{albums.map((entry) => (
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
								note={`${videos.length}개`}
								cover={<video src={`${videos[0]?.src}#t=0.1`} muted playsInline preload="metadata" />}
								onOpen={() => open({ kind: 'videos' })}
							/>
							<Card
								label="모든 사진"
								note={`${allPhotos.length}개`}
								cover={
									<span className="photos-mosaic">
										{allPhotos
											.filter((photo) => !photo.video)
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
							{albums.map((entry) => (
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
					variant="ios"
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
