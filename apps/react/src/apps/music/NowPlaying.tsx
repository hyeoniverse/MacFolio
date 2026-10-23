import React, { useLayoutEffect, useRef, useState } from 'react';
import { upcoming } from '@macfolio/desktop-core/music';
import Sheet from '@/shared/ui/sheet/Sheet';
import Menu, { type MenuItem } from '@/shared/ui/menu/Menu';
import IconButton from '@/shared/ui/button/IconButton';
import { reorderKeyDelta, startPointerReorder } from '@/shared/ui/reorder/pointerReorder';
import { cssVars } from '@/shared/lib/cssVars';
import { prefersReducedMotion } from '@/shared/lib/media';
import { ALBUMS, ALL_SONGS, ARTISTS, findPlaylist, findTrack } from './library';
import { useMusic } from './useMusic';
import { useSwipeToClose } from './useSwipeToClose';
import SeekBar from './SeekBar';
import VolumeBar from './VolumeBar';
import '@/apps/music/NowPlaying.css';

/** 지금 재생 중에서 곡이 속한 목록으로 갈 때, 돌아갈 보관함 화면 */
export type CollectionOrigin = 'library' | 'playlists' | 'albums' | 'artists';

interface Props {
	onClose: () => void;
	/** ••• 메뉴의 '…(으)로 이동': 시트를 닫고 그 목록(재생 목록·앨범·아티스트)을 연다 */
	onGoTo: (collectionId: string, from: CollectionOrigin) => void;
}

/** 쓸어내리기를 시작하고 이만큼(px) 내려오는 동안 모서리가 기기 화면 곡률까지 둥글어진다 */
const CORNER_RAMP = 40;

const REPEAT_LABEL = { off: '반복 끔', all: '전체 반복', one: '한 곡 반복' } as const;

/**
 * 휴대폰의 '지금 재생 중' (iOS 18 음악 앱의 구성).
 * 큰 표지 화면과, 대기열 버튼으로 바꾸는 대기열 화면이 있다. 대기열 화면에서는 표지가 제목 옆 썸네일로 줄어들고
 * 셔플·반복 버튼과 '다음 재생' 목록이 나타난다. 진행 막대·재생 버튼·음량은 두 화면에 그대로 있다.
 * 닫기는 맨 위 손잡이(누르기)와 손잡이·표지·제목을 아래로 쓸어내리기, Esc. 셸의 떠 있는 뒤로 가기는 감춘다(hideBack)
 */
