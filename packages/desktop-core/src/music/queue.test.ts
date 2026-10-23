import { describe, expect, it } from 'vitest';
import {
	buildQueue,
	formatTime,
	formatTotal,
	groupTracks,
	moveUpcoming,
	nextPosition,
	nextRepeatMode,
	previousPosition,
	shuffled,
	upcoming,
} from './queue.js';

const ids = ['a', 'b', 'c', 'd'];

describe('groupTracks', () => {
	const track = (id: string, album: string, artist: string) => ({ id, title: id, album, artist, artwork: '', src: '' });

	it('앨범·아티스트는 곡을 처음 나온 순서대로 묶는다', () => {
		const tracks = [track('a', '봄', '가수1'), track('b', '여름', '가수2'), track('c', '봄', '가수2')];
		expect(groupTracks(tracks, 'album')).toEqual([
			{ id: 'album:봄', name: '봄', description: '가수1, 가수2', trackIds: ['a', 'c'] },
			{ id: 'album:여름', name: '여름', description: '가수2', trackIds: ['b'] },
		]);
		expect(groupTracks(tracks, 'artist').map((artist) => [artist.name, artist.description])).toEqual([
			['가수1', '1곡'],
			['가수2', '2곡'],
		]);
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

describe('다음 재생 목록', () => {
	it('지금 곡 다음부터, 끝에 닿으면 처음부터 지금 곡 앞까지', () => {
		expect(upcoming({ order: ids, position: 1 })).toEqual(['c', 'd', 'a']);
	});
	it('순서를 바꾸면 지금 곡을 맨 앞에 두고 바뀐 순서로 잇는다', () => {
		expect(moveUpcoming({ order: ids, position: 1 }, 2, 0)).toEqual({ order: ['b', 'a', 'c', 'd'], position: 0 });
		expect(moveUpcoming({ order: ids, position: 0 }, 0, 2)).toEqual({ order: ['a', 'c', 'd', 'b'], position: 0 });
	});
	it('자리가 같거나 범위를 벗어나면 그대로', () => {
		const queue = { order: ids, position: 1 };
		expect(moveUpcoming(queue, 1, 1)).toBe(queue);
		expect(moveUpcoming(queue, 0, 3)).toBe(queue);
	});
});
