import { createContext, useContext } from 'react';
import type { Queue, RepeatMode, Track } from '@macfolio/desktop-core/music';

export interface MusicContextType {
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

export const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const useMusic = () => {
	const context = useContext(MusicContext);
	if (!context) throw new Error('useMusic must be used within MusicProvider');
	return context;
};
