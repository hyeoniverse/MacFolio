// 문서 파일 (이슈 #20): 이력서·포트폴리오·자격증 파일은 저장소가 아니라 R2 버킷(FILES)에 두고,
// 이 Worker가 사이트와 같은 주소(/files/<키>)로 내준다. 같은 출처라 Finder가 CSP frame-src 'self'로 PDF를 iframe에 띄운다.

/** R2 바인딩에서 쓰는 만큼만 (@cloudflare/workers-types 없이) */
export interface FilesObjectInfo {
	httpEtag: string;
	size: number;
	uploaded?: Date;
}
export interface FilesObject extends FilesObjectInfo {
	body: ReadableStream | null;
}
export interface FilesBucket {
	get(key: string, options?: { range?: { offset: number; length: number } }): Promise<FilesObject | null>;
	head(key: string): Promise<FilesObjectInfo | null>;
}

export const FILES_PREFIX = '/files/';

/** 내주는 확장자와 그 Content-Type. 이 밖의 키는 404 (contracts의 DOCUMENT_EXTENSIONS와 같은 목록) */
export const FILE_TYPES: Record<string, string> = {
	pdf: 'application/pdf',
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	webp: 'image/webp',
	gif: 'image/gif',
	avif: 'image/avif',
	txt: 'text/plain; charset=utf-8',
	md: 'text/plain; charset=utf-8',
	csv: 'text/plain; charset=utf-8',
	json: 'text/plain; charset=utf-8',
	rtf: 'application/rtf',
	doc: 'application/msword',
	docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	xls: 'application/vnd.ms-excel',
	xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	ppt: 'application/vnd.ms-powerpoint',
	pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	hwp: 'application/x-hwp',
	hwpx: 'application/haansofthwpx',
	key: 'application/vnd.apple.keynote',
	pages: 'application/vnd.apple.pages',
	numbers: 'application/vnd.apple.numbers',
	mp4: 'video/mp4',
	mov: 'video/quicktime',
	webm: 'video/webm',
	mp3: 'audio/mpeg',
	m4a: 'audio/mp4',
	wav: 'audio/wav',
	zip: 'application/zip',
};

/** 브라우저 안에서 보여 줄 종류 (PDF·그림·글자·영상·소리). 나머지는 늘 받기(attachment)로 내준다 */
const INLINE = /^(application\/pdf|image\/|text\/plain|video\/|audio\/)/;

/**
 * 파일 응답에만 붙이는 CSP. 사이트 안(같은 출처)의 iframe에만 들어간다.
 * 스크립트·연결 등은 열지 않는다 (PDF·그림·글자·영상·소리만 바로 보이고, 나머지는 받기). sandbox는 Chrome의 PDF 보기를 막아 쓰지 않는다
 */
export const FILE_CSP =
	"default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'self'";

const text = (status: number, body: string, extra: Record<string, string> = {}) =>
	new Response(body, {
		status,
		headers: { 'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff', ...extra },
	});

/** 주소의 경로에서 R2 키를 뽑는다. 허용하지 않는 키면 null */
export function fileKey(pathname: string): string | null {
	if (!pathname.startsWith(FILES_PREFIX)) return null;
	let key: string;
	try {
		key = decodeURIComponent(pathname.slice(FILES_PREFIX.length));
	} catch {
		return null;
	}
	if (!key || key.length > 512) return null;
	// 경로 바꾸기(.., 빈 칸, 백슬래시)와 제어 문자를 막는다
	// eslint-disable-next-line no-control-regex
	if (/[\u0000-\u001f\u007f\\]/.test(key)) return null;
	const parts = key.split('/');
	if (parts.some((part) => part === '' || part === '.' || part === '..')) return null;
	// 키는 <폴더>/<파일>, 프로젝트 폴더만 projects/<프로젝트 id>/<파일>. 더 깊은 경로는 받지 않는다
	if (
		parts.length > 3 ||
		(parts.length === 3 && (parts[0] !== 'projects' || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(parts[1])))
	)
		return null;
	const dot = key.lastIndexOf('.');
	if (dot < 0) return null;
	return key.slice(dot + 1).toLowerCase() in FILE_TYPES ? key : null;
}

