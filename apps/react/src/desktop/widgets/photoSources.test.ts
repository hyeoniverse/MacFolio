import { describe, expect, it } from 'vitest';
import { EMPTY_FINDER_LAYOUT } from '@macfolio/contracts';
import type { DocumentEntry } from '@/apps/finder/documents';
import { albumSources, folderSources, photosOf } from './photoSources';

const albums = albumSources([
	{
		id: 'qru',
		name: 'QRU',
		photos: [
			{ src: '/imgs/q.png', caption: '홈', video: false },
			{ src: '/imgs/q.mp4', caption: '영상', video: true },
			{ src: '/imgs/q.svg', caption: '그림', video: false },
		],
	},
]);
const files: DocumentEntry[] = [
	{ id: 'a', folder: '그림', name: '바다.jpg', key: 'pictures/a.jpg', kind: 'image' },
	{ id: 'b', folder: '그림', name: '산.png', key: 'pictures/b.png', kind: 'image' },
	{ id: 'c', folder: '그림', name: '메모.pdf', key: 'pictures/c.pdf', kind: 'pdf' },
	{ id: 'd', folder: '데스크탑', name: '책상.jpg', key: 'desktop/d.jpg', kind: 'image' },
];
const layout = {
	...EMPTY_FINDER_LAYOUT,
	folders: [
		{ id: 'folder:widget01', name: '위젯', parent: 'pictures' },
		{ id: 'folder:inner001', name: '여름', parent: 'folder:widget01' },
		{ id: 'folder:desk0001', name: '책상', parent: 'desktop' },
	],
	files: { 'file:pictures/b.png': 'folder:widget01', 'file:desktop/d.jpg': 'folder:inner001' },
};

describe('사진 위젯이 보여 줄 곳', () => {
	it('앨범: 영상·SVG는 뺀다', () => {
		expect(albums[0].photos).toEqual([{ src: '/imgs/q.png', caption: '홈' }]);
	});

	it('그림 폴더: 바로 안의 그림, 그 안에 만든 폴더마다 (바탕화면의 폴더는 빼고)', () => {
		const sources = folderSources(files, layout);
		expect(sources.map(({ id, name }) => ({ id, name }))).toEqual([
			{ id: 'pictures', name: '그림' },
			{ id: 'folder:widget01', name: '위젯' },
			{ id: 'folder:inner001', name: '위젯 › 여름' },
		]);
		expect(sources[0].photos).toEqual([{ src: '/files/pictures/a.jpg', caption: '바다' }]);
		expect(sources[1].photos).toEqual([{ src: '/files/pictures/b.png', caption: '산' }]);
		// 다른 곳에서 옮겨 온 그림도 그 폴더의 것
		expect(sources[2].photos).toEqual([{ src: '/files/desktop/d.jpg', caption: '책상' }]);
	});

	it('그림 폴더에 바로 든 그림이 없으면 그림은 고를 곳이 아니다', () => {
		expect(folderSources([], EMPTY_FINDER_LAYOUT)).toEqual([]);
	});

	it('고른 곳의 사진, 없어진 곳이면 모든 앨범', () => {
		const sources = [...albums, ...folderSources(files, layout)];
		expect(photosOf(sources, 'folder:widget01')).toEqual([
			{ src: '/files/pictures/b.png', caption: '산', album: '위젯' },
		]);
		expect(photosOf(sources, 'folder:gone0000')).toEqual([{ src: '/imgs/q.png', caption: '홈', album: 'QRU' }]);
		expect(photosOf(sources, undefined)).toHaveLength(1);
	});
});
