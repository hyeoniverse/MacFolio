import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPlayerStore, currentTrackId } from '@macfolio/desktop-core/music';
import { useAppState } from '@/desktop/useAppState';
import { ALL_SONGS, findPlaylist, findTrack, TRACK_SECONDS } from './library';
import { MusicContext } from './useMusic';
import { musicAudio } from './musicAudio';

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	// 로딩 화면이 탭 처리 중에 미리 재생을 허용받아 둔 요소 (musicAudio.ts)
	const audioRef = useRef<HTMLAudioElement>(musicAudio());
	// 무엇을 어떤 순서로 재생할지(재생 목록, 대기열, 셔플, 반복)는 desktop-core의 플레이어 store가 정한다 (#16).
	// 여기서는 그 결과대로 audio를 틀고 멈추고, 재생 시간·음량을 다룬다
	const [player] = useState(() =>
		createPlayerStore({ trackIdsOf: (id) => findPlaylist(id).trackIds, playlistId: ALL_SONGS })
	);
	const playerState = useSyncExternalStore(player.subscribe, player.getState);
	const { playlistId, queue, shuffle, repeat } = playerState;
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [isBuffering, setIsBuffering] = useState(false);
	const [volume, setVolumeState] = useState(1);
	const durations = TRACK_SECONDS;
	const track = findTrack(currentTrackId(playerState));

	/** 곡이 바뀐 뒤 이어서 재생할지 (src를 바꾸면 audio가 멈추므로 기억해 둔다) */
	const playAfterLoad = useRef(false);

	const play = useCallback(() => {
		const audio = audioRef.current;
		if (!audio) return;
		// 자동 재생이 막히거나 파일을 못 불러오면 멈춘 상태로 둔다
		audio.play().catch(() => setIsPlaying(false));
		setIsPlaying(true);
	}, []);

	const pause = useCallback(() => {
		audioRef.current?.pause();
		setIsPlaying(false);
	}, []);

	/** 대기열에서 곡을 옮긴 뒤: 처음부터, autoplay면 이어서 재생 */
	const startTrack = useCallback((autoplay: boolean) => {
		playAfterLoad.current = autoplay;
		setCurrentTime(0);
		// 같은 곡이면 src가 바뀌지 않으므로 여기서 처음부터 다시 재생한다
		const audio = audioRef.current;
		if (audio) audio.currentTime = 0;
	}, []);

	// 곡이 바뀌면 audio의 src를 바꾸고, 재생 중이었으면 이어서 재생한다
	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;
		if (!audio.src.endsWith(track.src)) audio.src = track.src;
		if (playAfterLoad.current) {
			playAfterLoad.current = false;
			audio.play().catch(() => setIsPlaying(false));
			setIsPlaying(true);
		}
	}, [track.src, queue]);

	const next = useCallback(() => {
		if (player.next() === 'stopped') {
			pause();
			startTrack(false);
		} else startTrack(isPlaying);
	}, [player, isPlaying, startTrack, pause]);

	const previous = useCallback(() => {
		if (player.previous(audioRef.current?.currentTime ?? 0) === 'restart') {
			if (audioRef.current) audioRef.current.currentTime = 0;
			setCurrentTime(0);
		} else startTrack(true);
	}, [player, startTrack]);

	// 곡이 끝나면: 한 곡 반복이면 다시, 아니면 다음 곡
	const onEnded = useCallback(() => {
		const result = player.ended();
		if (result === 'repeat') {
			if (audioRef.current) audioRef.current.currentTime = 0;
			play();
		} else if (result === 'stopped') {
			setIsPlaying(false);
			startTrack(false);
		} else startTrack(true);
	}, [player, play, startTrack]);

	const playFrom = useCallback(
		(id: string, trackId?: string) => {
			player.playFrom(id, trackId);
			playAfterLoad.current = true;
			setCurrentTime(0);
			const start = findTrack(currentTrackId(player.getState()));
			if (audioRef.current && audioRef.current.src.endsWith(start.src)) audioRef.current.currentTime = 0;
		},
		[player]
	);

	/** 대기열의 곡으로 건너뛰어 처음부터 재생한다 ('다음 재생' 목록에서 누른 곡) */
	const jumpTo = useCallback(
		(trackId: string) => {
			if (player.jumpTo(trackId)) startTrack(true);
		},
		[player, startTrack]
	);
	const togglePlayPause = useCallback(() => (isPlaying ? pause() : play()), [isPlaying, pause, play]);

	const seekTo = useCallback((time: number) => {
		const audio = audioRef.current;
		if (!audio) return;
		audio.currentTime = time;
		setCurrentTime(time);
	}, []);

	const setVolume = useCallback((value: number) => {
		if (audioRef.current) audioRef.current.volume = value;
		setVolumeState(value);
	}, []);

	const stopAndReset = useCallback(() => {
		pause();
		if (audioRef.current) audioRef.current.currentTime = 0;
		setCurrentTime(0);
	}, [pause]);

	// 음악 앱은 창과 따로 실행된다: 실제로 소리가 나기 시작하면(audio의 playing) 창이 없어도 실행 중(Dock의 점).
	// 자동 재생이 막히거나 파일을 못 불러와 소리가 안 나면 켜지지 않는다.
	// 빨간 버튼으로 닫거나 종료하면(모바일 앱 전환기에서 밀어 올리기 포함) 실행 중이 꺼지고, 그때 재생도 멈춘다.
	// 최소화(노란 버튼)는 실행 중 그대로라 계속 재생한다
	const { keepAlive, isAppRunning } = useAppState();
	const musicRunning = isAppRunning('music');
	const wasRunning = useRef(musicRunning);
	useEffect(() => {
		if (wasRunning.current && !musicRunning) stopAndReset();
		wasRunning.current = musicRunning;
	}, [musicRunning, stopAndReset]);

	// audio 요소의 이벤트. 요소는 React 밖(musicAudio.ts)에 있으므로 직접 건다. 처리 함수는 늘 지금의 것을 부른다
	const handlers = useRef({ onEnded, onPlaying: () => keepAlive('music', true) });
	useEffect(() => {
		handlers.current = { onEnded, onPlaying: () => keepAlive('music', true) };
	});
	useEffect(() => {
		const audio = audioRef.current;
		const listeners: [keyof HTMLMediaElementEventMap, () => void][] = [
			['timeupdate', () => setCurrentTime(audio.currentTime)],
			['durationchange', () => setDuration(audio.duration || 0)],
			['waiting', () => setIsBuffering(true)],
			['canplay', () => setIsBuffering(false)],
			['play', () => setIsPlaying(true)],
			['playing', () => handlers.current.onPlaying()],
			['pause', () => setIsPlaying(false)],
			['ended', () => handlers.current.onEnded()],
		];
		for (const [type, listener] of listeners) audio.addEventListener(type, listener);
		return () => {
			for (const [type, listener] of listeners) audio.removeEventListener(type, listener);
		};
	}, []);

	// 로딩 화면을 넘기면 음악을 튼다. 휴대폰도 같다: 로딩 화면을 누른 시각에 이 요소가 재생을 허용받았다 (musicAudio.ts).
	// 그래도 막히면(스크립트를 받기 전에 첫 그림을 눌러 제스처가 지난 경우 등) play()가 거절되어 멈춘 상태로 남는다
	useEffect(() => {
		const start = () => play();
		window.addEventListener('startMusic', start);
		return () => window.removeEventListener('startMusic', start);
	}, [play]);

	return (
		<MusicContext.Provider
			value={{
				track,
				playlistId,
				queue,
				isPlaying,
				currentTime,
				duration: duration || TRACK_SECONDS[track.id] || 0,
				isBuffering,
				volume,
				shuffle,
				repeat,
				durations,
				playFrom,
				togglePlayPause,
				next,
				previous,
				seekTo,
				setVolume,
				toggleShuffle: player.toggleShuffle,
				cycleRepeat: player.cycleRepeat,
				setRepeat: player.setRepeat,
				stopAndReset,
				jumpTo,
				moveUpcoming: player.moveUpcoming,
			}}
		>
			{children}
		</MusicContext.Provider>
	);
};
