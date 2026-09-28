// 메시지 저장소 인터페이스. 구현체(localStorage, 이후 API 서버 #9)를 바꿔 끼울 수 있다.
import type { Message, MessageInput, Thread } from '../conversations';

export type DeleteResult = 'deleted' | 'wrong-password' | 'not-found';

/**
 * 사람 구분은 저장소가 한다. 서버는 요청 IP(해시), 로컬은 브라우저 id로 구분하고
 * 결과에 mine(보고 있는 사람의 글·방인지)을 채워 돌려준다.
 */
export interface ConversationRepository {
	/** 고정 방(사이트 주인) + 방문자 방 */
	listThreads(): Promise<Thread[]>;
	listMessages(threadId: string): Promise<Message[]>;
	/**
	 * 누구나 어느 방에나 쓸 수 있다. 입력은 이미 검증된 값이다 (conversations.validateMessageInput).
	 * 글쓴이의 방이 아직 없으면 새로 만들어 createdThread로 돌려준다.
	 */
	postMessage(
		threadId: string,
		input: MessageInput
	): Promise<{ message: Message; createdThread?: Thread } | 'not-found'>;
	/** 글을 쓸 때 정한 비밀번호로 지운다 */
	removeMessage(messageId: string, password: string): Promise<DeleteResult>;
}
