// 이미지·첨부 파일 내려받기. 다른 주소(API, Unsplash 등)의 파일은 <a download>가 듣지 않아서 받아 와 파일로 저장한다.

import { fetchFileBlob } from '@/shared/api/remoteFileApi';

const EXTENSIONS: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/gif': 'gif',
	'image/webp': 'webp',
	'image/avif': 'avif',
	'image/svg+xml': 'svg',
};

/** 저장할 파일 이름: 설명(없으면 주소의 파일 이름) + 형식에 맞는 확장자. 파일 이름에 쓸 수 없는 글자는 뺀다 */
export function imageFileName(alt: string, src: string, type: string): string {
	const fromUrl = decodeURIComponent(src.split(/[?#]/)[0].split('/').pop() ?? '').replace(/\.[^.]+$/, '');
	// eslint-disable-next-line no-control-regex -- 파일 이름에 쓸 수 없는 제어 문자를 뺀다
	const base = (alt.trim() || fromUrl || 'image').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').slice(0, 80) || 'image';
	const extension =
		EXTENSIONS[type] ?? src.match(/\.(png|jpe?g|gif|webp|avif|svg)(?:[?#]|$)/i)?.[1]?.toLowerCase() ?? 'png';
	return `${base}.${extension}`;
}

/** 받아 와서 파일로 저장한다. 받지 못하면(CORS 등) 새 탭에서 연다 */
export async function downloadImage(src: string, alt: string) {
	try {
		const response = await fetch(src);
		if (!response.ok) throw new Error(String(response.status));
		const blob = await response.blob();
		saveBlob(blob, imageFileName(alt, src, blob.type));
	} catch {
		window.open(src, '_blank', 'noopener,noreferrer');
	}
}

/**
 * 글에 올린 첨부 파일을 링크 글자(올릴 때의 파일 이름)로 저장한다. 링크를 누르면 사이트 안 앱으로 열리므로 따로 둔 길이다.
 * 받지 못하면 새 탭에서 연다 (API가 Content-Disposition: attachment로 내주므로 브라우저가 내려받는다)
 */
export async function downloadFile(src: string, name: string) {
	try {
		saveBlob(await fetchFileBlob(src), name);
	} catch {
		window.open(src, '_blank', 'noopener,noreferrer');
	}
}

function saveBlob(blob: Blob, name: string) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = name;
	document.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
