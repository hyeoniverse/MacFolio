// 대화 저장소 인터페이스. 구현체(localStorage, 이후 API 서버 #9)를 바꿔 끼울 수 있다.
import type { Message, NewThreadInput, Thread } from '../conversations';

export type DeleteResult = 'deleted' | 'wrong-password' | 'not-found';

/** 대화를 시작한 브라우저가 가진 작성 권한. 토큰은 서버에 해시로만 저장된다. */
export interface ThreadAccess {
	threadId: string;
	token: string;
}

export interface ConversationRepository {
	/** 고정 대화 + 모든 방문자 대화 (공개) */
	listThreads(): Promise<Thread[]>;
	listMessages(threadId: string): Promise<Message[]>;
	/** 입력은 이미 검증된 값이다 (conversations.validateNewThread) */
	createThread(input: NewThreadInput): Promise<{ thread: Thread; message: Message; access: ThreadAccess }>;
	/** 토큰이 맞아야 자기 대화에 이어서 쓸 수 있다 */
	postMessage(access: ThreadAccess, text: string): Promise<Message | 'forbidden'>;
	/** 대화를 시작할 때 정한 비밀번호로 방문자 메시지를 지운다 (다른 기기에서도 가능) */
	removeMessage(messageId: string, password: string): Promise<DeleteResult>;
}
