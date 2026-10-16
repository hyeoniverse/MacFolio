// 사이트에 들어 있는 그림 폴더 (public/imgs). 프로젝트의 화면 모음을 폴더 하나로 정하면 그 안의 그림을 모두 쓴다
import PUBLIC_IMAGES from 'virtual:public-images';
import type { Project } from '@macfolio/desktop-core/site';

export { PUBLIC_IMAGES };

/** 프로젝트 그림을 두는 곳. 화면 모음 폴더는 이 아래에서만 고른다 (배경화면·앱 아이콘 같은 다른 그림 폴더는 빼고) */
export const PROJECT_IMAGES_ROOT = '/imgs/projects/';

/** 화면 모음으로 고를 수 있는 폴더: /imgs/projects 아래에서 그림이 있는 폴더 (이름 순) */
export const imageFolders = () =>
	Object.keys(PUBLIC_IMAGES)
		.filter((folder) => folder.startsWith(PROJECT_IMAGES_ROOT))
		.sort((a, b) => a.localeCompare(b));

/**
 * 화면 모음 폴더를 프로젝트(첫 단계 폴더)별로 묶는다. 묶음 이름은 프로젝트 이름(없으면 폴더 이름), 폴더 이름은 그 아래 경로
 * (프로젝트 폴더 자체는 '프로젝트 폴더')
 */
export function groupedImageFolders(nameOf: (folderName: string) => string | undefined = () => undefined) {
	const groups = new Map<string, { label: string; folders: { value: string; label: string }[] }>();
	for (const folder of imageFolders()) {
		const [head, ...rest] = folder.slice(PROJECT_IMAGES_ROOT.length).split('/');
		const group = groups.get(head) ?? { label: nameOf(head) ?? head, folders: [] };
		group.folders.push({ value: folder, label: rest.length ? rest.join('/') : '프로젝트 폴더' });
		groups.set(head, group);
	}
	return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
}

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
