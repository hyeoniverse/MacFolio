import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';

const imgUrl = import.meta.env.VITE_APP_IMAGE_URL;
const mp3Url = import.meta.env.VITE_APP_MUSIC_URL;
// 음원 정보
const trackUrls = [
	`${mp3Url}/1.mp3`,
	`${mp3Url}/2.mp3`,
	`${mp3Url}/3.mp3`,
	`${mp3Url}/4.mp3`,
	`${mp3Url}/5.mp3`,
	`${mp3Url}/6.mp3`,
	`${mp3Url}/7.mp3`,
];
export const albums = [
	'Spirited Away',
	'Spirited Away',
	"Howl's Moving Castle",
	'Yiruma',
	'Yiruma',
	'Higurashi When They Cry',
	'Inuyasha',
];
export const trackNames = [
	'Inochi No Namae',
	'Itsumo Nando Demo',
	'Merry-Go-Round of Life',
	'Kiss the Rain',
	'River Flows in You',
	'You',
	'Affections Touching Across Time',
];
export const albumArtworks = [
	`${imgUrl}/Album_1.png`,
	`${imgUrl}/Album_2.png`,
	`${imgUrl}/Album_3.png`,
	`${imgUrl}/Album_4.png`,
	`${imgUrl}/Album_5.png`,
	`${imgUrl}/Album_6.png`,
	`${imgUrl}/Album_7.png`,
];

