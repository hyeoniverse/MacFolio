// Finder의 문서 파일 (이력서·포트폴리오·자격증). 파일은 R2에 있고 목록은 API의 /documents에 있다.
// 관리자는 Finder에 끌어다 놓아 올린다: API가 R2에 바로 올릴 서명 주소를 주고, 다 올리면 목록에 더한다
import { z } from 'zod';
import { requestBody } from './parse.js';

/** Finder의 문서 안에 보이는 폴더. 순서도 이대로. R2 키는 영어 이름 아래에 둔다 */
export const DOCUMENT_FOLDERS = ['이력서', '포트폴리오', '자격증'] as const;
export type DocumentFolder = (typeof DOCUMENT_FOLDERS)[number];
export const DOCUMENT_FOLDER_KEYS: Record<DocumentFolder, string> = {
	이력서: 'resume',
	포트폴리오: 'portfolio',
	자격증: 'certificates',
};

/** 받는 파일 종류 (확장자 → 종류). 사이트 Worker의 /files/*가 내주는 종류와 같다 */
export const DOCUMENT_EXTENSIONS: Record<string, 'pdf' | 'image'> = {
	pdf: 'pdf',
	png: 'image',
	jpg: 'image',
	jpeg: 'image',
	webp: 'image',
};

/** 파일 하나의 최대 크기 (20MB) */
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
/** 이름 길이 (DB CHECK 제약과 같다) */
export const DOCUMENT_NAME_MAX = 100;

/** 확장자 (소문자). 받지 않는 종류면 null */
export function documentExtension(name: string): string | null {
	const match = /\.([a-z0-9]+)$/i.exec(name);
	const ext = match?.[1].toLowerCase() ?? null;
	return ext && ext in DOCUMENT_EXTENSIONS ? ext : null;
}

/** 이름 다듬기: 제어 문자·경로 구분자를 빼고 앞뒤 공백을 지운 뒤 100자까지. 비면 null */
export function cleanDocumentName(name: unknown): string | null {
	if (typeof name !== 'string') return null;
	const cleaned = name
		// eslint-disable-next-line no-control-regex
		.replace(/[\u0000-\u001f\u007f/\\]/g, '')
		.trim();
	return cleaned ? Array.from(cleaned).slice(0, DOCUMENT_NAME_MAX).join('') : null;
}

const folder = z.enum(DOCUMENT_FOLDERS, { error: '이력서·포트폴리오·자격증 폴더에만 올릴 수 있습니다.' });
const name = z.preprocess(
	cleanDocumentName,
	z
		.string({ error: '파일 이름이 필요합니다.' })
		.refine((value) => documentExtension(value) !== null, 'PDF, PNG, JPG, WebP 파일만 올릴 수 있습니다.')
);
const size = z
	.number({ error: '파일 크기가 필요합니다.' })
	.int()
	.min(1, '빈 파일은 올릴 수 없습니다.')
	.max(MAX_DOCUMENT_BYTES, '20MB까지 올릴 수 있습니다.');

/** 올리기 시작 (POST /documents/uploads): 어느 폴더에 어떤 파일을 올릴지 */
export const DocumentUploadRequest = requestBody({ folder, name, size });
export type DocumentUploadRequest = z.infer<typeof DocumentUploadRequest>;

/** 올릴 곳: R2에 바로 PUT할 서명 주소 (Content-Length가 size와 같아야 받는다) */
export const DocumentUploadTicket = z.object({
	key: z.string(),
	url: z.string(),
	/** 주소가 유효한 시간 (초) */
	expiresIn: z.number(),
});
export type DocumentUploadTicket = z.infer<typeof DocumentUploadTicket>;

/** 다 올린 뒤 목록에 더하기 (POST /documents) */
export const DocumentCreate = requestBody({ folder, name, key: z.string({ error: '키가 필요합니다.' }), size });
export type DocumentCreate = z.infer<typeof DocumentCreate>;

/** 이름 바꾸기 (PATCH /documents/:id). 확장자는 바꿀 수 없다 (서버가 확인한다) */
export const DocumentRename = requestBody({ name });
export type DocumentRename = z.infer<typeof DocumentRename>;

/** 목록의 파일 하나 */
export const DocumentFile = z.object({
	id: z.string(),
	folder: z.enum(DOCUMENT_FOLDERS),
	name: z.string(),
	/** R2 키. 사이트 주소 /files/<key>로 받는다 */
	key: z.string(),
	kind: z.enum(['pdf', 'image']),
	size: z.number(),
	/** YYYY-MM-DD */
	updated: z.string(),
});
export type DocumentFile = z.infer<typeof DocumentFile>;
