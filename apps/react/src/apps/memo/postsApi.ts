// 블로그 글 API (apps/api의 /posts). 누구나 읽고, 관리자만 쓰고 고치고 지운다.
import type { ServerPost } from './posts';

export interface PostDraft {
	title: string;
	/** YYYY-MM-DD */
	date: string;
	category: string;
	summary: string;
	body: string;
}

export type SaveResult = { ok: true; post: ServerPost } | { ok: false; errors: string[] };

/** 서버의 글 (API가 없거나 읽지 못하면 빈 목록: 저장소 글만 보인다) */
export async function fetchServerPosts(apiUrl: string, fetchImpl: typeof fetch = fetch): Promise<ServerPost[]> {
	if (!apiUrl) return [];
	try {
		const response = await fetchImpl(`${apiUrl}/posts`, { credentials: 'include' });
		return response.ok ? ((await response.json()) as ServerPost[]) : [];
	} catch {
		return [];
	}
}

/** 새 글이면 slug 없이, 고치면 slug와 함께 */
export async function savePost(
	apiUrl: string,
	slug: string | null,
	draft: PostDraft,
	fetchImpl: typeof fetch = fetch
): Promise<SaveResult> {
	try {
		const response = await fetchImpl(slug ? `${apiUrl}/posts/${encodeURIComponent(slug)}` : `${apiUrl}/posts`, {
			method: slug ? 'PUT' : 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(draft),
		});
		if (response.ok) return { ok: true, post: (await response.json()) as ServerPost };
		if (response.status === 401) return { ok: false, errors: ['관리자 로그인이 끝났습니다. 다시 로그인해 주세요.'] };
		const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };
		return { ok: false, errors: Array.isArray(body.message) ? body.message : [body.message ?? '저장하지 못했습니다.'] };
	} catch {
		return { ok: false, errors: ['서버에 연결할 수 없습니다.'] };
	}
}

export async function deletePost(apiUrl: string, slug: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
	try {
		const response = await fetchImpl(`${apiUrl}/posts/${encodeURIComponent(slug)}`, {
			method: 'DELETE',
			credentials: 'include',
		});
		return response.ok;
	} catch {
		return false;
	}
}
