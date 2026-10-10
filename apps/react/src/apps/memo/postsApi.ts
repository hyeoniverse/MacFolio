// 블로그 글 API (apps/api의 /posts). 누구나 게시한 글을 읽고, 관리자만 쓰고 고치고 게시하고 지운다.
// 고치는 동안은 임시 저장에만 쓰고(자동 저장), 게시해야 방문자에게 보인다. 게시할 때마다 버전이 남는다.
import type { AdminPost, PostContent, ServerPost } from '@macfolio/desktop-core/memo';
import { api, type ApiOptions, reasonsFrom } from '@/shared/api/client';

export type PostDraft = PostContent;

export type SaveResult = { ok: true; post: AdminPost } | { ok: false; errors: string[] };

export interface RevisionSummary {
	id: number;
	title: string;
	date: string;
	createdAt: string;
	createdBy: string;
}

export type Revision = RevisionSummary & PostContent;

/** 성공하면 몸통, 실패하면 서버가 준 이유들 (던지지 않는다: 화면이 이유를 그대로 보여 준다) */
async function send(
	fetchImpl: typeof fetch,
	apiUrl: string,
	path: string,
	method: ApiOptions['method'],
	json?: unknown
): Promise<{ ok: true; body: unknown } | { ok: false; errors: string[] }> {
	try {
		return { ok: true, body: await api(path, { method, json, apiUrl, fetchImpl, fallback: '저장하지 못했습니다.' }) };
	} catch (error) {
		return { ok: false, errors: reasonsFrom(error) };
	}
}

const postUrl = (slug: string, rest = '') => `/posts/${encodeURIComponent(slug)}${rest}`;

/** 서버의 글 (API가 없거나 읽지 못하면 빈 목록: 저장소 글만 보인다) */
export const fetchServerPosts = (apiUrl: string, fetchImpl: typeof fetch = fetch): Promise<ServerPost[]> =>
	api<ServerPost[]>('/posts', { apiUrl, fetchImpl }).catch(() => []);

/** 관리자용 목록: 게시한 내용과 임시 저장 (읽지 못하면 null) */
export const fetchAdminPosts = (apiUrl: string, fetchImpl: typeof fetch = fetch): Promise<AdminPost[] | null> =>
	api<AdminPost[]>('/posts/admin', { apiUrl, fetchImpl }).catch(() => null);

/** 임시 저장 (자동 저장). 새 글이면 slug 없이: 주소가 생긴다 */
export async function saveDraft(
	apiUrl: string,
	slug: string | null,
	draft: PostDraft,
	fetchImpl: typeof fetch = fetch
): Promise<SaveResult> {
	const result = slug
		? await send(fetchImpl, apiUrl, postUrl(slug, '/draft'), 'PUT', draft)
		: await send(fetchImpl, apiUrl, '/posts', 'POST', draft);
	return result.ok ? { ok: true, post: result.body as AdminPost } : result;
}

/** 게시 (날짜가 미래면 그날부터 보인다). 지금 내용을 그대로 보낸다 */
export async function publishPost(
	apiUrl: string,
	slug: string,
	content: PostDraft,
	fetchImpl: typeof fetch = fetch
): Promise<SaveResult> {
	const result = await send(fetchImpl, apiUrl, postUrl(slug, '/publish'), 'POST', content);
	return result.ok ? { ok: true, post: result.body as AdminPost } : result;
}

/** 임시 저장 버리기. 게시한 적 없는 글이면 글이 사라진다 (post: null) */
export async function discardDraft(
	apiUrl: string,
	slug: string,
	fetchImpl: typeof fetch = fetch
): Promise<{ ok: true; post: AdminPost | null } | { ok: false; errors: string[] }> {
	const result = await send(fetchImpl, apiUrl, postUrl(slug, '/draft'), 'DELETE');
	return result.ok ? { ok: true, post: (result.body as AdminPost | null) ?? null } : result;
}

export async function fetchRevisions(
	apiUrl: string,
	slug: string,
	fetchImpl: typeof fetch = fetch
): Promise<RevisionSummary[] | null> {
	const result = await send(fetchImpl, apiUrl, postUrl(slug, '/revisions'), 'GET');
	return result.ok ? (result.body as RevisionSummary[]) : null;
}

export async function fetchRevision(
	apiUrl: string,
	slug: string,
	id: number,
	fetchImpl: typeof fetch = fetch
): Promise<Revision | null> {
	const result = await send(fetchImpl, apiUrl, postUrl(slug, `/revisions/${id}`), 'GET');
	return result.ok ? (result.body as Revision) : null;
}

export async function deletePost(apiUrl: string, slug: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
	const result = await send(fetchImpl, apiUrl, postUrl(slug), 'DELETE');
	return result.ok;
}

/** '최근 삭제된 항목'의 글을 되살린다. 서버에 내용이 없던 저장소 글이면 post: null (파일이 다시 보인다) */
export async function restorePost(
	apiUrl: string,
	slug: string,
	fetchImpl: typeof fetch = fetch
): Promise<{ ok: true; post: AdminPost | null } | { ok: false; errors: string[] }> {
	const result = await send(fetchImpl, apiUrl, postUrl(slug, '/restore'), 'POST');
	if (!result.ok) return result;
	const post = result.body as AdminPost | null;
	return { ok: true, post: post && 'slug' in post ? post : null };
}

/** '최근 삭제된 항목'에서 영구히 지운다 (되돌릴 수 없다) */
export async function purgePost(apiUrl: string, slug: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
	const result = await send(fetchImpl, apiUrl, postUrl(slug, '/permanent'), 'DELETE');
	return result.ok;
}
