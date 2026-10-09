import { describe, expect, it } from 'vitest';
import { ALBUMS, findPlaylist, PLAYLISTS, TRACKS } from './library';

describe('보관함', () => {
	it('모든 재생 목록은 있는 곡만 담는다', () => {
		for (const playlist of PLAYLISTS) {
			for (const id of playlist.trackIds) expect(TRACKS.some((t) => t.id === id)).toBe(true);
		}
	});

	it('없는 재생 목록은 모든 노래로 대신한다', () => {
		expect(findPlaylist('없음').id).toBe('all');
	});

	it('앨범도 재생 목록처럼 찾는다', () => {
		expect(ALBUMS.length).toBeGreaterThan(0);
		expect(findPlaylist(`album:${TRACKS[0].album}`).name).toBe(TRACKS[0].album);
	});
});
