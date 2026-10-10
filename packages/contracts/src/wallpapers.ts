// 관리자가 더한 배경화면 (apps/api의 /wallpapers). 누구나 목록을 받고, 관리자만 올리고 이름을 바꾸고 지운다.
// 올리기는 multipart(이미지 두 장 + 이름)라 몸통 스키마가 없고, 이름 다듬기만 여기 규칙을 쓴다
import { z } from 'zod';
import { requestBody } from './parse.js';

/** 이름 길이 (DB CHECK 제약과 같다). 화면의 이름 칸 maxLength도 이 값 */
export const WALLPAPER_NAME_MAX = 40;

/** 이름 다듬기: 확장자와 제어 문자를 빼고 앞뒤 공백을 지운 뒤 40자까지. 비면 null */
export function cleanWallpaperName(name: unknown): string | null {
	if (typeof name !== 'string') return null;
	const cleaned = name
		// eslint-disable-next-line no-control-regex
		.replace(/[\u0000-\u001f\u007f]/g, '')
		.trim()
		.replace(/\.(jpe?g|png|gif|webp|heic)$/i, '')
		.trim();
	return cleaned ? Array.from(cleaned).slice(0, WALLPAPER_NAME_MAX).join('') : null;
}

/** 이름 바꾸기 요청 몸통 (PATCH /wallpapers/:id). 다듬은 이름이 비면 거절 */
export const WallpaperRename = requestBody({
	name: z.preprocess(cleanWallpaperName, z.string({ error: '이름을 입력해 주세요.' })),
});
export type WallpaperRename = z.infer<typeof WallpaperRename>;

/** 더한 배경화면 하나. 이미지 주소는 API 주소 기준 경로(/files/:id)라 화면이 앞에 API 주소를 붙인다 */
export const Wallpaper = z.object({
	id: z.string(),
	name: z.string(),
	image: z.string(),
	thumbnail: z.string(),
	/** ISO 8601 */
	createdAt: z.string(),
});
export type Wallpaper = z.infer<typeof Wallpaper>;
