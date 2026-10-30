/**
 * 글에 넣은 영상·음악 파일을 브라우저 기본 재생기(<video>·<audio>)로 그릴 수 있는지 판별한다.
 * 파일 종류는 확장자로 정한다: 올린 파일은 링크 글자(파일 이름), 바깥 주소는 경로의 끝.
 * 재생 여부는 브라우저가 정하므로, 브라우저 대부분이 바로 트는 형식만 넣는다
 */

export type MediaKind = 'video' | 'audio';

const KINDS: Readonly<Record<string, MediaKind>> = {
	mp4: 'video',
	m4v: 'video',
	webm: 'video',
	mov: 'video',
	ogv: 'video',
	mp3: 'audio',
	m4a: 'audio',
	aac: 'audio',
	wav: 'audio',
	flac: 'audio',
	ogg: 'audio',
	oga: 'audio',
	opus: 'audio',
};

/** 영상·음악 확장자 (편집기의 파일 고르기 등에서 쓴다) */
export const MEDIA_EXTENSIONS = Object.keys(KINDS);

/** 파일 이름이나 주소 경로의 확장자로 영상·음악을 가른다. 검색 인자·조각(#)은 뺀다. 아니면 null */
export function mediaKindOf(name: string): MediaKind | null {
	const path = name.split(/[?#]/)[0];
	const extension = /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase();
	return extension ? (KINDS[extension] ?? null) : null;
}
