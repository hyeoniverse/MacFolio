// 좋아요 API (apps/api의 /posts/:slug/likes·like, /comments/:id/like, /posts/stats)
import { api, type ApiOptions } from '@/shared/api/client';

/** 좋아요 수와 이 브라우저가 눌렀는지 */
export interface Likes {
	count: number;
	liked: boolean;
}

/** 글마다 댓글 수와 좋아요 수 (하나라도 있는 글만) */
export type PostCounts = Record<string, { comments: number; likes: number }>;

/** 실패하면 null (좋아요는 조용히 실패한다) */
const call = <T>(path: string, options: ApiOptions): Promise<T | null> => api<T>(path, options).catch(() => null);

/** 글의 좋아요. 읽지 못하면 null */
export const fetchPostLikes = (apiUrl: string, slug: string, fetchImpl: typeof fetch = fetch) =>
	call<Likes>(`/posts/${encodeURIComponent(slug)}/likes`, { apiUrl, fetchImpl });

/** 글에 좋아요를 누르거나(true) 취소한다(false). 바뀐 뒤의 값, 실패하면 null */
export const setPostLike = (apiUrl: string, slug: string, liked: boolean, fetchImpl: typeof fetch = fetch) =>
	call<Likes>(`/posts/${encodeURIComponent(slug)}/like`, { method: liked ? 'PUT' : 'DELETE', apiUrl, fetchImpl });

/** 댓글에 좋아요를 누르거나 취소한다. 바뀐 뒤의 값, 실패하면 null */
export const setCommentLike = (apiUrl: string, id: string, liked: boolean, fetchImpl: typeof fetch = fetch) =>
	call<Likes>(`/comments/${encodeURIComponent(id)}/like`, { method: liked ? 'PUT' : 'DELETE', apiUrl, fetchImpl });

/** 글마다 댓글 수와 좋아요 수. 읽지 못하면 null */
export const fetchPostCounts = (apiUrl: string, fetchImpl: typeof fetch = fetch) =>
	call<PostCounts>('/posts/stats', { apiUrl, fetchImpl });

/**
 * 누르는 즉시 화면을 바꾸고(낙관적), 서버의 답으로 맞춘다. 실패하면 되돌린다.
 * 반환: 서버가 준 값, 실패하면 누르기 전 값
 */
export async function toggleLike(
	current: Likes,
	send: (liked: boolean) => Promise<Likes | null>,
	show: (next: Likes) => void
): Promise<Likes> {
	const next = { count: Math.max(0, current.count + (current.liked ? -1 : 1)), liked: !current.liked };
	show(next);
	const saved = await send(next.liked);
	show(saved ?? current);
	return saved ?? current;
}
