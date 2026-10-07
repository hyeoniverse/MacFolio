import { describe, expect, it } from 'vitest';
import type { Project } from '@/shared/profile';
import { ALBUMS, albumsOf, photosOf } from './albums';

const project = (fields: Partial<Project>): Project =>
	({
		id: 'demo',
		name: '데모',
		image: '/imgs/projects/demo/screenshot.jpg',
		highlights: [],
		build: [],
		...fields,
	}) as Project;

describe('사진 앨범', () => {
	it('첫 화면 → 화면 모음 → 기능·만든 방식·쓰는 법 → 장의 그림 순서, 같은 파일은 한 번', () => {
		const photos = photosOf(
			project({
				gallery: [
					{ src: '/imgs/projects/demo/screenshot.jpg', caption: '중복' },
					{ src: '/imgs/projects/demo/a.png', caption: '화면 A' },
				],
				highlights: [
					{
						title: '기능',
						body: '',
						image: '/imgs/projects/demo/b.jpg',
						imageDark: '/imgs/projects/demo/b-dark.jpg',
						shots: [{ src: '/imgs/projects/demo/tour.mp4', alt: '둘러보기' }],
					},
				],
				build: [{ title: '만든 방식', body: '', image: '/imgs/projects/demo/a.png' }],
				usage: [{ title: '쓰는 법', body: '', video: '/imgs/projects/demo/how.mp4' }],
				chapters: [{ title: '장', points: [], image: { src: '/imgs/projects/demo/c.webp', alt: '장 그림' } }],
			})
		);
		expect(photos.map(({ src, caption, video }) => [src.split('/').pop(), caption, video])).toEqual([
			['screenshot.jpg', '첫 화면', false],
			['a.png', '화면 A', false],
			['b.jpg', '기능', false],
			['b-dark.jpg', '기능 (다크 테마)', false],
			['tour.mp4', '둘러보기', true],
			['how.mp4', '쓰는 법', true],
			['c.webp', '장 그림', false],
		]);
	});

	it('소리·데이터 파일은 사진이 아니다', () => {
		const photos = photosOf(project({ gallery: [{ src: '/imgs/projects/demo/narration.mp3', caption: '소리' }] }));
		expect(photos.map((photo) => photo.src)).toEqual(['/imgs/projects/demo/screenshot.jpg']);
	});

	it('사진이 없는 프로젝트는 앨범이 없다. 실제 프로젝트는 모두 사진이 있다', () => {
		expect(albumsOf([project({ image: '' })])).toEqual([]);
		expect(ALBUMS.length).toBeGreaterThan(0);
		for (const album of ALBUMS) expect(album.photos.length).toBeGreaterThan(0);
	});
});
