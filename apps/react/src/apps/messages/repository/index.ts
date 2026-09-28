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

/** 예전 저장 형식(사람별 방, 대화 토큰)의 데이터. 새 형식에서는 쓰지 않으므로 지운다 */
const LEGACY_KEYS = ['macfolio:messages', 'macfolio:messages:access'];

function removeLegacyData() {
	try {
		LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
	} catch {
		// 지우지 못해도 새 형식은 다른 키를 쓰므로 영향이 없다
	}
}

let repository: ConversationRepository | null = null;

/** 지금은 localStorage 저장소를 쓴다. API 서버(#9)가 생기면 여기서 구현체를 고른다. */
export function getConversationRepository(): ConversationRepository {
	if (!repository) {
		removeLegacyData();
		repository = createLocalConversationRepository(visitorId());
	}
	return repository;
}
