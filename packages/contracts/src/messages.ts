// 메시지 앱 (apps/api의 /messages). 쓰기 단추로 남긴 피드백 하나가 목록의 항목(Thread) 하나가 되고, 말풍선(Message)은 거기 단 글이다.
// 사람은 브라우저로 구분한다(방문자 쿠키). 이름·비밀번호를 따로 받지 않으므로 요청 몸통은 댓글과 같다
import { z } from 'zod';
import { CommentInput } from './comments.js';

/** 사이트 주인의 고정 안내 항목. 안내 글은 화면에 있고, 서버에는 거기 단 답글(threadId가 빈 글)만 있다 */
export const PINNED_THREAD_ID = 'owner';

/** 새 피드백·답글 요청 몸통. 댓글과 같은 규칙(1~500자, 사람 확인 토큰) */
export const MessageInput = CommentInput;
export type MessageInput = z.infer<typeof MessageInput>;

/** 말풍선 하나. 방문자 해시는 내보내지 않고, 같은 사람을 묶는 불투명한 authorId만 */
export const Message = z.object({
	id: z.string(),
	/** 주인 안내에 단 답글은 PINNED_THREAD_ID */
	threadId: z.string(),
	text: z.string(),
	/** ISO 8601 */
	createdAt: z.string(),
	/** 같은 사람의 말풍선을 묶는 값 (주인은 'owner', 방문자는 해시의 일부) */
	authorId: z.string(),
	nickname: z.string(),
	/** IP 앞 두 자리 (주인 글과 로컬 저장소에는 없음) */
	ipPrefix: z.string().optional(),
	fromOwner: z.boolean(),
	/** 보고 있는 브라우저가 쓴 글 (오른쪽 말풍선, 지우기 단추) */
	mine: z.boolean(),
});
export type Message = z.infer<typeof Message>;

/** 목록의 항목 하나: 피드백 하나와 그 답글들 (고정 항목은 사이트 주인의 안내) */
export const Thread = z.object({
	id: z.string(),
	/** 피드백을 남긴 사람의 이름 (고정 항목은 사이트 주인) */
	title: z.string(),
	/** 남긴 사람 IP의 앞 두 자리 (예: "211.234") */
	ipPrefix: z.string().optional(),
	createdAt: z.string(),
	/** 사이드바 맨 위에 고정되는 사이트 주인의 안내 */
	pinned: z.boolean().optional(),
	/** 보고 있는 브라우저가 남긴 피드백인지 */
	mine: z.boolean(),
	/** 피드백 본문 (첫 말풍선). 목록 미리보기에 쓴다 */
	summary: z.string().optional(),
	/** 마지막 활동 (목록 정렬과 시각 표시) */
	lastMessage: z.object({ text: z.string(), createdAt: z.string() }).optional(),
});
export type Thread = z.infer<typeof Thread>;

/** POST /messages/threads의 응답: 새 항목과 그 첫 말풍선 */
export const ThreadCreated = z.object({ thread: Thread, message: Message });
export type ThreadCreated = z.infer<typeof ThreadCreated>;
