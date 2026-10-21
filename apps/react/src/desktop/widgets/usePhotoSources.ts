import { useEffect, useMemo } from 'react';
import { ALBUMS } from '@/apps/photos/albums';
import { loadDocuments, useDocumentEntries } from '@/apps/finder/documents';
import { loadStructure, useStructure } from '@/apps/finder/structure';
import { albumSources, folderSources, type PhotoSource } from './photoSources';

const ALBUM_SOURCES = albumSources(ALBUMS);

/** 사진 위젯이 고를 수 있는 곳: 앨범, 그다음 Finder › 그림의 폴더 (올린 파일 목록과 Finder 구조를 받는다) */
export function usePhotoSources(): PhotoSource[] {
	const files = useDocumentEntries();
	const { layout } = useStructure();
	useEffect(() => {
		void loadDocuments();
		void loadStructure();
	}, []);
	return useMemo(() => [...ALBUM_SOURCES, ...folderSources(files, layout)], [files, layout]);
}
