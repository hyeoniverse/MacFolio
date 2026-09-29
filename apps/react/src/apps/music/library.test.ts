import { describe, expect, it } from 'vitest';
import {
	buildQueue,
	findPlaylist,
	formatTime,
	formatTotal,
	nextPosition,
	nextRepeatMode,
	PLAYLISTS,
	previousPosition,
	shuffled,
	TRACKS,
} from './library';

const ids = ['a', 'b', 'c', 'd'];

describe('보관함', () => {
	it('모든 재생 목록은 있는 곡만 담는다', () => {
		for (const playlist of PLAYLISTS) {
			for (const id of playlist.trackIds) expect(TRACKS.some((t) => t.id === id)).toBe(true);
		}
	});

	it('없는 재생 목록은 모든 노래로 대신한다', () => {
		expect(findPlaylist('없음').id).toBe('all');
	});
});

describe('buildQueue', () => {
	it('셔플이 아니면 목록 순서 그대로, 고른 곡 위치에서 시작한다', () => {
		expect(buildQueue(ids, 'c', false)).toEqual({ order: ids, position: 2 });
	});

	it('셔플이면 고른 곡을 맨 앞에 두고 나머지를 섞는다', () => {
		const queue = buildQueue(ids, 'c', true, () => 0);
		expect(queue.position).toBe(0);
		expect(queue.order[0]).toBe('c');
		expect([...queue.order].sort()).toEqual(ids);
	});
});

describe('shuffled', () => {
	it('원래 배열을 바꾸지 않고 같은 원소를 돌려준다', () => {
		const copy = [...ids];
		expect([...shuffled(ids)].sort()).toEqual(ids);
		expect(ids).toEqual(copy);
	});
});

describe('nextPosition', () => {
	it('다음 곡으로 간다', () => {
		expect(nextPosition({ order: ids, position: 1 }, 'off')).toBe(2);
	});

	it('끝에서 반복이 꺼져 있으면 멈추고, 전체 반복이면 처음으로 간다', () => {
		expect(nextPosition({ order: ids, position: 3 }, 'off')).toBeNull();
		expect(nextPosition({ order: ids, position: 3 }, 'all')).toBe(0);
	});
});

describe('previousPosition', () => {
	it('3초 넘게 들었으면 처음부터 다시', () => {
		expect(previousPosition({ order: ids, position: 2 }, 10, 'off')).toBe('restart');
	});

	it('곡 초반이면 이전 곡으로', () => {
		expect(previousPosition({ order: ids, position: 2 }, 1, 'off')).toBe(1);
	});

	it('첫 곡에서는 전체 반복일 때만 마지막 곡으로 간다', () => {
		expect(previousPosition({ order: ids, position: 0 }, 1, 'all')).toBe(3);
		expect(previousPosition({ order: ids, position: 0 }, 1, 'off')).toBe('restart');
	});
});

describe('반복 모드', () => {
	it('끔 → 전체 → 한 곡 → 끔 순서로 바뀐다', () => {
		expect(nextRepeatMode('off')).toBe('all');
		expect(nextRepeatMode('all')).toBe('one');
		expect(nextRepeatMode('one')).toBe('off');
	});
});

describe('시간 표시', () => {
	it('초를 분:초로', () => {
		expect(formatTime(187.9)).toBe('3:07');
		expect(formatTime(NaN)).toBe('0:00');
	});

	it('전체 길이는 모든 곡의 길이를 알 때만', () => {
		expect(formatTotal([120, 185])).toBe('5분');
		expect(formatTotal([120, undefined])).toBeNull();
	});
});
