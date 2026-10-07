// 사진 앱의 앨범 (#21): 프로젝트마다 페이지에 쓴 화면을 모은다. 따로 목록을 두지 않고 프로젝트 정보(shared/profile.ts)에서 꺼낸다.
// React에 의존하지 않는 순수 함수만 둔다.
import { PROJECTS, type Project, type ProjectPoint } from '@/shared/profile';

export interface Photo {
	src: string;
	/** 사진 설명 (그 화면이 나온 자리의 제목·설명) */
	caption: string;
	/** .mp4는 영상 (크게 보기에서 재생한다) */
	video: boolean;
}

export interface Album {
	/** 프로젝트 id */
	id: string;
	name: string;
	/** 프로젝트 기간 (모음의 추억 카드에 쓴다) */
	period?: string;
	photos: Photo[];
}

const isVideo = (src: string) => /\.mp4$/i.test(src);
/** 사진으로 보여 줄 수 있는 파일 (소리·데이터 파일은 뺀다) */
const isPicture = (src: string) => /\.(jpe?g|png|webp|gif|svg|mp4)$/i.test(src);

/**
 * 한 프로젝트의 사진: 대표 화면 → 화면 모음 → 주요 기능·만든 방식·쓰는 법 → 장의 그림 순서.
 * 같은 파일은 한 번만. 다크 테마 그림은 라이트 바로 뒤에 둔다
 */
export function photosOf(project: Project): Photo[] {
	const photos: Photo[] = [];
	const seen = new Set<string>();
	const add = (src: string | undefined, caption: string) => {
		if (!src || seen.has(src) || !isPicture(src)) return;
		seen.add(src);
		photos.push({ src, caption, video: isVideo(src) });
	};
	const fromPoint = (point: ProjectPoint) => {
		add(point.video, point.title);
		add(point.image, point.title);
		add(point.imageDark, `${point.title} (다크 테마)`);
		for (const shot of point.shots ?? []) add(shot.src, shot.alt || point.title);
	};

	add(project.image, '첫 화면');
	for (const shot of project.gallery ?? []) add(shot.src, shot.caption);
	for (const point of [...project.highlights, ...project.build, ...(project.usage ?? [])]) fromPoint(point);
	for (const chapter of project.chapters ?? []) {
		for (const point of chapter.points) fromPoint(point);
		add(chapter.image?.src, chapter.image?.alt ?? chapter.title);
		add(chapter.image?.dark, `${chapter.image?.alt ?? chapter.title} (다크 테마)`);
	}
	return photos;
}

/** 사진이 있는 프로젝트마다 앨범 하나 (PROJECTS 순서) */
export function albumsOf(projects: readonly Project[]): Album[] {
	return projects
		.map((project) => ({ id: project.id, name: project.name, period: project.period, photos: photosOf(project) }))
		.filter((album) => album.photos.length > 0);
}

export const ALBUMS = albumsOf(PROJECTS);

/** 모든 사진 (앨범 순서대로, 어느 앨범의 사진인지 함께) */
export const ALL_PHOTOS: (Photo & { album: Album })[] = ALBUMS.flatMap((album) =>
	album.photos.map((photo) => ({ ...photo, album }))
);

/** 사진 수를 말로: "사진 65장, 영상 5개" */
export function countText(photos: readonly Photo[]): string {
	const videos = photos.filter((photo) => photo.video).length;
	const pictures = photos.length - videos;
	return [pictures && `사진 ${pictures}장`, videos && `영상 ${videos}개`].filter(Boolean).join(', ');
}

/** 파일 이름 (주소의 마지막 조각, 물음표 뒤는 뺀다) */
export const fileNameOf = (src: string) => src.split('?')[0].split('/').pop() ?? src;

/** 파일 형식 딱지: JPG, PNG, MP4 (jpeg는 JPG로) */
export const formatOf = (src: string) => {
	const ext = (fileNameOf(src).split('.').pop() ?? '').toUpperCase();
	return ext === 'JPEG' ? 'JPG' : ext;
};

/** 파일 크기: 863KB, 1.2MB (1000 단위, iOS 사진처럼) */
export function formatBytes(bytes: number): string {
	if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1).replace(/\.0$/, '')}MB`;
	return `${Math.max(1, Math.round(bytes / 1000))}KB`;
}

/** 화소 수: 12MP, 0.9MP (가로 × 세로 / 백만, 소수 한 자리) */
export const megapixels = (width: number, height: number) =>
	`${(Math.round((width * height) / 100_000) / 10).toString()}MP`;
