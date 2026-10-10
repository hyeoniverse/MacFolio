// 사이트에 들어 있는 그림 폴더 (public/imgs). 프로젝트의 화면 모음을 폴더 하나로 정하면 그 안의 그림을 모두 쓴다
import PUBLIC_IMAGES from 'virtual:public-images';
import type { Project } from '@macfolio/desktop-core/site';

export { PUBLIC_IMAGES };

/** 그림이 있는 폴더 (이름 순) */
export const imageFolders = () => Object.keys(PUBLIC_IMAGES).sort((a, b) => a.localeCompare(b));

/** 파일 이름으로 만든 설명: 앞의 번호와 확장자를 떼고 -·_는 띄어 쓴다 (예: 02-login_page.png → login page) */
export function captionOf(src: string) {
	const name = decodeURIComponent(src.split('/').pop() ?? '')
		.replace(/\.[^.]+$/, '')
		.replace(/^\d+[-_. ]*/, '')
		.replace(/[-_]+/g, ' ')
		.trim();
	return name || '화면';
}

/** 보이기 전에 채운다: 화면 모음 폴더의 그림으로 화면 모음을, 화면 캡처가 비었으면 화면 모음의 첫 그림을 */
export function completeProject(project: Project, folders: Record<string, string[]> = PUBLIC_IMAGES): Project {
	const withGallery = withFolderGallery(project, folders);
	if (withGallery.image) return withGallery;
	const first = withGallery.gallery?.find((shot) => !shot.src.endsWith('.mp4'))?.src;
	return first ? { ...withGallery, image: first } : withGallery;
}

/** 화면 모음 폴더가 있는 프로젝트는 그 폴더의 그림으로 화면 모음을 채운다 (폴더가 비었거나 없으면 그대로) */
export function withFolderGallery(project: Project, folders: Record<string, string[]> = PUBLIC_IMAGES): Project {
	const files = project.galleryFolder ? folders[project.galleryFolder.replace(/\/$/, '')] : undefined;
	if (!files?.length) return project;
	return { ...project, gallery: files.map((src) => ({ src, caption: captionOf(src) })) };
}
