import { env } from '@/shared/config/env';
import { createApiConversationRepository } from './apiConversationRepository';
import { createLocalConversationRepository } from './localConversationRepository';
import type { ConversationRepository } from './types';

export type { ConversationRepository, DeleteResult } from './types';
export { PINNED_THREAD_ID } from './pinned';

const VISITOR_KEY = 'macfolio:messages:visitor';

/** 로컬 저장소에서 사람을 구분하는 브라우저 id. 서버는 방문자 쿠키로 구분한다. */
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
const LEGACY_KEYS = ['macfolio:messages', 'macfolio:messages:access', 'macfolio:messages:nickname'];

function removeLegacyData() {
	try {
		LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
	} catch {
		// 지우지 못해도 새 형식은 다른 키를 쓰므로 영향이 없다
	}
}

let repository: ConversationRepository | null = null;

/** VITE_MESSAGES_STORE=local이면 이 브라우저(localStorage)에, 아니면 서버에 저장한다 (env.messagesStore) */
export function getConversationRepository(): ConversationRepository {
	if (!repository) {
		removeLegacyData();
		repository =
			env.messagesStore === 'local'
				? createLocalConversationRepository(visitorId())
				: createApiConversationRepository(env.apiUrl);
	}
	return repository;
}
