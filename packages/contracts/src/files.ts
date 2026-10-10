// 올린 파일 (apps/api의 /files). 관리자가 글에 넣는 이미지·첨부와 배경화면 이미지가 여기 저장된다.
// 올리기는 multipart라 몸통 스키마가 없다. 서버와 화면이 같이 쓰는 한도·주소 모양·응답 모양만 둔다.
// 파일 내용을 보는 것(매직 바이트, 메타데이터 지우기)은 서버의 files/rules.ts
import { z } from 'zod';

/** 한 파일 크기 한도 (DB CHECK 제약과 같다). 화면은 올리기 전에, 서버는 받을 때 본다 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** 파일 주소의 id: 짐작할 수 없는 16자 (12바이트 base64url) */
export const UPLOAD_ID = /^[\w-]{16}$/;

/** 브라우저가 바로 보여 주는 이미지 형식 (서버가 파일 앞부분으로 확인해 type에 적은 값). 화면의 파일 고르기 accept도 이 목록 */
export const IMAGE_TYPES: readonly string[] = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

/** 글(Markdown)에서 가리키는 파일 id들. 편집기는 이미지·첨부를 `<API 주소>/files/<id>`로 넣는다 */
export function uploadIdsIn(text: string | null | undefined): string[] {
	if (!text) return [];
	return [...new Set([...text.matchAll(/\/files\/([\w-]{16})(?![\w-])/g)].map((match) => match[1]))];
}

/** 올린 파일 하나 (POST /files의 응답) */
export const Upload = z.object({
	id: z.string(),
	name: z.string(),
	type: z.string(),
	size: z.number().int().nonnegative(),
	/** 브라우저가 바로 보여 줄 수 있는 이미지인지 */
	image: z.boolean(),
	/** API 주소 기준 경로 (/files/:id). 화면이 앞에 API 주소를 붙인다 */
	path: z.string(),
});
export type Upload = z.infer<typeof Upload>;

/** 관리자가 보는 파일 하나와, 그 파일을 어디에서 쓰는지 (GET /files) */
export const UploadUsage = Upload.extend({
	/** ISO 8601 */
	createdAt: z.string(),
	createdBy: z.string(),
	usedBy: z.object({
		/** 지금 글(게시한 내용·임시 저장, 최근 삭제된 글 포함)에서 가리키는 글 주소 */
		posts: z.array(z.string()),
		/** 예전 버전에서만 가리키는 글 주소 (지우면 그 버전으로 되돌릴 때 그림이 깨진다) */
		revisions: z.array(z.string()),
		/** 배경화면의 원본이나 썸네일 */
		wallpaper: z.boolean(),
	}),
});
export type UploadUsage = z.infer<typeof UploadUsage>;
