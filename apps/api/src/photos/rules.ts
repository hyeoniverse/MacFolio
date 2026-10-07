// 사진 캡션 규칙 (DB CHECK 제약과 같다). React·Nest에 의존하지 않는다

export const CAPTION_MAX = 200;
export const SRC_MAX = 500;

/** 고칠 캡션: 사진 주소와 새 캡션. caption이 null이면 고친 것을 지우고 원래 캡션으로 돌아간다 */
export interface CaptionInput {
	src: string;
	caption: string | null;
}

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/g;
// 있는지 볼 때는 g 없이 (g가 있으면 test가 lastIndex를 이어 써서 번갈아 틀린다)
// eslint-disable-next-line no-control-regex
const HAS_CONTROL = /[\u0000-\u001f\u007f]/;

/** 사진 주소: 사이트 안의 경로(/로 시작)나 https 주소. 제어 문자 없이 500자까지 */
const isPhotoSrc = (src: string) =>
	src.length <= SRC_MAX && !HAS_CONTROL.test(src) && (/^\/[^/]/.test(src) || /^https:\/\//.test(src));

/**
 * 요청 본문을 검사한다. 캡션은 제어 문자를 빼고 앞뒤 공백을 지운 뒤 200자까지 (넘으면 거절), 비면 null(원래대로).
 * 잘못되었으면 이유를 돌려준다
 */
export function parseCaptionInput(body: unknown): CaptionInput | string {
	if (typeof body !== 'object' || body === null) return '본문이 비었습니다.';
	const { src, caption } = body as { src?: unknown; caption?: unknown };
	if (typeof src !== 'string' || !isPhotoSrc(src)) return '사진 주소가 잘못되었습니다.';
	if (typeof caption !== 'string') return '캡션은 글자여야 합니다.';
	const cleaned = caption.replace(CONTROL, '').trim();
	if (Array.from(cleaned).length > CAPTION_MAX) return `캡션은 ${CAPTION_MAX}자까지 쓸 수 있습니다.`;
	return { src, caption: cleaned || null };
}
