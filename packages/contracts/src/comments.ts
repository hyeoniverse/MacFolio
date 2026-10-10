// 블로그 댓글과 좋아요 (apps/api의 /posts/:slug/comments, /comments/:id, /posts/:slug/likes, /posts/stats)
import { z } from 'zod';
import { requestBody } from './parse.js';

export const COMMENT_BODY_MAX = 500;

/** 댓글 쓰기 요청 몸통. 이름은 받지 않는다: 방문자는 쿠키로 정한 이름, 관리자는 프로필 이름 */
export const CommentInput = requestBody({
	body: z
		.string({ error: '내용을 입력해주세요.' })
		.trim()
		.min(1, '내용을 입력해주세요.')
		.max(COMMENT_BODY_MAX, `내용은 ${COMMENT_BODY_MAX}자까지 입력할 수 있습니다.`),
	/** 사람 확인(Turnstile) 토큰. 관리자가 켰을 때만 본다 */
	turnstileToken: z.string().optional(),
});
export type CommentInput = z.infer<typeof CommentInput>;

/** 밖으로 내보내는 댓글. 방문자 해시와 IP 해시는 절대 담지 않는다 */
export const Comment = z.object({
	id: z.string(),
	name: z.string(),
	/** IP 앞 두 자리 (관리자 댓글은 없음) */
	ipPrefix: z.string().nullable(),
	isAdmin: z.boolean(),
	body: z.string(),
	/** ISO 8601 */
	createdAt: z.string(),
	/** 보고 있는 브라우저가 쓴 댓글 (지우기 단추를 보인다) */
	mine: z.boolean(),
	likes: z.number().int().nonnegative(),
	/** 보고 있는 브라우저가 좋아요를 눌렀는지 */
	liked: z.boolean(),
});
export type Comment = z.infer<typeof Comment>;

/** 좋아요 수와 보고 있는 브라우저가 눌렀는지 (글·댓글 공통) */
export const Likes = z.object({ count: z.number().int().nonnegative(), liked: z.boolean() });
export type Likes = z.infer<typeof Likes>;

/** 글마다 댓글 수와 좋아요 수 (하나라도 있는 글만). 인기글 순위에 쓴다 */
export const PostStats = z.record(z.string(), z.object({ comments: z.number().int(), likes: z.number().int() }));
export type PostStats = z.infer<typeof PostStats>;
