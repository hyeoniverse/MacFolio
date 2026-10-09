import { cssVars } from '@/shared/lib/cssVars';
import React, { useRef, useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import MobileNavigation from '@/desktop/window/MobileNavigation';
import Menu from '@/shared/ui/menu/Menu';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { formatTime, formatTotal, type Playlist } from '@macfolio/desktop-core/music';
import { ALBUMS, ALL_SONGS, ARTISTS, findPlaylist, findTrack, PLAYLISTS } from './library';
import { useMusic } from './MusicContext';
import { useAppMenus } from '@/desktop/status-bar/appMenus';
import SeekBar from './SeekBar';
import VolumeBar from './VolumeBar';
import '@/apps/music/Music.css';

const PLAYLIST_ICONS: Record<string, string> = {
	all: 'fa-solid fa-music',
	ghibli: 'fa-solid fa-wind',
	piano: 'fa-solid fa-feather',
	anime: 'fa-solid fa-star',
};

/** 재생 중 표시 막대 (곡 번호 자리) */
const PlayingBars: React.FC<{ paused: boolean }> = ({ paused }) => (
	<span className={`music-bars ${paused ? 'paused' : ''}`} aria-hidden="true">
		<span></span>
		<span></span>
		<span></span>
	</span>
);

/** 재생 목록 표지: 곡 표지 네 장을 모아 붙인다 */
const Cover: React.FC<{ playlist: Playlist; className?: string }> = ({ playlist, className = '' }) => {
	const arts = [...new Set(playlist.trackIds.map((id) => findTrack(id).artwork))].slice(0, 4);
	return (
		<div className={`music-cover ${arts.length >= 4 ? 'grid' : ''} ${className}`} aria-hidden="true">
			{(arts.length >= 4 ? arts : arts.slice(0, 1)).map((src) => (
				<img key={src} src={src} alt="" draggable={false} />
			))}
		</div>
	);
};

/** 재생·일시 정지·이전·다음, 셔플·반복 */
const Transport: React.FC<{ large?: boolean }> = ({ large = false }) => {
	const { isPlaying, shuffle, repeat, togglePlayPause, next, previous, toggleShuffle, cycleRepeat } = useMusic();
	const repeatLabel = { off: '반복 끔', all: '전체 반복', one: '한 곡 반복' }[repeat];
	return (
		<div className={`music-transport ${large ? 'large' : ''}`}>
			<button
				type="button"
				className={`music-toggle ${shuffle ? 'on' : ''}`}
				aria-label="셔플"
				aria-pressed={shuffle}
				onClick={toggleShuffle}
			>
				<i className="fa-solid fa-shuffle" aria-hidden="true"></i>
			</button>
			<button type="button" aria-label="이전 곡" onClick={previous}>
				<i className="fa-solid fa-backward" aria-hidden="true"></i>
			</button>
			<button
				type="button"
				className="music-play"
				aria-label={isPlaying ? '일시 정지' : '재생'}
				onClick={togglePlayPause}
			>
				<i
					key={isPlaying ? 'pause' : 'play'}
					className={`music-play-icon fa-solid fa-fw ${isPlaying ? 'fa-pause' : 'fa-play'}`}
					aria-hidden="true"
				></i>
			</button>
			<button type="button" aria-label="다음 곡" onClick={next}>
				<i className="fa-solid fa-forward" aria-hidden="true"></i>
			</button>
			<button
				type="button"
				className={`music-toggle ${repeat !== 'off' ? 'on' : ''}`}
				aria-label={repeatLabel}
				title={repeatLabel}
				onClick={cycleRepeat}
			>
				<i className="fa-solid fa-repeat" aria-hidden="true"></i>
				{repeat === 'one' && <span className="music-repeat-one">1</span>}
			</button>
		</div>
	);
};

/** 다음에 재생할 곡 */
const UpNext: React.FC = () => {
	const { queue, playlistId, playFrom } = useMusic();
	const upcoming = [...queue.order.slice(queue.position + 1), ...queue.order.slice(0, queue.position)];
	return (
		<section className="music-up-next" aria-label="다음 재생">
			<h3>다음 재생</h3>
			<p>{findPlaylist(playlistId).name}에서 재생 중</p>
			<ol>
				{upcoming.map((id) => {
					const t = findTrack(id);
					return (
						<li key={id}>
							<button type="button" onClick={() => playFrom(playlistId, id)}>
								<img src={t.artwork} alt="" />
								<span>
									<strong>{t.title}</strong>
									<small>{t.artist}</small>
								</span>
							</button>
						</li>
					);
				})}
			</ol>
		</section>
	);
};

/** 휴대폰 보관함의 목록 화면 (iOS 음악의 플레이리스트·아티스트·앨범) */
type PhoneList = 'playlists' | 'artists' | 'albums';

const PHONE_LISTS: { id: PhoneList | 'songs'; label: string; icon: string }[] = [
	{ id: 'playlists', label: '플레이리스트', icon: 'fa-solid fa-list-ul' },
	{ id: 'artists', label: '아티스트', icon: 'fa-solid fa-microphone-lines' },
	{ id: 'albums', label: '앨범', icon: 'fa-solid fa-record-vinyl' },
	{ id: 'songs', label: '노래', icon: 'fa-solid fa-music' },
];

const PHONE_LIST_TITLES: Record<PhoneList, string> = { playlists: '플레이리스트', artists: '아티스트', albums: '앨범' };

/** 플레이리스트 화면의 보기와 정렬 (iOS 음악의 정렬 메뉴) */
interface PlaylistArrangement {
	layout: 'grid' | 'list';
	sort: 'kind' | 'title';
}

/** 표지 한 장을 고른 줄 (목록·격자 모두). 누르면 그 목록으로 */
const CollectionItem: React.FC<{
	collection: Playlist;
	layout: 'grid' | 'list';
	round?: boolean;
	onOpen: () => void;
}> = ({ collection, layout, round = false, onOpen }) => (
	<li>
		<button type="button" className={`music-collection ${layout} ${round ? 'round' : ''}`} onClick={onOpen}>
			<Cover playlist={collection} className="small" />
			<span className="music-collection-text">
				<strong>{collection.name}</strong>
				<small>{collection.description}</small>
			</span>
			{layout === 'list' && <i className="fa-solid fa-chevron-right music-chevron" aria-hidden="true"></i>}
		</button>
	</li>
);

/** 모바일: 화면을 덮는 '지금 재생 중'. 닫기는 시트 위에 떠 있는 뒤로 가기로 한다 */
const NowPlayingSheet: React.FC = () => {
	const { track, isPlaying } = useMusic();
	return (
		<div
			className="music-now-playing"
			role="dialog"
			aria-label="지금 재생 중"
			style={cssVars({ artwork: `url('${track.artwork}')` })}
		>
			{/* 곡이 바뀌면 표지와 제목이 새로 나타난다 */}
			<img
				key={track.id}
				className={`music-now-art ${isPlaying ? 'playing' : ''}`}
				src={track.artwork}
				alt={`${track.album} 앨범 표지`}
			/>
			<div key={track.id} className="music-now-info music-track-swap">
				<strong>{track.title}</strong>
				<span>{track.artist}</span>
			</div>
			<SeekBar showTimes />
			<Transport large />
			<VolumeBar />
			<UpNext />
		</div>
	);
};

/**
 * 음악: 보관함·재생 목록·곡 목록과 재생 막대. macOS 음악 앱처럼 왼쪽에 재생 목록, 가운데에 곡 목록.
 * 좁은 창(모바일)에서는 보관함 → 재생 목록 순서로 한 화면씩 보이고, 아래 미니 플레이어를 누르면 '지금 재생 중'이 열린다.
 */
/** 반복 방식의 이름 (메뉴 막대의 '제어' 메뉴) */
const REPEAT_LABEL = { off: '반복 안 함', all: '전체 반복', one: '한 곡 반복' } as const;

const Music: React.FC = () => {
	const music = useMusic();
	const { track, isPlaying, playlistId: playingId, durations, playFrom, togglePlayPause, next } = music;

	// 메뉴 막대의 음악 '제어' 메뉴 (macOS 음악 앱처럼, #96)
	useAppMenus('music', [
		{
			title: '제어',
			items: [
				{ label: isPlaying ? '일시정지' : '재생', shortcut: { code: 'Space', alt: true }, onSelect: togglePlayPause },
				{ label: '다음 곡', shortcut: { code: 'ArrowRight', alt: true }, onSelect: next },
				{ label: '이전 곡', shortcut: { code: 'ArrowLeft', alt: true }, onSelect: music.previous },
				'separator',
				{ label: '셔플', checked: music.shuffle, onSelect: music.toggleShuffle },
				'separator',
				// macOS 음악의 반복 하위 메뉴처럼 하나를 고른다
				...(['off', 'all', 'one'] as const).map((mode) => ({
					label: REPEAT_LABEL[mode],
					checked: music.repeat === mode,
					onSelect: () => music.setRepeat(mode),
				})),
			],
		},
	]);
	const phone = useIsMobile();
	const [selectedId, setSelectedId] = useState(playingId);
	/** 좁은 창에서 보이는 화면. 휴대폰은 보관함과 곡 목록 사이에 플레이리스트·아티스트·앨범 목록이 있다 */
	const [view, setView] = useState<'library' | PhoneList | 'playlist'>('library');
	/** 곡 목록을 연 화면 (뒤로 가면 돌아갈 곳) */
	const [openedFrom, setOpenedFrom] = useState<'library' | PhoneList>('library');
	const [arrangement, setArrangement] = useState<PlaylistArrangement>({ layout: 'list', sort: 'kind' });
	const [sortMenu, setSortMenu] = useState<{ x: number; y: number } | null>(null);
	const sortButton = useRef<HTMLButtonElement>(null);
	const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
	const [upNextOpen, setUpNextOpen] = useState(false);
	const playlist = findPlaylist(selectedId);
	const tracks = playlist.trackIds.map(findTrack);
	const total = formatTotal(tracks.map((t) => durations[t.id]));
	const listView = view === 'playlists' || view === 'artists' || view === 'albums' ? view : null;

	const openPlaylist = (id: string) => {
		setSelectedId(id);
		setOpenedFrom(listView ?? 'library');
		setView('playlist');
	};

	// 플레이리스트 화면: 모든 노래는 보관함의 '노래'로 따로 연다
	const userPlaylists = PLAYLISTS.filter((item) => item.id !== ALL_SONGS);
	const sortedPlaylists =
		arrangement.sort === 'title'
			? [...userPlaylists].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
			: userPlaylists;
	/** 보관함 맨 위의 표지: 지금 재생 중인 목록 */
	const featured = findPlaylist(playingId);

	const phoneLibrary = (
		<>
			<button type="button" className="music-featured" onClick={() => openPlaylist(featured.id)}>
				<Cover playlist={featured} />
				<strong>{featured.name}</strong>
			</button>
			<ul className="music-phone-lists">
				{PHONE_LISTS.map((item) => (
					<li key={item.id}>
						<button
							type="button"
							className="music-phone-list-link"
							onClick={() => (item.id === 'songs' ? openPlaylist(ALL_SONGS) : setView(item.id))}
						>
							<i className={item.icon} aria-hidden="true"></i>
							<span>{item.label}</span>
							<i className="fa-solid fa-chevron-right music-chevron" aria-hidden="true"></i>
						</button>
					</li>
				))}
			</ul>
		</>
	);

	const phoneCollections = listView && (
		<>
			<h2 className="music-large-title phone-title">{PHONE_LIST_TITLES[listView]}</h2>
			{listView === 'playlists' ? (
				<ul className={`music-collections ${arrangement.layout}`}>
					{sortedPlaylists.map((item) => (
						<CollectionItem
							key={item.id}
							collection={item}
							layout={arrangement.layout}
							onOpen={() => openPlaylist(item.id)}
						/>
					))}
				</ul>
			) : (
				<ul className={`music-collections ${listView === 'albums' ? 'grid' : 'list'}`}>
					{(listView === 'albums' ? ALBUMS : ARTISTS).map((item) => (
						<CollectionItem
							key={item.id}
							collection={item}
							layout={listView === 'albums' ? 'grid' : 'list'}
							round={listView === 'artists'}
							onOpen={() => openPlaylist(item.id)}
						/>
					))}
				</ul>
			)}
		</>
	);

	return (
		<AppWindow title="음악" appName="music" chrome="unified">
			{/* 지금 재생 중 시트가 열려 있으면 떠 있는 뒤로 가기가 시트를 닫는다 */}
			<MobileNavigation
				{...(nowPlayingOpen
					? { backLabel: '닫기', onBack: () => setNowPlayingOpen(false) }
					: view === 'playlist'
						? {
								backLabel: openedFrom === 'library' ? '보관함' : PHONE_LIST_TITLES[openedFrom],
								onBack: () => setView(openedFrom),
							}
						: listView
							? { backLabel: '보관함', onBack: () => setView('library') }
							: {})}
			/>
			<div className="music-shell">
				<div
					className={`music view-${view === 'playlist' ? 'playlist' : 'library'} ${upNextOpen ? 'up-next-open' : ''}`}
				>
					<nav className="music-sidebar" aria-label={listView ? PHONE_LIST_TITLES[listView] : '보관함'}>
						<div className="music-sidebar-top" />
						{phone && listView ? (
							phoneCollections
						) : (
							<>
								<h2 className="music-large-title phone-title">보관함</h2>
								{phone && phoneLibrary}
							</>
						)}
						<p className="music-sidebar-heading">재생 목록</p>
						<ul className="music-playlists">
							{PLAYLISTS.map((item) => (
								<li key={item.id}>
									<button
										type="button"
										className={`music-playlist-link ${item.id === selectedId ? 'selected' : ''}`}
										aria-current={item.id === selectedId || undefined}
										onClick={() => openPlaylist(item.id)}
									>
										<Cover playlist={item} className="small" />
										<i className={PLAYLIST_ICONS[item.id]} aria-hidden="true"></i>
										<span>{item.name}</span>
										{item.id === playingId && isPlaying && <PlayingBars paused={false} />}
									</button>
								</li>
							))}
						</ul>
					</nav>

					<section key={selectedId} className="music-main" aria-label={playlist.name}>
						{/* 좁은 데스크톱 창의 뒤로 가기 (휴대폰은 떠 있는 뒤로 가기를 쓴다). 넓은 창에서는 보이지 않는다 */}
						<button type="button" className="music-back" onClick={() => setView(openedFrom)}>
							<i className="fa-solid fa-chevron-left" aria-hidden="true" />{' '}
							{openedFrom === 'library' ? '보관함' : PHONE_LIST_TITLES[openedFrom]}
						</button>
						<header className="music-header">
							<Cover playlist={playlist} />
							<div>
								<h1>{playlist.name}</h1>
								<p>{playlist.description}</p>
								<p className="music-meta">
									{tracks.length}곡{total && ` · ${total}`}
								</p>
								<div className="music-header-actions">
									<button type="button" className="music-pill primary" onClick={() => playFrom(playlist.id)}>
										<i className="fa-solid fa-play" aria-hidden="true"></i> 재생
									</button>
									<button
										type="button"
										className="music-pill music-pill-shuffle"
										aria-label="셔플"
										onClick={() => {
											if (!music.shuffle) music.toggleShuffle();
											playFrom(playlist.id);
										}}
									>
										<i className="fa-solid fa-shuffle" aria-hidden="true"></i>{' '}
										<span className="music-pill-label">셔플</span>
									</button>
								</div>
							</div>
						</header>

						<ol className="music-tracks" aria-label="곡 목록">
							{tracks.map((t, index) => {
								const current = t.id === track.id && playingId === playlist.id;
								return (
									<li key={t.id}>
										<button
											type="button"
											className={`music-track ${current ? 'current' : ''}`}
											aria-current={current || undefined}
											onClick={() => (current ? togglePlayPause() : playFrom(playlist.id, t.id))}
										>
											<span className="music-track-number">
												{current ? <PlayingBars paused={!isPlaying} /> : index + 1}
											</span>
											<img src={t.artwork} alt="" />
											<span className="music-track-title">
												<strong>{t.title}</strong>
												<small>{t.artist}</small>
											</span>
											<span className="music-track-album">{t.album}</span>
											<span className="music-track-time">{durations[t.id] ? formatTime(durations[t.id]) : ''}</span>
										</button>
									</li>
								);
							})}
						</ol>
					</section>

					{/* 플레이리스트 화면 오른쪽 위의 보기·정렬 (넘기는 칸 밖에 띄운다) */}
					{phone && view === 'playlists' && (
						<div className="music-phone-top">
							<button
								ref={sortButton}
								type="button"
								aria-label="정렬"
								aria-haspopup="menu"
								aria-expanded={sortMenu !== null}
								onClick={(event) => {
									const rect = event.currentTarget.getBoundingClientRect();
									setSortMenu(sortMenu ? null : { x: rect.right - 240, y: rect.bottom + 8 });
								}}
							>
								<i className="fa-solid fa-arrow-down-wide-short" aria-hidden="true"></i>
							</button>
						</div>
					)}
					{sortMenu && (
						<Menu
							label="정렬"
							className="touch"
							anchor={sortMenu}
							trigger={sortButton}
							onClose={() => setSortMenu(null)}
							items={[
								...(['grid', 'list'] as const).map((layout) => ({
									label: layout === 'grid' ? '격자' : '목록',
									checked: arrangement.layout === layout,
									onSelect: () => setArrangement((current) => ({ ...current, layout })),
								})),
								'separator',
								...(['title', 'kind'] as const).map((sort) => ({
									label: sort === 'title' ? '제목' : '플레이리스트 종류',
									checked: arrangement.sort === sort,
									onSelect: () => setArrangement((current) => ({ ...current, sort })),
								})),
							]}
						/>
					)}

					{upNextOpen && <UpNext />}

					{/* 재생 막대 (넓은 창). 좁은 창에서는 미니 플레이어로 바뀐다 */}
					<footer className="music-player-bar" aria-label="재생 막대">
						<button
							type="button"
							className="music-now"
							aria-label="지금 재생 중 열기"
							onClick={() => setNowPlayingOpen(true)}
						>
							<img key={track.id} className="music-track-swap" src={track.artwork} alt="" />
							<span key={track.id} className="music-track-swap">
								<strong>{track.title}</strong>
								<small>
									{track.artist} — {track.album}
								</small>
							</span>
						</button>
						<div className="music-bar-center">
							<Transport />
							<SeekBar showTimes />
						</div>
						<div className="music-bar-right">
							<VolumeBar />
							<button
								type="button"
								className={`music-toggle ${upNextOpen ? 'on' : ''}`}
								aria-label="다음 재생"
								aria-pressed={upNextOpen}
								onClick={() => setUpNextOpen((open) => !open)}
							>
								<i className="fa-solid fa-list-ul" aria-hidden="true"></i>
							</button>
						</div>
						{/* 미니 플레이어 버튼 (좁은 창) */}
						<div className="music-mini-controls">
							<button type="button" aria-label={isPlaying ? '일시 정지' : '재생'} onClick={togglePlayPause}>
								<i
									key={isPlaying ? 'pause' : 'play'}
									className={`music-play-icon fa-solid fa-fw ${isPlaying ? 'fa-pause' : 'fa-play'}`}
									aria-hidden="true"
								></i>
							</button>
							<button type="button" aria-label="다음 곡" onClick={next}>
								<i className="fa-solid fa-forward" aria-hidden="true"></i>
							</button>
						</div>
					</footer>

					{nowPlayingOpen && <NowPlayingSheet />}
				</div>
			</div>
		</AppWindow>
	);
};

export default Music;
