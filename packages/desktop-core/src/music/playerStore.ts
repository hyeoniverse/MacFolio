// 무엇을 어떤 순서로 재생하는지: 재생 목록, 대기열, 셔플, 반복. 소리를 내는 일(Audio)과 재생 시간·음량은 앱이 맡고,
// 동작마다 돌려주는 값으로 앱이 Audio를 어떻게 할지 정한다
import { createStore } from '../store.js';
import { buildQueue, nextPosition, nextRepeatMode, previousPosition, type Queue, type RepeatMode } from './queue.js';

export interface PlayerState {
	/** 지금 재생 중인 재생 목록 */
	playlistId: string;
	queue: Queue;
	shuffle: boolean;
	repeat: RepeatMode;
}

/** 지금 곡 id */
export const currentTrackId = (state: PlayerState) => state.queue.order[state.queue.position];

export function createPlayerStore({
	trackIdsOf,
	playlistId,
	random = Math.random,
}: {
	/** 재생 목록 id → 곡 id 목록 */
	trackIdsOf: (playlistId: string) => string[];
	/** 처음 재생 목록 (첫 곡에서 시작) */
	playlistId: string;
	random?: () => number;
}) {
	const first = trackIdsOf(playlistId);
	const store = createStore<PlayerState>({
		playlistId,
		queue: buildQueue(first, first[0], false),
		shuffle: false,
		repeat: 'all',
	});
	/** 대기열의 그 위치로. 같은 위치여도 새 대기열을 만들어 앱이 곡을 처음부터 다시 틀게 한다 */
	const moveTo = (position: number) => store.setState((state) => ({ ...state, queue: { ...state.queue, position } }));

	return {
		getState: store.getState,
		subscribe: store.subscribe,
		/** 재생 목록의 한 곡부터 (trackId를 비우면 목록의 첫 곡, 셔플이면 아무 곡) */
		playFrom: (id: string, trackId?: string) => {
			const ids = trackIdsOf(id);
			const { shuffle } = store.getState();
			const start = trackId ?? (shuffle ? ids[Math.floor(random() * ids.length)] : ids[0]);
			store.setState({ playlistId: id, queue: buildQueue(ids, start, shuffle, random) });
		},
		/** 다음 곡. 목록 끝에서 반복이 꺼져 있으면 첫 곡으로 돌아가 'stopped' (재생을 멈춘다) */
		next: (): 'moved' | 'stopped' => {
			const position = nextPosition(store.getState().queue, store.getState().repeat);
			moveTo(position ?? 0);
			return position === null ? 'stopped' : 'moved';
		},
		/** 이전 곡. 3초 넘게 들었거나 더 갈 곳이 없으면 'restart' (지금 곡을 처음부터) */
		previous: (currentTime: number): 'moved' | 'restart' => {
			const { queue, repeat } = store.getState();
			const position = previousPosition(queue, currentTime, repeat);
			if (position === 'restart') return 'restart';
			moveTo(position);
			return 'moved';
		},
		/** 곡이 끝났다. 한 곡 반복이면 'repeat' (같은 곡을 다시), 아니면 다음 곡과 같다 */
		ended: (): 'repeat' | 'moved' | 'stopped' => {
			if (store.getState().repeat === 'one') return 'repeat';
			const position = nextPosition(store.getState().queue, store.getState().repeat);
			moveTo(position ?? 0);
			return position === null ? 'stopped' : 'moved';
		},
		/** 셔플을 켜고 끄면 지금 곡은 그대로 두고 나머지 순서만 바꾼다 */
		toggleShuffle: () =>
			store.setState((state) => {
				const shuffle = !state.shuffle;
				return {
					...state,
					shuffle,
					queue: buildQueue(trackIdsOf(state.playlistId), currentTrackId(state), shuffle, random),
				};
			}),
		cycleRepeat: () => store.setState((state) => ({ ...state, repeat: nextRepeatMode(state.repeat) })),
		setRepeat: (repeat: RepeatMode) => store.setState({ repeat }),
	};
}

export type PlayerStore = ReturnType<typeof createPlayerStore>;
