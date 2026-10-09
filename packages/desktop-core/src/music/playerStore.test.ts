import { describe, expect, it } from 'vitest';
import { createPlayerStore, currentTrackId } from './playerStore.js';

const playlists: Record<string, string[]> = { all: ['a', 'b', 'c'], two: ['x', 'y'] };
const setup = () => createPlayerStore({ trackIdsOf: (id) => playlists[id], playlistId: 'all', random: () => 0 });
const current = (player: ReturnType<typeof setup>) => currentTrackId(player.getState());

describe('createPlayerStore', () => {
	it('처음 재생 목록의 첫 곡에서, 모두 반복으로 시작한다', () => {
		const player = setup();
		expect(current(player)).toBe('a');
		expect(player.getState()).toMatchObject({ playlistId: 'all', shuffle: false, repeat: 'all' });
	});

	it('재생 목록의 한 곡부터 재생한다', () => {
		const player = setup();
		player.playFrom('two', 'y');
		expect(player.getState().playlistId).toBe('two');
		expect(current(player)).toBe('y');
		player.playFrom('all');
		expect(current(player)).toBe('a');
	});

	it('다음 곡: 끝에서 모두 반복이면 처음으로, 반복이 꺼져 있으면 첫 곡에서 멈춘다', () => {
		const player = setup();
		player.playFrom('all', 'c');
		expect(player.next()).toBe('moved');
		expect(current(player)).toBe('a');
		player.playFrom('all', 'c');
		player.setRepeat('off');
		expect(player.next()).toBe('stopped');
		expect(current(player)).toBe('a');
	});

	it('같은 위치로 가도 새 대기열을 만든다 (앱이 곡을 처음부터 다시 틀도록)', () => {
		const player = createPlayerStore({ trackIdsOf: () => ['solo'], playlistId: 'all' });
		const before = player.getState().queue;
		player.next();
		expect(player.getState().queue).not.toBe(before);
		expect(player.getState().queue.position).toBe(0);
	});

	it('이전 곡: 3초 넘게 들었으면 처음부터', () => {
		const player = setup();
		player.playFrom('all', 'b');
		expect(player.previous(10)).toBe('restart');
		expect(current(player)).toBe('b');
		expect(player.previous(1)).toBe('moved');
		expect(current(player)).toBe('a');
	});

	it('곡이 끝나면: 한 곡 반복은 그대로, 아니면 다음 곡', () => {
		const player = setup();
		player.setRepeat('one');
		expect(player.ended()).toBe('repeat');
		expect(current(player)).toBe('a');
		player.cycleRepeat();
		expect(player.getState().repeat).toBe('off');
		expect(player.ended()).toBe('moved');
		expect(current(player)).toBe('b');
	});

	it('셔플을 켜도 지금 곡은 그대로 맨 앞에 둔다', () => {
		const player = setup();
		player.playFrom('all', 'b');
		player.toggleShuffle();
		expect(player.getState().shuffle).toBe(true);
		expect(current(player)).toBe('b');
		expect([...player.getState().queue.order].sort()).toEqual(['a', 'b', 'c']);
	});
});
