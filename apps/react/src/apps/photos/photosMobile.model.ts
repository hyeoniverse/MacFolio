// 휴대폰 사진 앱의 화면 상태 타입과 목록 계산 (격자·크게 보기·본체가 함께 쓴다)
import { ALL_PHOTOS, type Album } from './albums';
import type { Shown } from './PhotoParts';
import { captionOf } from './captionsApi';

export type Tab = 'library' | 'collections';
/** 모음에서 들어간 곳: 앨범 하나, 또는 비디오만 */
export type Opened = { kind: 'album'; id: string } | { kind: 'videos' } | null;
/** 크게 보는 사진: 어느 목록의 몇 번째인지 */
export type Viewing = { photos: Shown[]; index: number } | null;

export const VIDEOS = ALL_PHOTOS.filter((photo) => photo.video);
/** 앨범의 대표 사진 (영상이 아닌 첫 사진) */
export const coverOf = (album: Album) => album.photos.find((photo) => !photo.video)?.src;
/** 사진 하나를 가리키는 키 (같은 파일이 여러 앨범에 있어도 앨범까지 구분한다) */
export const keyOf = (photo: Shown) => `${photo.album.id}:${photo.src}`;

/** 검색: 사진 설명이나 앨범 이름에 검색어가 들어간 사진 (대소문자 무시) */
export const searchPhotos = (query: string, captions: Record<string, string>) => {
	const needle = query.trim().toLowerCase();
	return needle
		? ALL_PHOTOS.filter((photo) => `${captionOf(photo, captions)} ${photo.album.name}`.toLowerCase().includes(needle))
		: [];
};
