// 방명록 저장소 인터페이스. 구현체(localStorage, 이후 API 서버 #9)를 바꿔 끼울 수 있다.
import type { GuestbookEntry, GuestbookInput } from '../guestbook';

export type DeleteResult = 'deleted' | 'wrong-password' | 'not-found';

export interface GuestbookRepository {
	list(): Promise<GuestbookEntry[]>;
	/** 입력은 이미 검증된 값이다 (guestbook.validateInput) */
	create(input: GuestbookInput): Promise<GuestbookEntry>;
	remove(id: string, password: string): Promise<DeleteResult>;
}