/** Content-Disposition (RFC 6266: 한글 이름은 filename*에) */
function disposition(key: string, download: boolean): string {
	const name = key.split('/').at(-1)!;
	const ascii = name.replace(/[^\x20-\x7e]|["\\]/g, '_');
	return `${download ? 'attachment' : 'inline'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/**
 * Range 머리(bytes=a-b, bytes=a-, bytes=-n)를 파일 크기 안의 [시작, 길이]로. 없으면 null, 맞지 않으면 'invalid'.
 * 동영상(<video>)은 나눠 받는다: Safari는 206으로 답하지 않으면 재생하지 않고, Chrome도 앞뒤로 옮길 수 없다
 */
export function parseRange(header: string | null, size: number): { offset: number; length: number } | null | 'invalid' {
	if (!header) return null;
	const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
	if (!match || (!match[1] && !match[2])) return 'invalid';
	let start: number;
	let end: number;
	if (!match[1]) {
		// 끝에서 n바이트
		const suffix = Number(match[2]);
		if (suffix === 0) return 'invalid';
		start = Math.max(0, size - suffix);
		end = size - 1;
	} else {
		start = Number(match[1]);
		end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
	}
	if (start >= size || end < start) return 'invalid';
	return { offset: start, length: end - start + 1 };
}

/** GET·HEAD /files/<키>. 바인딩이 없으면(로컬·미리보기) 404 */
export async function serveFile(request: Request, bucket: FilesBucket | undefined): Promise<Response> {
	if (request.method !== 'GET' && request.method !== 'HEAD')
		return text(405, 'Method Not Allowed', { allow: 'GET, HEAD' });
	const url = new URL(request.url);
	const key = fileKey(url.pathname);
	if (!key || !bucket) return text(404, 'Not Found');

	const head = request.method === 'HEAD';
	// Range가 오면 크기를 먼저 알아야 한다 (R2 head는 내용을 받지 않는다)
	const rangeHeader = request.headers.get('range');
	const info = rangeHeader && !head ? await bucket.head(key) : null;
	const range = info ? parseRange(rangeHeader, info.size) : null;
	if (range === 'invalid')
		return text(416, 'Range Not Satisfiable', { 'content-range': `bytes */${info!.size}`, 'accept-ranges': 'bytes' });
	const object: FilesObjectInfo | FilesObject | null = head
		? await bucket.head(key)
		: range
			? await bucket.get(key, { range })
			: await bucket.get(key);
	if (!object) return text(404, 'Not Found');

	const headers: Record<string, string> = {
		'content-type': FILE_TYPES[key.slice(key.lastIndexOf('.') + 1).toLowerCase()],
		etag: object.httpEtag,
		'cache-control': 'public, max-age=300',
		'content-disposition': disposition(
			key,
			url.searchParams.get('download') === '1' ||
				!INLINE.test(FILE_TYPES[key.slice(key.lastIndexOf('.') + 1).toLowerCase()])
		),
		'content-security-policy': FILE_CSP,
		'x-content-type-options': 'nosniff',
		'x-frame-options': 'SAMEORIGIN',
		'referrer-policy': 'strict-origin-when-cross-origin',
		'cross-origin-resource-policy': 'same-origin',
		'accept-ranges': 'bytes',
	};
	if (object.uploaded) headers['last-modified'] = object.uploaded.toUTCString();

	const match = request.headers.get('if-none-match');
	if (match && match.split(',').some((tag) => tag.trim() === object.httpEtag || tag.trim() === '*'))
		return new Response(null, { status: 304, headers });

	const body = head ? null : (object as FilesObject).body;
	if (range && info) {
		headers['content-range'] = `bytes ${range.offset}-${range.offset + range.length - 1}/${info.size}`;
		headers['content-length'] = String(range.length);
		return new Response(body, { status: 206, headers });
	}
	headers['content-length'] = String(object.size);
	return new Response(body, { status: 200, headers });
}
