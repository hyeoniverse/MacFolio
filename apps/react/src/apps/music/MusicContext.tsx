import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from 'react';
import {
	createPlayerStore,
	currentTrackId,
	type Queue,
	type RepeatMode,
	type Track,
} from '@macfolio/desktop-core/music';
import { isMobileViewport } from '@/desktop/layout';
import { useAppState } from '@/desktop/AppStateContext';
import { ALL_SONGS, findPlaylist, findTrack, TRACKS } from './library';

interface MusicContextType {
	/** 지금 곡 */
	track: Track;
	/** 지금 재생 중인 재생 목록 */
	playlistId: string;
	queue: Queue;
	isPlaying: boolean;
	currentTime: number;
	duration: number;
	isBuffering: boolean;
	volume: number;
	shuffle: boolean;
	repeat: RepeatMode;
	/** 곡별 길이(초). 메타데이터를 불러온 곡만 있다 */
	durations: Record<string, number>;
	/** 재생 목록의 한 곡을 재생한다 (trackId를 비우면 목록의 첫 곡, 셔플이면 아무 곡) */
	playFrom: (playlistId: string, trackId?: string) => void;
	togglePlayPause: () => void;
	next: () => void;
	previous: () => void;
	seekTo: (time: number) => void;
	setVolume: (volume: number) => void;
	toggleShuffle: () => void;
	cycleRepeat: () => void;
	/** 반복 방식을 바로 고른다 (메뉴 막대의 '제어') */
	setRepeat: (mode: RepeatMode) => void;
	stopAndReset: () => void;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const useMusic = () => {
	const context = useContext(MusicContext);
	if (!context) throw new Error('useMusic must be used within MusicProvider');
	return context;
};

/** 곡 길이를 미리 알아 둔다 (목록에 시간을 보여주려고). 메타데이터만 받는다 */
function useTrackDurations() {
	const [durations, setDurations] = useState<Record<string, number>>({});
	useEffect(() => {
		const probes = TRACKS.map((t) => {
			const audio = new Audio();
			audio.preload = 'metadata';
			audio.onloadedmetadata = () => setDurations((prev) => ({ ...prev, [t.id]: audio.duration }));
			audio.src = t.src;
			return audio;
		});
		return () => probes.forEach((audio) => audio.removeAttribute('src'));
	}, []);
	return durations;
}

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const audioRef = useRef<HTMLAudioElement | null>(null);
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
	const durations = useTrackDurations();
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

	// 음악 앱을 끄면(창 닫기, 모바일 앱 전환기에서 밀어 올리기) 재생도 멈춘다.
	// 실행 중이다가 꺼질 때만 멈춘다: 데스크톱은 음악 창 없이 시작해도 로딩 뒤 자동 재생한다.
	const musicRunning = useAppState().apps.music.isRunning;
	const wasRunning = useRef(musicRunning);
	useEffect(() => {
		if (wasRunning.current && !musicRunning) stopAndReset();
		wasRunning.current = musicRunning;
	}, [musicRunning, stopAndReset]);

	// 로딩 화면을 넘기면(사용자가 클릭한 직후라 자동 재생이 된다) 데스크톱에서는 음악을 튼다
	useEffect(() => {
		const start = () => {
			if (!isMobileViewport({ width: window.innerWidth, height: window.innerHeight })) play();
		};
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
				duration,
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
			}}
		>
			{children}
			<audio
				ref={audioRef}
				preload="metadata"
				onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
				onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
				onWaiting={() => setIsBuffering(true)}
				onCanPlay={() => setIsBuffering(false)}
				onPlay={() => setIsPlaying(true)}
				onPause={() => setIsPlaying(false)}
				onEnded={onEnded}
			/>
		</MusicContext.Provider>
	);
};
