// 사진 캡션 규칙 (DB CHECK 제약과 같다). 몸통 스키마는 @macfolio/contracts (설정 화면과 같은 규칙)
import { CAPTION_MAX, CaptionInput, parse, PHOTO_SRC_MAX } from '@macfolio/contracts';

export { CAPTION_MAX };
export const SRC_MAX = PHOTO_SRC_MAX;

/** 고칠 캡션: 사진 주소와 새 캡션. caption이 null이면 고친 것을 지우고 원래 캡션으로 돌아간다 */
export type { CaptionInput };

/** 요청 본문을 검사한다. 잘못되었으면 첫 이유를 돌려준다 */
export function parseCaptionInput(body: unknown): CaptionInput | string {
	const parsed = parse(CaptionInput, body);
	return 'errors' in parsed ? parsed.errors[0] : parsed.value;
}
