import React, { useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import MobileNavigation from '@/desktop/window/MobileNavigation';
import { findPlaylist, findTrack, formatTime, formatTotal, PLAYLISTS, type Playlist } from './library';
import { useMusic } from './MusicContext';
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
				<i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`} aria-hidden="true"></i>
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

/** 모바일: 화면을 덮는 '지금 재생 중'. 닫기는 제목 막대의 버튼 하나로 한다 */
const NowPlayingSheet: React.FC = () => {
	const { track, isPlaying } = useMusic();
	return (
		<div
			className="music-now-playing"
			role="dialog"
			aria-label="지금 재생 중"
			style={{ ['--artwork' as string]: `url('${track.artwork}')` }}
		>
			<img
				className={`music-now-art ${isPlaying ? 'playing' : ''}`}
				src={track.artwork}
				alt={`${track.album} 앨범 표지`}
			/>
			<div className="music-now-info">
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
const Music: React.FC = () => {
	const music = useMusic();
	const { track, isPlaying, playlistId: playingId, durations, playFrom, togglePlayPause, next } = music;
	const [selectedId, setSelectedId] = useState(playingId);
	/** 좁은 창에서 보이는 화면 */
	const [view, setView] = useState<'library' | 'playlist'>('library');
	const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
	const [upNextOpen, setUpNextOpen] = useState(false);
	const playlist = findPlaylist(selectedId);
	const tracks = playlist.trackIds.map(findTrack);
	const total = formatTotal(tracks.map((t) => durations[t.id]));

	const openPlaylist = (id: string) => {
		setSelectedId(id);
		setView('playlist');
	};

	return (
		<AppWindow title="음악" appName="music" chrome="unified">
			{/* 지금 재생 중 시트는 제목 막대 아래에 열리므로, 시트가 열려 있을 때는 막대를 띄우지 않는다 (닫기 단추) */}
			<MobileNavigation
				floating={!nowPlayingOpen}
				{...(nowPlayingOpen
					? { backLabel: '닫기', onBack: () => setNowPlayingOpen(false), title: '지금 재생 중' }
					: view === 'playlist'
						? { backLabel: '보관함', onBack: () => setView('library'), title: '' }
						: { title: '' })}
			/>
			<div className="music-shell">
				<div className={`music view-${view} ${upNextOpen ? 'up-next-open' : ''}`}>
					<nav className="music-sidebar" aria-label="보관함">
						<div className="music-sidebar-top" />
						<h2 className="music-large-title">보관함</h2>
						<p className="music-sidebar-heading">재생 목록</p>
						<ul>
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
										className="music-pill"
										onClick={() => {
											if (!music.shuffle) music.toggleShuffle();
											playFrom(playlist.id);
										}}
									>
										<i className="fa-solid fa-shuffle" aria-hidden="true"></i> 셔플
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

					{upNextOpen && <UpNext />}

					{/* 재생 막대 (넓은 창). 좁은 창에서는 미니 플레이어로 바뀐다 */}
					<footer className="music-player-bar" aria-label="재생 막대">
						<button
							type="button"
							className="music-now"
							aria-label="지금 재생 중 열기"
							onClick={() => setNowPlayingOpen(true)}
						>
							<img src={track.artwork} alt="" />
							<span>
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
								<i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`} aria-hidden="true"></i>
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
