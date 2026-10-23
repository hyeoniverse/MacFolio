// 사진 앱에 사진 하나를 크게 보기로 열어 달라는 요청의 값 (사진 위젯을 누르면 지금 보이는 사진을 연다).
// 요청은 openRequest의 문자열 id로 전달하므로, 앨범 id와 파일 주소를 JSON 배열 하나로 직렬화한다.
// React에 의존하지 않는 순수 함수만 둔다.
import type { Album } from './albums';

/** 연 사진: 사진 앱의 앨범 id(프로젝트 id, 또는 finder:<폴더 id>)와 그 앨범 안의 파일 주소 */
export interface PhotoTarget {
	album: string;
	src: string;
}

/** 요청 id로 직렬화한다 (앨범 id나 주소에 어떤 글자가 있어도 되돌릴 수 있게 JSON) */
export const photoTargetId = (target: PhotoTarget) => JSON.stringify([target.album, target.src]);

/** 요청 id를 되돌린다. 형식이 다르면 null */
export function parsePhotoTarget(id: string): PhotoTarget | null {
	try {
		const value: unknown = JSON.parse(id);
		if (Array.isArray(value) && value.length === 2 && value.every((part) => typeof part === 'string')) {
			return { album: value[0] as string, src: value[1] as string };
		}
	} catch {
		// JSON이 아니면 아래에서 null
	}
	return null;
}

/** 보관함에서 그 사진의 앨범과 앨범 안의 순번. 앨범이나 사진이 (아직) 없으면 null */
export function locatePhoto(albums: readonly Album[], target: PhotoTarget): { album: Album; index: number } | null {
	const album = albums.find((entry) => entry.id === target.album);
	const index = album ? album.photos.findIndex((photo) => photo.src === target.src) : -1;
	return album && index >= 0 ? { album, index } : null;
}