// 음악 상태와 제어 함수 타입 정의
interface MusicContextType {
	isPlaying: boolean;
	currentTrack: number;
	currentTime: number;
	duration: number;
	isBuffering: boolean;
	volume: number; // 볼륨 상태 추가
	isShuffle: boolean;
	togglePlayPause: () => void;
	playNextTrack: () => void;
	playPreviousTrack: () => void;
	seekTo: (time: number) => void;
	updatePlayerVisualState: (
		isActive: boolean,
		playerTrack: HTMLElement,
		albumArt: HTMLElement,
		titleBar: HTMLElement
	) => void;
	stopAndReset: () => void;
	setVolume: (volume: number) => void; // 볼륨 제어 함수 추가
	toggleShuffle: () => void;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const useMusic = () => {
	const context = useContext(MusicContext);
	if (!context) {
		throw new Error('useMusic must be used within MusicProvider');
	}
	return context;
};

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTrack, setCurrentTrack] = useState(0);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [isBuffering, setIsBuffering] = useState(false);
	const [volume, setVolume] = useState(1); // 초기 볼륨 1(100%)으로 설정
	// 셔플 상태 및 재생 기록 관리
	const [isShuffle, setIsShuffle] = useState(true);
	const [playedTracks, setPlayedTracks] = useState<number[]>([0]);

	// 상태 업데이트
	const togglePlayPause = useCallback(() => {
		if (audioRef.current) {
			if (isPlaying) {
				audioRef.current.pause();
			} else {
				audioRef.current.play();
			}
			setIsPlaying(!isPlaying);
		}
	}, [isPlaying]);

	const toggleShuffle = () => {
		setIsShuffle((prev) => !prev);
		setPlayedTracks([]); // 셔플을 변경할 때 재생 기록 초기화
	};

	const playNextTrack = useCallback(() => {
		if (isShuffle) {
			let availableTracks = trackUrls.map((_, index) => index).filter((index) => !playedTracks.includes(index));

			// 모든 트랙을 재생한 경우 playedTracks 초기화
			if (availableTracks.length === 0) {
				setPlayedTracks([]);
				availableTracks = trackUrls.map((_, index) => index);
			}

			// 랜덤하게 새로운 트랙 선택
			const nextTrack = availableTracks[Math.floor(Math.random() * availableTracks.length)];

			console.log('nextTrack', nextTrack);

			setPlayedTracks((prev) => [...prev, nextTrack]); // 재생된 트랙 목록 업데이트
			setCurrentTrack(nextTrack);
		} else {
			setCurrentTrack((prev) => (prev + 1) % trackUrls.length);
		}

		setCurrentTime(0);
		// 트랙 변경 후 자동 재생
		setTimeout(() => {
			if (audioRef.current) {
				audioRef.current.play();
			}
			setIsPlaying(true);
		}, 0);
	}, [isShuffle, playedTracks]);

	const playPreviousTrack = useCallback(() => {
		if (isShuffle) {
			if (playedTracks.length > 1) {
				// 마지막 트랙을 제외한 나머지를 유지 (현재 트랙을 되돌리는 효과)
				const updatedPlayedTracks = [...playedTracks];
				updatedPlayedTracks.pop(); // 현재 트랙을 제거
				const previousTrack = updatedPlayedTracks[updatedPlayedTracks.length - 1]; // 마지막 트랙을 가져옴

				setPlayedTracks(updatedPlayedTracks); // 되돌린 기록 업데이트
				setCurrentTrack(previousTrack); // 이전 트랙 재생
			} else {
				// 재생 기록이 없을 경우 현재 트랙을 다시 재생
				setCurrentTrack(currentTrack);
			}
		} else {
			setCurrentTrack((prev) => (prev - 1 + trackUrls.length) % trackUrls.length);
		}

		setCurrentTime(0);
		// 트랙 변경 후 자동 재생
		setTimeout(() => {
			if (audioRef.current) {
				audioRef.current.play();
			}
			setIsPlaying(true);
		}, 0);
	}, [isShuffle, playedTracks]);

	const seekTo = (time: number) => {
		if (audioRef.current) {
			audioRef.current.currentTime = time;
			setCurrentTime(time);
		}
	};

	// 시간 업데이트
	const handleTimeUpdate = () => {
		const audio = audioRef.current;
		if (audio && !isNaN(audio.duration)) {
			setCurrentTime(audio.currentTime);
			setDuration(audio.duration);
		}
	};

	useEffect(() => {
		const audio = audioRef.current;
		if (audio) {
			audio.src = trackUrls[currentTrack];
			audio.addEventListener('timeupdate', handleTimeUpdate);
			audio.addEventListener('canplay', () => setIsBuffering(false));
			audio.addEventListener('waiting', () => setIsBuffering(true));
			audio.addEventListener('ended', playNextTrack);

			return () => {
				audio.removeEventListener('timeupdate', handleTimeUpdate);
				audio.removeEventListener('canplay', () => setIsBuffering(false));
				audio.removeEventListener('waiting', () => setIsBuffering(true));
				audio.removeEventListener('ended', playNextTrack);
			};
		}
	}, [currentTrack, playNextTrack]);

	// 시각 상태 업데이트 함수
	const updatePlayerVisualState = useCallback(
		(isActive: boolean, playerTrack: HTMLElement, albumArt: HTMLElement, titleBar: HTMLElement) => {
			if (isActive) {
				playerTrack.classList.add('active');
				albumArt.classList.add('active');
				titleBar.style.top = '-35px';
			} else {
				playerTrack.classList.remove('active');
				albumArt.classList.remove('active');
				titleBar.style.top = '12px';
			}
		},
		[]
	);

	// 음악을 종료하고 상태 초기화
	const stopAndReset = useCallback(() => {
		if (audioRef.current) {
			audioRef.current.pause();
			audioRef.current.currentTime = 0;
		}
		setIsPlaying(false);
		setCurrentTime(0);
		setCurrentTrack(0);
	}, []);

	// 볼륨 변경 함수
	const handleVolumeChange = (newVolume: number) => {
		if (audioRef.current) {
			audioRef.current.volume = newVolume;
		}
		setVolume(newVolume);
	};

	return (
		<MusicContext.Provider
			value={{
				isPlaying,
				currentTrack,
				currentTime,
				duration,
				isBuffering,
				volume,
				isShuffle,
				togglePlayPause,
				playNextTrack,
				playPreviousTrack,
				seekTo,
				updatePlayerVisualState,
				stopAndReset,
				setVolume: handleVolumeChange,
				toggleShuffle,
			}}
		>
			{children}
			<audio ref={audioRef} />
		</MusicContext.Provider>
	);
};
