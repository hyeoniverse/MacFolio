import { OWNER_NAME, type Message, type MessageInput, type Thread } from '../conversations';
import type { ConversationRepository } from './types';

// 브라우저에만 저장하는 구현. IP를 알 수 없으므로 브라우저 id로 사람을 구분하고,
// 비밀번호는 로컬에서도 평문으로 두지 않고 해시로 저장한다.
/** 저장 형식 버전이 바뀌면 키를 바꾼다. 예전 키의 데이터는 index.ts에서 지운다 */
export const STORAGE_KEY = 'macfolio:messages:v2';
export const PINNED_THREAD_ID = 'owner';
const OWNER_AUTHOR_ID = 'owner';

interface StoredThread {
	id: string;
	ownerId: string;
	title: string;
	createdAt: string;
}

interface StoredMessage {
	id: string;
	threadId: string;
	text: string;
	createdAt: string;
	authorId: string;
	nickname: string;
	fromOwner: boolean;
	salt?: string;
	passwordHash?: string;
}

interface StoredData {
	threads: StoredThread[];
	messages: StoredMessage[];
}

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** 사이드바 맨 위 고정 항목: 사이트 주인의 안내 */
const PINNED_THREAD: StoredThread = {
	id: PINNED_THREAD_ID,
	ownerId: OWNER_AUTHOR_ID,
	title: OWNER_NAME,
	createdAt: '2026-09-28T00:00:00.000Z',
};
const PINNED_MESSAGES: StoredMessage[] = [
	{ id: 'owner-1', text: '안녕하세요, 김정현입니다 👋', createdAt: '2026-09-28T00:00:00.000Z' },
	{
		id: 'owner-2',
		text: '포트폴리오를 보고 느낀 점, 의견, 피드백을 편하게 남겨 주세요. 왼쪽 위 쓰기 버튼으로 새 피드백을 남길 수 있어요!',
		createdAt: '2026-09-28T00:00:05.000Z',
	},
].map((message) => ({
	...message,
	threadId: PINNED_THREAD_ID,
	authorId: OWNER_AUTHOR_ID,
	nickname: OWNER_NAME,
	fromOwner: true,
}));

async function sha256(value: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * @param visitorId 이 브라우저를 구분하는 id. 서버 구현에서는 요청 IP가 이 역할을 한다.
 */
export function createLocalConversationRepository(
	visitorId: string,
	storage: KeyValueStorage = localStorage,
	now: () => Date = () => new Date()
): ConversationRepository {
	// 저장소에는 원래 값 대신 해시만 남긴다 (서버의 IP 해시와 같은 역할)
	const authorIdPromise = sha256(`visitor:${visitorId}`).then((hash) => hash.slice(0, 16));

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

	const newMessage = async (threadId: string, input: MessageInput, me: string): Promise<StoredMessage> => {
		const salt = crypto.randomUUID();
		return {
			id: crypto.randomUUID(),
			threadId,
			text: input.text,
			createdAt: now().toISOString(),
			authorId: me,
			nickname: input.nickname,
			fromOwner: false,
			salt,
			passwordHash: await sha256(`${salt}:${input.password}`),
		};
	};

	const toMessage = (message: StoredMessage, me: string): Message => ({
		id: message.id,
		threadId: message.threadId,
		text: message.text,
		createdAt: message.createdAt,
		authorId: message.authorId,
		nickname: message.nickname,
		fromOwner: message.fromOwner,
		mine: message.authorId === me,
	});

	const toThread = (thread: StoredThread, messages: StoredMessage[], me: string): Thread => {
		const own = messages.filter((m) => m.threadId === thread.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
		const last = own.at(-1);
		return {
			id: thread.id,
			title: thread.title,
			createdAt: thread.createdAt,
			pinned: thread.id === PINNED_THREAD_ID || undefined,
			mine: thread.ownerId === me,
			summary: own[0]?.text,
			lastMessage: last && { text: last.text, createdAt: last.createdAt },
		};
	};

	return {
		async listThreads() {
			const me = await authorIdPromise;
			const { threads, messages } = read();
			const all = [...PINNED_MESSAGES, ...messages];
			return [PINNED_THREAD, ...threads].map((thread) => toThread(thread, all, me));
		},

		async listMessages(threadId) {
			const me = await authorIdPromise;
			const stored = read().messages.filter((m) => m.threadId === threadId);
			const list = threadId === PINNED_THREAD_ID ? [...PINNED_MESSAGES, ...stored] : stored;
			return list.map((message) => toMessage(message, me));
		},

		async createThread(input) {
			const me = await authorIdPromise;
			const data = read();

			const thread: StoredThread = {
				id: crypto.randomUUID(),
				ownerId: me,
				title: input.nickname,
				createdAt: now().toISOString(),
			};
			const message = await newMessage(thread.id, input, me);
			const next = { threads: [...data.threads, thread], messages: [...data.messages, message] };
			write(next);
			return { thread: toThread(thread, next.messages, me), message: toMessage(message, me) };
		},

		async postMessage(threadId, input) {
			const me = await authorIdPromise;
			const data = read();
			if (threadId !== PINNED_THREAD_ID && !data.threads.some((t) => t.id === threadId)) return 'not-found';
			const message = await newMessage(threadId, input, me);
			write({ ...data, messages: [...data.messages, message] });
			return toMessage(message, me);
		},

		async removeMessage(messageId, password) {
			const data = read();
			const message = data.messages.find((m) => m.id === messageId);
			// 사이트 주인의 글은 방문자가 지울 수 없다
			if (!message || message.fromOwner || !message.salt || !message.passwordHash) return 'not-found';
			if ((await sha256(`${message.salt}:${password}`)) !== message.passwordHash) return 'wrong-password';
			write({ ...data, messages: data.messages.filter((m) => m.id !== messageId) });
			return 'deleted';
		},
	};
}
