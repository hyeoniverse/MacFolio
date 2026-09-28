import { OWNER_NAME, type Message, type Thread } from '../conversations';
import type { ConversationRepository, ThreadAccess } from './types';

// 브라우저에만 저장하는 구현. 비밀번호와 토큰은 로컬에서도 평문으로 두지 않고 해시로 저장한다.
export const STORAGE_KEY = 'macfolio:messages';

interface StoredThread extends Thread {
	salt: string;
	passwordHash: string;
	tokenHash: string;
}

interface StoredData {
	threads: StoredThread[];
	messages: Message[];
}

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const PINNED_THREAD_ID = 'owner';

/** 사이드바 맨 위 고정 대화: 주인 소개 (읽기 전용) */
const PINNED_THREAD: Thread = {
	id: PINNED_THREAD_ID,
	title: OWNER_NAME,
	createdAt: '2026-09-28T00:00:00.000Z',
	pinned: true,
};
const PINNED_MESSAGES: Message[] = [
	{ id: 'owner-1', text: '안녕하세요, 김정현입니다 👋', createdAt: '2026-09-28T00:00:00.000Z' },
	{
		id: 'owner-2',
		text: '방문해 주셔서 감사해요. 궁금한 점이나 하고 싶은 말을 남겨 주시면 답장드릴게요!',
		createdAt: '2026-09-28T00:00:05.000Z',
	},
].map((message) => ({ ...message, threadId: PINNED_THREAD_ID, fromOwner: true }));

async function sha256(value: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const lastMessageOf = (messages: Message[], threadId: string) => {
	const last = messages
		.filter((m) => m.threadId === threadId)
		.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
		.at(-1);
	return last && { text: last.text, createdAt: last.createdAt };
};

const toPublic = ({ salt: _salt, passwordHash: _password, tokenHash: _token, ...thread }: StoredThread): Thread =>
	thread;

export function createLocalConversationRepository(
	storage: KeyValueStorage = localStorage,
	now: () => Date = () => new Date()
): ConversationRepository {
	const read = (): StoredData => {
		try {
			const data = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null') as StoredData | null;
			return data && Array.isArray(data.threads) && Array.isArray(data.messages) ? data : { threads: [], messages: [] };
		} catch {
			return { threads: [], messages: [] };
		}
	};
	const write = (data: StoredData) => {
		try {
			storage.setItem(STORAGE_KEY, JSON.stringify(data));
		} catch {
			// 저장하지 못해도 이번 화면에서는 보인다
		}
	};
	const newMessage = (threadId: string, text: string): Message => ({
		id: crypto.randomUUID(),
		threadId,
		text,
		createdAt: now().toISOString(),
		fromOwner: false,
	});
	const hasAccess = async (thread: StoredThread | undefined, token: string) =>
		!!thread && (await sha256(`${thread.salt}:token:${token}`)) === thread.tokenHash;

	return {
		async listThreads() {
			const { threads, messages } = read();
			return [
				{ ...PINNED_THREAD, lastMessage: lastMessageOf(PINNED_MESSAGES, PINNED_THREAD_ID) },
				...threads.map((thread) => ({ ...toPublic(thread), lastMessage: lastMessageOf(messages, thread.id) })),
			];
		},

		async listMessages(threadId) {
			if (threadId === PINNED_THREAD_ID) return PINNED_MESSAGES;
			return read().messages.filter((message) => message.threadId === threadId);
		},

		async createThread({ nickname, password, text }) {
			const salt = crypto.randomUUID();
			const token = crypto.randomUUID();
			const thread: StoredThread = {
				id: crypto.randomUUID(),
				title: nickname,
				createdAt: now().toISOString(),
				salt,
				passwordHash: await sha256(`${salt}:password:${password}`),
				tokenHash: await sha256(`${salt}:token:${token}`),
			};
			const message = newMessage(thread.id, text);
			const data = read();
			write({ threads: [...data.threads, thread], messages: [...data.messages, message] });
			return { thread: toPublic(thread), message, access: { threadId: thread.id, token } };
		},

		async postMessage({ threadId, token }: ThreadAccess, text) {
			const data = read();
			if (
				!(await hasAccess(
					data.threads.find((t) => t.id === threadId),
					token
				))
			)
				return 'forbidden';
			const message = newMessage(threadId, text);
			write({ ...data, messages: [...data.messages, message] });
			return message;
		},

		async removeMessage(messageId, password) {
			const data = read();
			const message = data.messages.find((m) => m.id === messageId);
			const thread = message && data.threads.find((t) => t.id === message.threadId);
			// 주인 글과 고정 대화는 방문자가 지울 수 없다
			if (!message || !thread || message.fromOwner) return 'not-found';
			if ((await sha256(`${thread.salt}:password:${password}`)) !== thread.passwordHash) return 'wrong-password';
			write({ ...data, messages: data.messages.filter((m) => m.id !== messageId) });
			return 'deleted';
		},
	};
}
