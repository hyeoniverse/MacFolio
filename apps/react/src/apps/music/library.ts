// 음악 보관함과 재생 대기열. React와 DOM에 의존하지 않는 순수 코드만 둔다.
import { env } from '@/shared/config/env';

export interface Track {
	id: string;
	title: string;
	artist: string;
	album: string;
	artwork: string;
	src: string;
}

const track = (n: number, title: string, artist: string, album: string): Track => ({
	id: `t${n}`,
	title,
	artist,
	album,
	artwork: `${env.imageUrl}/Album_${n}.png`,
	src: `${env.musicUrl}/${n}.mp3`,
});

export const TRACKS: Track[] = [
	track(1, 'Inochi No Namae', 'Joe Hisaishi', 'Spirited Away'),
	track(2, 'Itsumo Nando Demo', 'Youmi Kimura', 'Spirited Away'),
	track(3, 'Merry-Go-Round of Life', 'Joe Hisaishi', "Howl's Moving Castle"),
	track(4, 'Kiss the Rain', 'Yiruma', 'Yiruma'),
	track(5, 'River Flows in You', 'Yiruma', 'Yiruma'),
	track(6, 'You', 'dai', 'Higurashi When They Cry'),
	track(7, 'Affections Touching Across Time', 'Kaoru Wada', 'Inuyasha'),
];

export interface Playlist {
	id: string;
	name: string;
	description: string;
	trackIds: string[];
}

export const ALL_SONGS = 'all';

export const PLAYLISTS: Playlist[] = [
	{ id: ALL_SONGS, name: '모든 노래', description: '보관함의 모든 노래', trackIds: TRACKS.map((t) => t.id) },
	{ id: 'ghibli', name: '지브리', description: '미야자키 하야오 애니메이션의 음악', trackIds: ['t1', 't2', 't3'] },
	{ id: 'piano', name: '잔잔한 피아노', description: '작업할 때 듣는 피아노 곡', trackIds: ['t4', 't5', 't1', 't3'] },
	{ id: 'anime', name: '애니메이션 OST', description: '추억의 애니메이션 음악', trackIds: ['t6', 't7', 't2'] },
];

export const findTrack = (id: string) => TRACKS.find((t) => t.id === id)!;
export const findPlaylist = (id: string) => PLAYLISTS.find((p) => p.id === id) ?? PLAYLISTS[0];

export type RepeatMode = 'off' | 'all' | 'one';

export const nextRepeatMode = (mode: RepeatMode): RepeatMode =>
	mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off';

/**
 * 재생 대기열. order는 재생할 곡 id 순서, position은 지금 곡의 위치.
 * 셔플이면 order를 섞되 지금 곡은 맨 앞에 둔다.
 */
export interface Queue {
	order: string[];
	position: number;
}

/** 배열을 섞는다 (Fisher–Yates). 테스트할 수 있게 난수 함수를 받는다 */
export function shuffled<T>(items: T[], random: () => number = Math.random): T[] {
	const result = [...items];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

/** 목록의 startId부터 재생하는 대기열을 만든다 */
export function buildQueue(trackIds: string[], startId: string, shuffle: boolean, random?: () => number): Queue {
	if (!shuffle) return { order: [...trackIds], position: Math.max(0, trackIds.indexOf(startId)) };
	const rest = shuffled(
		trackIds.filter((id) => id !== startId),
		random
	);
	return { order: [startId, ...rest], position: 0 };
}

/** 다음 곡 위치. 끝에서 반복이 꺼져 있으면 null (재생을 멈춘다) */
export function nextPosition(queue: Queue, repeat: RepeatMode): number | null {
	if (queue.position + 1 < queue.order.length) return queue.position + 1;
	return repeat === 'off' ? null : 0;
}

/** 이전 곡을 누르면 곡을 3초 넘게 들었을 때는 처음부터, 아니면 이전 곡으로 간다 */
export const RESTART_THRESHOLD = 3;

export function previousPosition(queue: Queue, currentTime: number, repeat: RepeatMode): number | 'restart' {
	if (currentTime > RESTART_THRESHOLD) return 'restart';
	if (queue.position > 0) return queue.position - 1;
	return repeat === 'all' ? queue.order.length - 1 : 'restart';
}

/** 초를 "3:07"로 */
export function formatTime(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
	const whole = Math.floor(seconds);
	return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** 곡들의 전체 길이를 "12분"처럼. 아직 모르는 곡이 있으면 null */
export function formatTotal(durations: (number | undefined)[]): string | null {
	if (durations.some((d) => d === undefined)) return null;
	const minutes = Math.round(durations.reduce<number>((sum, d) => sum + (d ?? 0), 0) / 60);
	return `${minutes}분`;
}
