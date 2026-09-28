// 메시지 저장소 인터페이스. 구현체(localStorage, 이후 API 서버 #9)를 바꿔 끼울 수 있다.
import type { Message, MessageInput, Thread } from '../conversations';

export type DeleteResult = 'deleted' | 'wrong-password' | 'not-found';

/**
 * 사람 구분은 저장소가 한다. 서버는 요청 IP(해시), 로컬은 브라우저 id로 구분하고
 * 결과에 mine(보고 있는 사람의 글·방인지)을 채워 돌려준다.
 */
export interface ConversationRepository {
	/** 고정 안내 + 방문자가 남긴 피드백 */
	listThreads(): Promise<Thread[]>;
	listMessages(threadId: string): Promise<Message[]>;
	/** 새 피드백을 남긴다 (쓰기 버튼). 목록에 항목이 하나 생긴다. 입력은 이미 검증된 값이다 */
	createThread(input: MessageInput): Promise<{ thread: Thread; message: Message }>;
	/** 피드백(또는 고정 안내)에 답글을 단다. 누구나 쓸 수 있고 항목은 생기지 않는다 */
	postMessage(threadId: string, input: MessageInput): Promise<Message | 'not-found'>;
	/** 글을 쓸 때 정한 비밀번호로 지운다 */
	removeMessage(messageId: string, password: string): Promise<DeleteResult>;
}
