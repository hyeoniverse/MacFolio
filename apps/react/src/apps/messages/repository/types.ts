// 메시지 저장소 인터페이스. 서버(apps/api의 /messages)와 서버가 없을 때 쓰는 localStorage 구현이 있다.
import type { Message, MessageInput, Thread } from '../conversations';

export type DeleteResult = 'deleted' | 'not-mine' | 'not-found' | 'error';

/**
 * 사람 구분은 저장소가 한다. 서버는 방문자 쿠키, 로컬은 브라우저 id로 구분하고
 * 결과에 mine(보고 있는 사람의 글·방인지)을 채워 돌려준다. 이름도 저장소가 정한다.
 * 쓰기가 실패하면 이유를 담은 Error를 던진다 (화면은 그 문구를 보여 준다).
 */
export interface ConversationRepository {
	/** 이 브라우저의 이름 (예: 🦊 날쌘 여우) */
	myName(): Promise<string>;
	/** 고정 안내 + 방문자가 남긴 피드백 */
	listThreads(): Promise<Thread[]>;
	listMessages(threadId: string): Promise<Message[]>;
	/** 새 피드백을 남긴다 (쓰기 버튼). 목록에 항목이 하나 생긴다. 입력은 이미 검증된 값이다 */
	createThread(input: MessageInput): Promise<{ thread: Thread; message: Message }>;
	/** 피드백(또는 고정 안내)에 답글을 단다. 누구나 쓸 수 있고 항목은 생기지 않는다 */
	postMessage(threadId: string, input: MessageInput): Promise<Message | 'not-found'>;
	/** 지운다. 이 브라우저에서 쓴 글만 (관리자는 서버에서 무엇이든) */
	removeMessage(messageId: string): Promise<DeleteResult>;
}
