import { createLocalConversationRepository } from './localConversationRepository';
import type { ConversationRepository } from './types';

export type { ConversationRepository, DeleteResult, ThreadAccess } from './types';
export { PINNED_THREAD_ID } from './localConversationRepository';

let repository: ConversationRepository | null = null;

/** 지금은 localStorage 저장소를 쓴다. API 서버(#9)가 생기면 여기서 구현체를 고른다. */
export function getConversationRepository(): ConversationRepository {
	repository ??= createLocalConversationRepository();
	return repository;
}
