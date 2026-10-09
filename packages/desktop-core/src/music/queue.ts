// 음악 재생 대기열: 셔플, 다음·이전 곡, 반복, 시간 표시. 곡 목록(파일 주소)과 Audio 제어는 앱 쪽에 있다

export interface Track {
	id: string;
	title: string;
	artist: string;
	album: string;
	artwork: string;
	src: string;
}

export interface Playlist {
	id: string;
	name: string;
	description: string;
	trackIds: string[];
}

/** 곡을 앨범이나 아티스트로 묶는다 (보관함의 앨범·아티스트). 재생 목록처럼 재생할 수 있다. 처음 나온 순서대로 */
export function groupTracks(tracks: Track[], by: 'album' | 'artist'): Playlist[] {
	const groups = new Map<string, Track[]>();
	for (const t of tracks) groups.set(t[by], [...(groups.get(t[by]) ?? []), t]);
	return [...groups].map(([name, members]) => ({
		id: `${by}:${name}`,
		name,
		description: by === 'album' ? [...new Set(members.map((t) => t.artist))].join(', ') : `${members.length}곡`,
		trackIds: members.map((t) => t.id),
	}));
}

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
