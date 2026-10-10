import { describe, expect, it } from 'vitest';
import { blankProject } from '@macfolio/desktop-core/site';
import { captionOf, completeProject, imageFolders, PUBLIC_IMAGES, withFolderGallery } from './publicImages';

describe('사이트의 그림 폴더', () => {
	it('빌드할 때 public/imgs 아래 폴더마다 그림을 이름 순으로 모은다', () => {
		const screens = PUBLIC_IMAGES['/imgs/projects/qru/screens'];
		expect(screens.length).toBeGreaterThan(0);
		expect(screens).toEqual([...screens].sort((a, b) => a.localeCompare(b)));
		expect(screens.every((src) => src.startsWith('/imgs/projects/qru/screens/'))).toBe(true);
		expect(imageFolders()).toContain('/imgs/projects/qru/screens');
		// 고를 수 있는 폴더는 /imgs/projects 아래만 (배경화면 등은 빼고)
		expect(imageFolders().every((folder) => folder.startsWith('/imgs/projects/'))).toBe(true);
		expect(Object.keys(PUBLIC_IMAGES).some((folder) => !folder.startsWith('/imgs/projects/'))).toBe(true);
	});

	it('파일 이름으로 설명을 만든다 (앞 번호·확장자를 떼고 -·_는 띄어 쓴다)', () => {
		expect(captionOf('/imgs/a/02-login_page.png')).toBe('login page');
		expect(captionOf('/imgs/a/card-dark.jpg')).toBe('card dark');
		expect(captionOf('/imgs/a/01.png')).toBe('화면');
	});

	it('화면 모음 폴더가 있으면 그 폴더의 그림으로 화면 모음을 채우고, 없거나 빈 폴더면 그대로', () => {
		const folders = { '/imgs/x': ['/imgs/x/1-a.png', '/imgs/x/2-b.png'] };
		const project = { ...blankProject('p'), galleryFolder: '/imgs/x/' };
		expect(withFolderGallery(project, folders).gallery).toEqual([
			{ src: '/imgs/x/1-a.png', caption: 'a' },
			{ src: '/imgs/x/2-b.png', caption: 'b' },
		]);
		const plain = { ...blankProject('q'), gallery: [{ src: '/imgs/q.png', caption: 'q' }] };
		expect(withFolderGallery(plain, folders)).toBe(plain);
		expect(withFolderGallery({ ...plain, galleryFolder: '/imgs/none' }, folders)).toEqual({
			...plain,
			galleryFolder: '/imgs/none',
		});
	});
});

describe('화면 캡처가 비었을 때', () => {
	it('화면 모음의 첫 그림을 쓰고 (영상은 건너뛴다), 화면 모음도 없으면 빈 채로', () => {
		const folders = { '/imgs/x': ['/imgs/x/0-intro.mp4', '/imgs/x/1-a.png'] };
		expect(completeProject({ ...blankProject('p'), galleryFolder: '/imgs/x' }, folders).image).toBe('/imgs/x/1-a.png');
		expect(
			completeProject({ ...blankProject('p'), image: '/imgs/own.png', galleryFolder: '/imgs/x' }, folders).image
		).toBe('/imgs/own.png');
		expect(completeProject(blankProject('p'), folders).image).toBe('');
	});
});
