// 음악 보관함: 곡과 재생 목록. 대기열 계산은 desktop-core(@macfolio/desktop-core/music)에 있다
import { groupTracks, type Playlist, type Track } from '@macfolio/desktop-core/music';
import { env } from '@/shared/config/env';

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

/**
 * 곡 길이 (초). 목록에 시간을 보여 주려고 처음에는 앱이 켜질 때 곡마다 메타데이터를 받아 쟀는데,
 * 그러면 첫 방문에 MP3 일곱 개의 앞부분(수백 KB)을 받는다. 곡을 바꾸면 파일에서 다시 잰다 (mutagen 등)
 */
export const TRACK_SECONDS: Record<string, number> = {
	t1: 349.13,
	t2: 294.58,
	t3: 311.3,
	t4: 232.36,
	t5: 209.66,
	t6: 209.68,
	t7: 148.06,
};

export const ALL_SONGS = 'all';

export const PLAYLISTS: Playlist[] = [
	{ id: ALL_SONGS, name: '모든 노래', description: '보관함의 모든 노래', trackIds: TRACKS.map((t) => t.id) },
	{ id: 'ghibli', name: '지브리', description: '미야자키 하야오 애니메이션의 음악', trackIds: ['t1', 't2', 't3'] },
	{ id: 'piano', name: '잔잔한 피아노', description: '작업할 때 듣는 피아노 곡', trackIds: ['t4', 't5', 't1', 't3'] },
	{ id: 'anime', name: '애니메이션 OST', description: '추억의 애니메이션 음악', trackIds: ['t6', 't7', 't2'] },
];

export const ALBUMS = groupTracks(TRACKS, 'album');
export const ARTISTS = groupTracks(TRACKS, 'artist');

export const findTrack = (id: string) => TRACKS.find((t) => t.id === id)!;
export const findPlaylist = (id: string) =>
	[...PLAYLISTS, ...ALBUMS, ...ARTISTS].find((p) => p.id === id) ?? PLAYLISTS[0];
