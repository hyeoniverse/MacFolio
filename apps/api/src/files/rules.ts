// 올린 파일 규칙 (서버에서만 하는 것: 파일 내용 보기, 이름·형식 다듬기, 내려받기 머리말).
// 한도·주소 모양·글에서 id 찾기는 @macfolio/contracts (화면과 같이 쓴다). 이미지는 형식 이름을 믿지 않고 파일 앞부분(매직 넘버)으로 확인한다.
import { randomBytes } from 'node:crypto';

export { IMAGE_TYPES, MAX_UPLOAD_BYTES, MAX_WALLPAPER_VIDEO_BYTES, UPLOAD_ID, uploadIdsIn } from '@macfolio/contracts';

/** 짐작할 수 없는 파일 주소 (12바이트 → base64url 16자) */
export const newUploadId = () => randomBytes(12).toString('base64url');

const startsWith = (data: Uint8Array, bytes: number[], offset = 0) =>
	data.length >= offset + bytes.length && bytes.every((byte, index) => data[offset + index] === byte);

/** 브라우저가 바로 보여 줄 이미지면 그 형식, 아니면 null. SVG는 스크립트를 담을 수 있어서 이미지로 보지 않는다 */
export function sniffImage(data: Uint8Array): string | null {
	if (startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
	if (startsWith(data, [0xff, 0xd8, 0xff])) return 'image/jpeg';
	if (startsWith(data, [0x47, 0x49, 0x46, 0x38])) return 'image/gif';
	if (startsWith(data, [0x52, 0x49, 0x46, 0x46]) && startsWith(data, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
	return null;
}

/**
 * MP4의 주 브랜드(ftyp 상자 바로 뒤 4글자). 브라우저가 <video>로 바로 트는 것만 받는다.
 * QuickTime(qt  )·3GP 등은 브라우저마다 다르게 틀거나 못 틀어서 뺐다
 */
const MP4_BRANDS = new Set(['isom', 'iso2', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'M4V ', 'dash', 'mmp4']);

/** 배경화면으로 틀 동영상(MP4)이면 'video/mp4', 아니면 null. 4~8바이트가 'ftyp'이고 주 브랜드가 MP4인지 본다 */
export function sniffVideo(data: Uint8Array): string | null {
	if (!startsWith(data, [0x66, 0x74, 0x79, 0x70], 4) || data.length < 12) return null;
	const size = ((data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3]) >>> 0;
	if (size < 16) return null;
	const brand = String.fromCharCode(...data.subarray(8, 12));
	return MP4_BRANDS.has(brand) ? 'video/mp4' : null;
}

/**
 * Range 머리말(bytes=시작-끝 하나만)을 [시작, 끝]으로. 머리말이 없거나 여러 구간이면 null(전체를 보낸다),
 * 파일 밖이면 'unsatisfiable'(416). Safari는 <video>를 이 요청으로만 튼다
 */
export function parseRange(header: string | undefined, size: number): [number, number] | null | 'unsatisfiable' {
	if (!header) return null;
	const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
	if (!match || (!match[1] && !match[2])) return null;
	let start: number;
	let end: number;
	if (!match[1]) {
		// bytes=-500: 끝에서 500바이트
		start = Math.max(0, size - Number(match[2]));
		end = size - 1;
	} else {
		start = Number(match[1]);
		end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
	}
	if (start >= size || start > end) return 'unsatisfiable';
	return [start, end];
}

/** 파일 이름 다듬기: 경로와 제어 문자를 빼고 200자까지. 비면 'file' */
export function cleanFileName(name: string): string {
	const base = name.split(/[/\\]/).pop() ?? '';
	// eslint-disable-next-line no-control-regex
	const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
	return (cleaned || 'file').slice(0, 200);
}

/** 이미지가 아닌 파일의 형식: 모양이 올바르면 그대로, 아니면 application/octet-stream */
export function cleanFileType(type: string): string {
	return /^[\w.+-]+\/[\w.+-]+$/.test(type) ? type.toLowerCase() : 'application/octet-stream';
}

/** 내려받을 때의 Content-Disposition. 한글 이름도 깨지지 않게 RFC 5987 형식을 함께 쓴다 */
export function contentDisposition(kind: 'inline' | 'attachment', name: string): string {
	const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
	// encodeURIComponent는 ' ( ) *를 그대로 두는데, RFC 5987에서는 이것도 인코딩해야 한다
	const encoded = encodeURIComponent(name).replace(
		/['()*]/g,
		(char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
	);
	return `${kind}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
