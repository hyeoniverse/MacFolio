import { describe, expect, it } from 'vitest';
import type { Album } from './albums';
import { locatePhoto, parsePhotoTarget, photoTargetId } from './photoTarget';

const albums: Album[] = [
	{
		id: 'qru',
		name: 'QRU',
		photos: [
			{ src: '/imgs/q1.png', caption: '홈', video: false },
			{ src: '/imgs/q2.mp4', caption: '영상', video: true },
		],
	},
	{
		id: 'finder:folder:widget01',
		name: '위젯',
		photos: [{ src: '/files/pictures/sea.png', caption: '바다', video: false }],
	},
];

describe('사진 위젯이 사진 앱에 여는 사진', () => {
	it('요청 id로 직렬화했다가 그대로 되돌린다 (앨범 id의 쌍점, 주소의 물음표·따옴표도)', () => {
		const target = { album: 'finder:folder:widget01', src: '/files/a "b".png?v=1' };
		expect(parsePhotoTarget(photoTargetId(target))).toEqual(target);
	});

	it('형식이 다른 id는 null', () => {
		expect(parsePhotoTarget('qru')).toBeNull();
		expect(parsePhotoTarget('["qru"]')).toBeNull();
		expect(parsePhotoTarget('["qru", 1]')).toBeNull();
		expect(parsePhotoTarget('{"album":"qru","src":"/a.png"}')).toBeNull();
	});

	it('보관함에서 그 앨범과 앨범 안의 순번을 찾는다 (좌우로 넘기면 같은 앨범의 사진)', () => {
		expect(locatePhoto(albums, { album: 'qru', src: '/imgs/q2.mp4' })).toEqual({ album: albums[0], index: 1 });
		expect(locatePhoto(albums, { album: 'finder:folder:widget01', src: '/files/pictures/sea.png' })).toEqual({
			album: albums[1],
			index: 0,
		});
	});

	it('앨범이나 사진이 (아직) 없으면 null: 같은 파일이어도 다른 앨범이면 찾지 않는다', () => {
		expect(locatePhoto(albums, { album: 'gone', src: '/imgs/q1.png' })).toBeNull();
		expect(locatePhoto(albums, { album: 'qru', src: '/files/pictures/sea.png' })).toBeNull();
	});
});
