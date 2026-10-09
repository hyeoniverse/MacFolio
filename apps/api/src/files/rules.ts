// 올린 파일 규칙. 이미지는 형식 이름을 믿지 않고 파일 앞부분(매직 넘버)으로 확인한다.
import { randomBytes } from 'node:crypto';

/** 한 파일 크기 한도 (DB CHECK 제약과 같다) */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const UPLOAD_ID = /^[\w-]{16}$/;

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

/** 브라우저가 바로 보여 주는 이미지 형식 (올릴 때 파일 앞부분으로 확인해 type에 적은 값) */
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

/** 글(Markdown)에서 가리키는 파일 id들. 편집기는 이미지·첨부를 `<API 주소>/files/<id>`로 넣는다 */
export function uploadIdsIn(text: string | null | undefined): string[] {
	if (!text) return [];
	return [...new Set([...text.matchAll(/\/files\/([\w-]{16})(?![\w-])/g)].map((match) => match[1]))];
}
