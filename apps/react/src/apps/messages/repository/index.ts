import { createLocalConversationRepository } from './localConversationRepository';
import type { ConversationRepository } from './types';

export type { ConversationRepository, DeleteResult } from './types';
export { PINNED_THREAD_ID } from './localConversationRepository';

const VISITOR_KEY = 'macfolio:messages:visitor';

/** 로컬 저장소에서 사람을 구분하는 브라우저 id. 서버(#9)에서는 요청 IP로 구분한다. */
function visitorId(): string {
	try {
		const saved = localStorage.getItem(VISITOR_KEY);
		if (saved) return saved;
		const created = crypto.randomUUID();
		localStorage.setItem(VISITOR_KEY, created);
		return created;
	} catch {
		return crypto.randomUUID();
	}
}

let repository: ConversationRepository | null = null;

/** 지금은 localStorage 저장소를 쓴다. API 서버(#9)가 생기면 여기서 구현체를 고른다. */
export function getConversationRepository(): ConversationRepository {
	repository ??= createLocalConversationRepository(visitorId());
	return repository;
}
