// 블로그 댓글 API (apps/api의 /posts/:slug/comments, /comments/:id)
import type { Comment } from '@macfolio/contracts';
import { api, apiFetch, reasonsFrom } from '@/shared/api/client';

/** 댓글 모양은 서버와 같은 스키마(contracts). 서버가 바꾸면 여기 타입도 같이 바뀐다 */
export type { Comment };

export type CreateResult = { ok: true; comment: Comment } | { ok: false; errors: string[] };
export type DeleteResult = 'ok' | 'forbidden' | 'not-found' | 'error';

/** 글의 댓글 (오래된 것부터). 읽지 못하면 null */
export const listComments = (apiUrl: string, slug: string, fetchImpl: typeof fetch = fetch) =>
	api<Comment[]>(`/posts/${encodeURIComponent(slug)}/comments`, { apiUrl, fetchImpl }).catch(() => null);

/** 댓글을 쓴다. 이름은 서버가 정한다 (방문자는 쿠키로 정한 이름, 관리자는 김정현) */
export async function createComment(
	apiUrl: string,
	slug: string,
	input: { body: string; turnstileToken?: string },
	fetchImpl: typeof fetch = fetch
): Promise<CreateResult> {
	try {
		const comment = await api<Comment>(`/posts/${encodeURIComponent(slug)}/comments`, {
			method: 'POST',
			json: input,
			fallback: '댓글을 쓰지 못했습니다.',
			apiUrl,
			fetchImpl,
		});
		return { ok: true, comment };
	} catch (error) {
		return { ok: false, errors: reasonsFrom(error) };
	}
}

/** 댓글을 지운다 (방문자는 이 브라우저에서 쓴 것만, 관리자는 무엇이든) */
export async function deleteComment(
	apiUrl: string,
	id: string,
	fetchImpl: typeof fetch = fetch
): Promise<DeleteResult> {
	try {
		const response = await apiFetch(`/comments/${encodeURIComponent(id)}`, { method: 'DELETE', apiUrl, fetchImpl });
		if (response.ok) return 'ok';
		if (response.status === 403) return 'forbidden';
		if (response.status === 404) return 'not-found';
		return 'error';
	} catch {
		return 'error';
	}
}

/** "2026. 9. 29. 14:05" */
export function formatCommentTime(iso: string, timeZone?: string): string {
	return new Intl.DateTimeFormat('ko-KR', {
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
		timeZone,
	}).format(new Date(iso));
}
