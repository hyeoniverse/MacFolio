// 글쓰기 입력 규칙. 서버(apps/api/src/posts/rules.ts)와 같은 규칙을 저장하기 전에 먼저 확인한다.
// 서버와 DB도 같은 규칙으로 다시 막는다 (화면을 거치지 않은 요청도 있으므로).
import type { PostContent as PostDraft } from './posts';

export const POST_LIMITS = { title: 100, summary: 200, body: 50_000 } as const;

export type DraftField = keyof PostDraft;

/** 실제로 있는 날짜인지 (2026-02-30 같은 날짜는 거절) */
function isDate(value: string) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const date = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** 항목마다 문제 (없으면 빈 객체). 화면에서 그 칸을 표시하고 첫 칸으로 옮겨 간다 */
export function validateDraft(draft: PostDraft): Partial<Record<DraftField, string>> {
	const errors: Partial<Record<DraftField, string>> = {};
	const title = draft.title.trim();
	if (!title) errors.title = '제목을 입력해주세요.';
	else if (title.length > POST_LIMITS.title) errors.title = `제목은 ${POST_LIMITS.title}자까지 입력할 수 있습니다.`;
	if (!isDate(draft.date)) errors.date = '날짜를 골라주세요.';
	if (!draft.category.trim()) errors.category = '폴더를 골라주세요.';
	if (draft.summary.trim().length > POST_LIMITS.summary)
		errors.summary = `요약은 ${POST_LIMITS.summary}자까지 입력할 수 있습니다.`;
	if (!draft.body.trim()) errors.body = '본문을 입력해주세요.';
	else if (draft.body.length > POST_LIMITS.body) errors.body = `본문은 ${POST_LIMITS.body}자까지 입력할 수 있습니다.`;
	return errors;
}