const NowPlaying: React.FC<Props> = ({ onClose, onGoTo }) => {
	const music = useMusic();
	const { track, isPlaying, queue, playlistId, shuffle, repeat } = music;
	const [queueOpen, setQueueOpen] = useState(false);
	const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
	const moreButton = useRef<HTMLButtonElement>(null);
	const art = useRef<HTMLImageElement>(null);
	/** 화면을 바꾸기 직전의 표지 자리 (표지가 새 자리로 옮겨 가는 움직임의 출발점) */
	const artFrom = useRef<DOMRect | null>(null);
	// 손잡이와 표지·제목 머리를 아래로 쓸어내리면 닫힌다 (iOS 시트). 거리·속도 기준은 swipe.ts
	const swipe = useSwipeToClose(onClose);
	const dragging = swipe.offset !== null;

	const toggleQueue = () => {
		artFrom.current = art.current?.getBoundingClientRect() ?? null;
		setQueueOpen((open) => !open);
	};

	// 표지가 큰 자리와 썸네일 자리를 오갈 때, 옛 자리에서 새 자리로 옮겨 가며 크기가 바뀐다 (FLIP)
	useLayoutEffect(() => {
		const from = artFrom.current;
		const element = art.current;
		artFrom.current = null;
		if (!from || !element || prefersReducedMotion() || typeof element.animate !== 'function') return;
		const to = element.getBoundingClientRect();
		if (!to.width) return;
		const scale = from.width / to.width;
		element.animate(
			[
				{
					transformOrigin: 'top left',
					transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${scale})`,
				},
				{ transformOrigin: 'top left', transform: 'none' },
			],
			{ duration: 420, easing: 'cubic-bezier(0.2, 0.9, 0.25, 1)' }
		);
	}, [queueOpen]);

	const playing = findPlaylist(playlistId);
	const album = ALBUMS.find((item) => item.trackIds.includes(track.id));
	const artist = ARTISTS.find((item) => item.trackIds.includes(track.id));
	// 앨범·아티스트에서 재생했으면 '플레이리스트로 이동'은 앨범·아티스트로 이동과 같으므로 뺀다
	const fromPlaylist = !playlistId.startsWith('album:') && !playlistId.startsWith('artist:');
	const menuItems: MenuItem[] = [
		...(fromPlaylist
			? [
					{
						label: '플레이리스트로 이동',
						detail: playing.name,
						icon: 'fa-solid fa-list-ul',
						onSelect: () => onGoTo(playing.id, playing.id === ALL_SONGS ? 'library' : 'playlists'),
					},
				]
			: []),
		...(album
			? [
					{
						label: '앨범으로 이동',
						detail: album.name,
						icon: 'fa-solid fa-record-vinyl',
						onSelect: () => onGoTo(album.id, 'albums'),
					},
				]
			: []),
		...(artist
			? [
					{
						label: '아티스트로 이동',
						detail: artist.name,
						icon: 'fa-solid fa-microphone-lines',
						onSelect: () => onGoTo(artist.id, 'artists'),
					},
				]
			: []),
	];

	const next = upcoming(queue);

	return (
		<Sheet
			variant="cover"
			label="지금 재생 중"
			className={`music-now-playing ${queueOpen ? 'queue-open' : ''} ${dragging ? 'dragging' : ''}`}
			style={{
				...cssVars({ artwork: `url('${track.artwork}')` }),
				// 끌려 내려가는 동안 네 모서리가 기기 화면의 곡률(--phone-screen-radius)로 둥글어진다 (처음 40px 동안 보간).
				// 놓아서 제자리로 돌아오면 전환(transition)으로 각진 모서리로 돌아간다
				...(swipe.offset
					? {
							transform: `translateY(${swipe.offset}px)`,
							borderRadius: `calc(var(--phone-screen-radius, 0px) * ${Math.min(1, swipe.offset / CORNER_RAMP)})`,
						}
					: {}),
			}}
			onClose={onClose}
		>
			{/* 보이는 것은 손잡이 막대. 누르거나(키보드·스크린 리더 포함) 아래로 쓸어내리면 닫힌다 */}
			<button
				type="button"
				className="music-now-grabber"
				aria-label="지금 재생 중 닫기"
				onClick={() => {
					// 끌다가 놓은 것은 쓸어내리기가 처리한다
					if (!swipe.dragged.current) onClose();
				}}
				{...swipe.handlers}
			>
				<span aria-hidden="true" />
			</button>

			<div className="music-now-top">
				<div className="music-now-art-box" {...swipe.handlers}>
					<img
						ref={art}
						key={`art-${track.id}`}
						className={`music-now-art ${isPlaying ? 'playing' : ''}`}
						src={track.artwork}
						alt={`${track.album} 앨범 표지`}
						// 그림 끌어 옮기기가 쓸어내리기를 가져가지 않게
						draggable={false}
					/>
				</div>
				{/* 곡이 바뀌면 제목이 새로 나타난다. 형제끼리 key가 같으면 옛 요소가 남으므로 자리 이름을 붙인다 */}
				<div key={`info-${track.id}`} className="music-now-info music-track-swap" {...swipe.handlers}>
					<strong>{track.title}</strong>
					<span>{track.artist}</span>
				</div>
				<IconButton
					ref={moreButton}
					variant="circle"
					className="music-now-more"
					label="더 보기"
					icon="fa-solid fa-ellipsis"
					aria-haspopup="menu"
					aria-expanded={menu !== null}
					onClick={(event) => {
						const rect = event.currentTarget.getBoundingClientRect();
						setMenu(menu ? null : { x: rect.right - 270, y: rect.bottom + 8 });
					}}
				/>
				{queueOpen && (
					<>
						<div className="music-now-modes">
							<IconButton
								className="music-now-mode"
								on={shuffle}
								label="셔플"
								aria-pressed={shuffle}
								icon="fa-solid fa-shuffle"
								onClick={music.toggleShuffle}
							/>
							<IconButton
								className="music-now-mode"
								on={repeat !== 'off'}
								label={REPEAT_LABEL[repeat]}
								onClick={music.cycleRepeat}
							>
								<i className="fa-solid fa-repeat" aria-hidden="true"></i>
								{repeat === 'one' && <span className="music-repeat-one">1</span>}
							</IconButton>
						</div>
						<section className="music-queue" aria-label="다음 재생">
							<h3>다음 재생</h3>
							<p>{playing.name}에서 재생 중</p>
							<ol>
								{next.map((id, index) => {
									const item = findTrack(id);
									return (
										<li key={id}>
											<button type="button" className="music-queue-track" onClick={() => music.jumpTo(id)}>
												<img src={item.artwork} alt="" />
												<span>
													<strong>{item.title}</strong>
													<small>{item.artist}</small>
												</span>
											</button>
											<button
												type="button"
												className="music-queue-handle"
												aria-label={`${item.title} 순서 바꾸기`}
												title="끌거나 ↑·↓ 키로 순서를 바꿉니다"
												disabled={next.length < 2}
												onPointerDown={(event) => {
													if (event.button !== 0) return;
													startPointerReorder(event, (from, to) => music.moveUpcoming(from, to));
												}}
												onKeyDown={(event) => {
													const delta = reorderKeyDelta(event.key);
													if (!delta) return;
													event.preventDefault();
													music.moveUpcoming(index, index + delta);
												}}
											>
												<i className="fa-solid fa-bars" aria-hidden="true" />
											</button>
										</li>
									);
								})}
							</ol>
						</section>
					</>
				)}
			</div>

			<SeekBar showTimes className="music-now-seek" />
			<div className="music-now-transport">
				<IconButton label="이전 곡" icon="fa-solid fa-backward" onClick={music.previous} />
				<IconButton className="music-now-play" label={isPlaying ? '일시 정지' : '재생'} onClick={music.togglePlayPause}>
					<i
						key={isPlaying ? 'pause' : 'play'}
						className={`music-play-icon fa-solid fa-fw ${isPlaying ? 'fa-pause' : 'fa-play'}`}
						aria-hidden="true"
					></i>
				</IconButton>
				<IconButton label="다음 곡" icon="fa-solid fa-forward" onClick={music.next} />
			</div>
			<VolumeBar />
			{/* iOS의 가사·AirPlay 자리는 이 앱에 없는 기능이라 비워 두고, 대기열은 같은 자리(오른쪽)에 둔다 */}
			<div className="music-now-bottom">
				<IconButton
					variant="circle"
					className="music-now-queue-toggle"
					on={queueOpen}
					label="대기열"
					aria-pressed={queueOpen}
					icon="fa-solid fa-list-ul"
					onClick={toggleQueue}
				/>
			</div>

			{menu && (
				<Menu
					label="더 보기"
					variant="ios"
					className="music-now-menu"
					anchor={menu}
					trigger={moreButton}
					autoFocus={false}
					onClose={() => setMenu(null)}
					items={menuItems}
				/>
			)}
		</Sheet>
	);
};

export default NowPlaying;
