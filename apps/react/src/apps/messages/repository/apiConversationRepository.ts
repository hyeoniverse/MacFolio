import type { Message, Thread } from '../conversations';
import { fetchVisitorName } from '@/shared/lib/visitor';
import type { ConversationRepository } from './types';
import { PINNED_MESSAGES, PINNED_THREAD_ID, withPinnedIntro } from './pinned';

// 서버(apps/api의 /messages)에 저장하는 구현. 사람 구분과 이름은 서버가 방문자 쿠키로 정한다.

/** 실패한 요청의 이유 (서버가 보낸 문구, 없으면 일반 문구) */
async function failure(response: Response): Promise<Error> {
	if (response.status === 429) return new Error('잠시 뒤에 다시 써 주세요.');
	const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };
	const message = Array.isArray(body.message) ? body.message[0] : body.message;
	return new Error(message ?? '서버에서 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
}

/** 서버에 닿지 못했을 때 (주소가 없거나, 서버가 꺼졌거나, 네트워크가 끊김) */
export const UNREACHABLE = '서버에 연결할 수 없습니다. 잠시 뒤 다시 시도해 주세요.';

export function createApiConversationRepository(
	apiUrl: string,
	fetchImpl: typeof fetch = fetch
): ConversationRepository {
	const call = async (path: string, init?: RequestInit) => {
		if (!apiUrl) throw new Error(UNREACHABLE);
		return fetchImpl(`${apiUrl}/messages${path}`, {
			credentials: 'include',
			...init,
			headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
		}).catch(() => {
			// fetch는 'Failed to fetch' 같은 브라우저 문구로 실패한다. 화면에 보일 문구로 바꾼다
			throw new Error(UNREACHABLE);
		});
	};

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
			return threadId === PINNED_THREAD_ID ? [...PINNED_MESSAGES, ...messages] : messages;
		},

		async createThread(input) {
			const response = await call('/threads', {
				method: 'POST',
				body: JSON.stringify({ body: input.text, turnstileToken: input.turnstileToken }),
			});
			if (!response.ok) throw await failure(response);
			return (await response.json()) as { thread: Thread; message: Message };
		},

		async postMessage(threadId, input) {
			const response = await call(`/threads/${encodeURIComponent(threadId)}`, {
				method: 'POST',
				body: JSON.stringify({ body: input.text, turnstileToken: input.turnstileToken }),
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
