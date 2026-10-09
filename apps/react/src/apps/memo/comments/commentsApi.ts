// 블로그 댓글 API (apps/api의 /posts/:slug/comments, /comments/:id)

export interface Comment {
	id: string;
	name: string;
	/** IP 앞 두 자리 (관리자 댓글은 없음) */
	ipPrefix: string | null;
	isAdmin: boolean;
	body: string;
	createdAt: string;
	/** 이 브라우저가 쓴 댓글 (지울 수 있다) */
	mine: boolean;
	/** 좋아요 수 */
	likes: number;
	/** 이 브라우저가 좋아요를 눌렀는지 */
	liked: boolean;
}

export type CreateResult = { ok: true; comment: Comment } | { ok: false; errors: string[] };
export type DeleteResult = 'ok' | 'forbidden' | 'not-found' | 'error';

const errorsOf = async (response: Response): Promise<string[]> => {
	const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };
	if (response.status === 429) return ['잠시 뒤에 다시 써 주세요.'];
	return Array.isArray(body.message) ? body.message : [body.message ?? '댓글을 쓰지 못했습니다.'];
};

/** 글의 댓글 (오래된 것부터). 읽지 못하면 null */
export async function listComments(apiUrl: string, slug: string, fetchImpl: typeof fetch = fetch) {
	try {
		const response = await fetchImpl(`${apiUrl}/posts/${encodeURIComponent(slug)}/comments`, {
			credentials: 'include',
		});
		return response.ok ? ((await response.json()) as Comment[]) : null;
	} catch {
		return null;
	}
}

/** 댓글을 쓴다. 이름은 서버가 정한다 (방문자는 쿠키로 정한 이름, 관리자는 김정현) */
export async function createComment(
	apiUrl: string,
	slug: string,
	input: { body: string },
	fetchImpl: typeof fetch = fetch
): Promise<CreateResult> {
	try {
		const response = await fetchImpl(`${apiUrl}/posts/${encodeURIComponent(slug)}/comments`, {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(input),
		});
		if (response.ok) return { ok: true, comment: (await response.json()) as Comment };
		return { ok: false, errors: await errorsOf(response) };
	} catch {
		return { ok: false, errors: ['서버에 연결할 수 없습니다.'] };
	}
}

/** 댓글을 지운다 (방문자는 이 브라우저에서 쓴 것만, 관리자는 무엇이든) */
export async function deleteComment(
	apiUrl: string,
	id: string,
	fetchImpl: typeof fetch = fetch
): Promise<DeleteResult> {
	try {
		const response = await fetchImpl(`${apiUrl}/comments/${encodeURIComponent(id)}`, {
			method: 'DELETE',
			credentials: 'include',
		});
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
