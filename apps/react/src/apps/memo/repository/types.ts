// Memo 저장소 인터페이스. 구현체(localStorage, 이후 API 서버)를 바꿔 끼울 수 있다.

/** 저장소에 저장되는 메모. id는 저장소의 key다. */
export interface MemoRecord {
	title: string;
	content: string;
	password?: string;
	folder_id: string;
	created_at: string;
}

export interface MemoSnapshot {
	/** 폴더 id → 폴더 이름 */
	folders: Record<string, string>;
	/** 메모 id → 메모 */
	memos: Record<string, MemoRecord>;
}

export type DeleteResult = 'deleted' | 'wrong-password' | 'not-found';

export interface MemoRepository {
	load(): Promise<MemoSnapshot>;
	/** 새 메모를 저장하고 id를 돌려준다. */
	create(memo: MemoRecord): Promise<string>;
	remove(id: string, password: string): Promise<DeleteResult>;
}
