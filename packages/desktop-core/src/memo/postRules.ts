// 글쓰기 입력 검사. 길이와 날짜 규칙은 서버(apps/api/src/posts/rules.ts)와 함께 쓰고(rules.ts), 저장하기 전에 칸마다 먼저 알려 준다.
// 서버와 DB도 같은 규칙으로 다시 막는다 (화면을 거치지 않은 요청도 있으므로).
import type { PostContent as PostDraft } from './posts.js';
import { isCalendarDate, POST_LIMITS } from './rules.js';

export type DraftField = keyof PostDraft;

/** 항목마다 문제 (없으면 빈 객체). 화면에서 그 칸을 표시하고 첫 칸으로 옮겨 간다 */
export function validateDraft(draft: PostDraft): Partial<Record<DraftField, string>> {
	const errors: Partial<Record<DraftField, string>> = {};
	const title = draft.title.trim();
	if (!title) errors.title = '제목을 입력해주세요.';
	else if (title.length > POST_LIMITS.title) errors.title = `제목은 ${POST_LIMITS.title}자까지 입력할 수 있습니다.`;
	if (!isCalendarDate(draft.date)) errors.date = '날짜를 골라주세요.';
	if (!draft.category.trim()) errors.category = '폴더를 골라주세요.';
	if (draft.summary.trim().length > POST_LIMITS.summary)
		errors.summary = `요약은 ${POST_LIMITS.summary}자까지 입력할 수 있습니다.`;
	if (!draft.body.trim()) errors.body = '본문을 입력해주세요.';
	else if (draft.body.length > POST_LIMITS.body) errors.body = `본문은 ${POST_LIMITS.body}자까지 입력할 수 있습니다.`;
	return errors;
}
