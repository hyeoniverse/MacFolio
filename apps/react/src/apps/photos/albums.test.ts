import { describe, expect, it } from 'vitest';
import type { Project } from '@/shared/profile';
import {
	ALBUMS,
	ALL_PHOTOS,
	albumsOf,
	fileNameOf,
	formatBytes,
	formatOf,
	megapixels,
	oldestFirst,
	periodStart,
	photosOf,
} from './albums';

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

describe('사진 정보', () => {
	it('파일 이름과 형식', () => {
		expect(fileNameOf('/imgs/projects/qru/a/main.jpeg?v=2')).toBe('main.jpeg');
		expect(formatOf('/imgs/projects/qru/a/main.jpeg')).toBe('JPG');
		expect(formatOf('demo.mp4')).toBe('MP4');
		expect(formatOf('shot.png')).toBe('PNG');
	});

	it('파일 크기는 1000 단위', () => {
		expect(formatBytes(863_412)).toBe('863KB');
		expect(formatBytes(10_700_000)).toBe('10.7MB');
		expect(formatBytes(2_000_000)).toBe('2MB');
		expect(formatBytes(120)).toBe('1KB');
	});

	it('화소 수', () => {
		expect(megapixels(3024, 4032)).toBe('12.2MP');
		expect(megapixels(1280, 720)).toBe('0.9MP');
	});
});

describe('보관함 순서', () => {
	it('기간의 시작일', () => {
		expect(periodStart('2024.12.26 – 2025.02.05')).toBe(Date.UTC(2024, 11, 26));
		expect(periodStart('2026.02.05 – 운영 중')).toBe(Date.UTC(2026, 1, 5));
		expect(periodStart('2024.10 –')).toBe(Date.UTC(2024, 9, 1));
		expect(periodStart(undefined)).toBeNull();
	});

	it('오래된 앨범부터, 기간을 모르면 맨 앞', () => {
		const album = (id: string, period?: string) => ({ id, name: id, period, photos: [] });
		expect(
			oldestFirst([
				album('new', '2026.02.05 –'),
				album('old', '2024.06.10 –'),
				album('none'),
				album('mid', '2024.12.26 –'),
			]).map((entry) => entry.id)
		).toEqual(['none', 'old', 'mid', 'new']);
	});

	it('모든 사진의 마지막은 가장 최근 앨범의 사진', () => {
		const newest = [...ALBUMS].sort((a, b) => (periodStart(b.period) ?? 0) - (periodStart(a.period) ?? 0))[0];
		expect(ALL_PHOTOS.at(-1)!.album.id).toBe(newest.id);
	});
});
