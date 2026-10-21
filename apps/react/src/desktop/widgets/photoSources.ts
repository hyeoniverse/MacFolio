// 사진 위젯이 보여 줄 수 있는 곳: 사진 앱의 앨범과, 관리자가 Finder › 그림에 올린 그림(그림 폴더와 그 안에 만든 폴더)
import type { FinderLayoutValue } from '@macfolio/contracts';
import type { Album } from '@/apps/photos/albums';
import { buildTree, find, type FinderItem } from '@/apps/finder/files';
import { fileUrl, type DocumentEntry } from '@/apps/finder/documents';

export interface PhotoSource {
	/** 위젯 설정(album)에 적는 값: 앨범 id, 그림 폴더(pictures), 만든 폴더 id(folder:…) */
	id: string;
	name: string;
	/** 앨범(사진 앱) 또는 그림 폴더(Finder) */
	group: 'album' | 'folder';
	photos: { src: string; caption: string }[];
}

/** 사진 앱의 앨범. 영상·SVG는 뺀다 */
export const albumSources = (albums: readonly Album[]): PhotoSource[] =>
	albums.map((album) => ({
		id: album.id,
		name: album.name,
		group: 'album',
		photos: album.photos
			.filter((photo) => !photo.video && !/\.svg$/i.test(photo.src))
			.map(({ src, caption }) => ({ src, caption })),
	}));

const stem = (name: string) => name.replace(/\.[^.]+$/, '');

/**
 * Finder › 그림의 폴더들: 그림 폴더 바로 안에 올린 그림(있을 때만)과, 그 안에 만든 폴더마다 (안쪽 폴더까지).
 * 앨범 폴더(pictures/<앨범>)는 사진 앱의 앨범과 같아서 뺀다. 폴더 안에 바로 든 그림만 보여 준다
 */
export function folderSources(files: DocumentEntry[], layout: FinderLayoutValue): PhotoSource[] {
	const { roots } = buildTree({ docs: [], posts: [], projects: [], apps: [], files, layout });
	const pictures = find(roots, 'pictures');
	if (pictures?.kind !== 'folder') return [];
	const photosIn = (items: FinderItem[]) =>
		items.flatMap((item) => (item.kind === 'image' ? [{ src: fileUrl(item.key), caption: stem(item.name) }] : []));
	const sources: PhotoSource[] = [];
	const own = photosIn(pictures.children);
	if (own.length) sources.push({ id: 'pictures', name: pictures.name, group: 'folder', photos: own });
	const walk = (items: FinderItem[], prefix: string) => {
		for (const item of items) {
			if (item.kind !== 'folder' || !item.id.startsWith('folder:')) continue;
			sources.push({ id: item.id, name: `${prefix}${item.name}`, group: 'folder', photos: photosIn(item.children) });
			walk(item.children, `${prefix}${item.name} › `);
		}
	};
	walk(pictures.children, '');
	return sources;
}

/** 고른 곳의 사진 (사진마다 그 곳의 이름과 함께). 고르지 않았거나 없어진 곳이면 모든 앨범 */
export function photosOf(sources: PhotoSource[], id: string | undefined) {
	const chosen = sources.find((source) => source.id === id);
	return (chosen ? [chosen] : sources.filter((source) => source.group === 'album')).flatMap((source) =>
		source.photos.map((photo) => ({ ...photo, album: source.name }))
	);
}
