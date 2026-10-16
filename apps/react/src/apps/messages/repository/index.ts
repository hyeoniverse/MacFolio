import { env } from '@/shared/config/env';
import { readString, STORAGE_KEYS, writeString } from '@/shared/lib/storage';
import { createApiConversationRepository } from './apiConversationRepository';
import { createLocalConversationRepository } from './localConversationRepository';
import type { ConversationRepository } from './types';

export type { ConversationRepository, DeleteResult } from './types';
export { PINNED_THREAD_ID } from './pinned';

/** 로컬 저장소에서 사람을 구분하는 브라우저 id. 서버는 방문자 쿠키로 구분한다. 저장하지 못하면 이번 방문만의 id */
function visitorId(): string {
	const saved = readString(STORAGE_KEYS.messagesVisitor);
	if (saved) return saved;
	const created = crypto.randomUUID();
	writeString(STORAGE_KEYS.messagesVisitor, created);
	return created;
}

let repository: ConversationRepository | null = null;

/** VITE_MESSAGES_STORE=local이면 이 브라우저(localStorage)에, 아니면 서버에 저장한다 (env.messagesStore) */
export function getConversationRepository(): ConversationRepository {
	if (!repository) {
		repository =
			env.messagesStore === 'local'
				? createLocalConversationRepository(visitorId())
				: createApiConversationRepository(env.apiUrl);
	}
	return repository;
}
