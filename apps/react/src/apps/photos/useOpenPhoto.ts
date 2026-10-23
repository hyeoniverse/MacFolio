import { useCallback, useEffect, useRef } from 'react';
import { useOpenRequest } from '@/shared/lib/openRequest';
import type { Album } from './albums';
import { locatePhoto, parsePhotoTarget, type PhotoTarget } from './photoTarget';

/**
 * 사진 하나를 크게 보기로 열어 달라는 요청(사진 위젯)을 받아, 보관함에서 그 사진을 찾으면 onOpen(앨범, 순번)을 부른다.
 * Finder › 그림의 폴더 앨범은 파일 목록을 받은 뒤에 생기므로, 아직 없으면 요청을 보관했다가 보관함이 바뀔 때 다시 찾는다.
 * enabled가 false면 요청을 받지 않는다 (사진 앱의 데스크톱 화면과 휴대폰 화면 중 보이는 쪽만 받는다)
 */
export function useOpenPhoto(albums: readonly Album[], onOpen: (album: Album, index: number) => void, enabled = true) {
	const pending = useRef<PhotoTarget | null>(null);
	const latest = useRef({ albums, onOpen });
	useEffect(() => {
		latest.current = { albums, onOpen };
	});

	const tryOpen = useCallback(() => {
		if (!pending.current) return;
		const found = locatePhoto(latest.current.albums, pending.current);
		if (!found) return;
		pending.current = null;
		latest.current.onOpen(found.album, found.index);
	}, []);

	useOpenRequest(
		'photos',
		(id) => {
			pending.current = parsePhotoTarget(id);
			tryOpen();
		},
		enabled
	);
	// 보관함이 바뀌면(폴더 앨범을 받으면) 보관해 둔 요청을 다시 찾는다
	useEffect(() => tryOpen(), [albums, tryOpen]);
}
