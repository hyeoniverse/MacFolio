import { useEffect, useMemo } from 'react';
import { loadDocuments, useDocumentEntries } from '@/apps/finder/documents';
import { loadStructure, useStructure } from '@/apps/finder/structure';
import { folderSources } from '@/desktop/widgets/photoSources';
import { ALBUMS, oldestFirst, type Album, type Photo } from './albums';

export interface PhotoLibrary {
	/** 프로젝트 앨범, 그다음 Finder › 그림의 폴더 */
	albums: Album[];
	/** 보관함 순서 (오래된 것이 위) */
	albumsByAge: Album[];
	/** 모든 사진 (어느 앨범의 사진인지 함께) */
	allPhotos: (Photo & { album: Album })[];
}

/** Finder › 그림의 폴더 앨범 id: 프로젝트 앨범 id와 겹치지 않게 */
const folderAlbumId = (id: string) => `finder:${id}`;

/**
 * 사진 앱의 보관함: 프로젝트마다의 앨범(프로젝트 정보)과, 관리자가 Finder › 그림에 올린 그림·영상의 폴더마다 앨범 하나.
 * 사진 위젯과 같은 곳을 읽는다 (desktop/widgets/photoSources.ts)
 */
export function usePhotoLibrary(): PhotoLibrary {
	const files = useDocumentEntries();
	const { layout } = useStructure();
	useEffect(() => {
		void loadDocuments();
		void loadStructure();
	}, []);
	return useMemo(() => {
		const folders: Album[] = folderSources(files, layout)
			.filter((source) => source.photos.length > 0)
			.map((source) => ({
				id: folderAlbumId(source.id),
				name: source.name,
				photos: source.photos.map(({ src, caption, video }) => ({ src, caption, video: video === true })),
			}));
		const albums = [...ALBUMS, ...folders];
		const albumsByAge = oldestFirst(albums);
		return {
			albums,
			albumsByAge,
			allPhotos: albumsByAge.flatMap((album) => album.photos.map((photo) => ({ ...photo, album }))),
		};
	}, [files, layout]);
}
