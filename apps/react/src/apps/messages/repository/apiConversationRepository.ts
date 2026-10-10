import type { Message, Thread } from '../conversations';
import { apiFetch, type ApiOptions, reasonsOf, UNREACHABLE } from '@/shared/api/client';
import { fetchVisitorName } from '@/shared/lib/visitor';
import type { ConversationRepository } from './types';
import { pinnedMessages, PINNED_THREAD_ID, withPinnedIntro } from './pinned';

// 서버(apps/api의 /messages)에 저장하는 구현. 사람 구분과 이름은 서버가 방문자 쿠키로 정한다.

/** 실패한 요청의 이유 (서버가 보낸 문구, 없으면 일반 문구) */
const failure = async (response: Response) =>
	new Error((await reasonsOf(response, '서버에서 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.'))[0]);

export { UNREACHABLE };

export function createApiConversationRepository(
	apiUrl: string,
	fetchImpl: typeof fetch = fetch
): ConversationRepository {
	/** 서버에 닿지 못하면 UNREACHABLE 문구의 Error (ApiError도 Error라 화면이 message를 그대로 보여 준다) */
	const call = (path: string, options: Omit<ApiOptions, 'apiUrl' | 'fetchImpl'> = {}) =>
		apiFetch(`/messages${path}`, { ...options, apiUrl, fetchImpl });

	return {
		async myName() {
			const name = apiUrl ? await fetchVisitorName(apiUrl, fetchImpl) : null;
			if (!name) throw new Error(UNREACHABLE);
			return name;
		},

		async listThreads() {
			const response = await call('/threads');
			if (!response.ok) throw await failure(response);
			const threads = (await response.json()) as Thread[];
			return threads.map((thread) => (thread.id === PINNED_THREAD_ID ? withPinnedIntro(thread) : thread));
		},

		async listMessages(threadId) {
			const response = await call(`/threads/${encodeURIComponent(threadId)}`);
			if (response.status === 404) return [];
			if (!response.ok) throw await failure(response);
			const messages = (await response.json()) as Message[];
			return threadId === PINNED_THREAD_ID ? [...pinnedMessages(), ...messages] : messages;
		},

		async createThread(input) {
			const response = await call('/threads', {
				method: 'POST',
				json: { body: input.text, turnstileToken: input.turnstileToken },
			});
			if (!response.ok) throw await failure(response);
			return (await response.json()) as { thread: Thread; message: Message };
		},

		async postMessage(threadId, input) {
			const response = await call(`/threads/${encodeURIComponent(threadId)}`, {
				method: 'POST',
				json: { body: input.text, turnstileToken: input.turnstileToken },
			});
			if (response.status === 404) return 'not-found';
			if (!response.ok) throw await failure(response);
			return (await response.json()) as Message;
		},

		async removeMessage(messageId) {
			try {
				const response = await call(`/${encodeURIComponent(messageId)}`, { method: 'DELETE' });
				if (response.ok) return 'deleted';
				if (response.status === 403) return 'not-mine';
				if (response.status === 404) return 'not-found';
				return 'error';
			} catch {
				return 'error';
			}
		},
	};
}
