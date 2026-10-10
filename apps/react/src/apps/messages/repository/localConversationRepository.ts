import { visitorName, type Message, type MessageInput, type Thread } from '../conversations';
import type { ConversationRepository } from './types';
import { pinnedMessages, pinnedThread, PINNED_THREAD_ID, withPinnedIntro } from './pinned';

// 서버가 없을 때 브라우저에만 저장하는 구현. 브라우저 id로 사람을 구분하고 이름도 정한다.
// 저장소에는 브라우저 id 대신 해시만 남긴다 (서버의 방문자 해시와 같은 역할).
/** 저장 형식 버전이 바뀌면 키를 바꾼다. 예전 키의 데이터는 index.ts에서 지운다 */
export const STORAGE_KEY = 'macfolio:messages:v2';
export { PINNED_THREAD_ID };

interface StoredThread {
	id: string;
	ownerId: string;
	title: string;
	createdAt: string;
}

/** 예전(이름·비밀번호) 형식의 글에는 salt·passwordHash가 남아 있을 수 있다. 읽기만 하고 쓰지 않는다 */
interface StoredMessage {
	id: string;
	threadId: string;
	text: string;
	createdAt: string;
	authorId: string;
	nickname: string;
	fromOwner: boolean;
}

interface StoredData {
	threads: StoredThread[];
	messages: StoredMessage[];
}

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

async function sha256(value: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * @param visitorId 이 브라우저를 구분하는 id. 서버 구현에서는 방문자 쿠키가 이 역할을 한다.
 */
export function createLocalConversationRepository(
	visitorId: string,
	storage: KeyValueStorage = localStorage,
	now: () => Date = () => new Date()
): ConversationRepository {
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

	const newMessage = (threadId: string, input: MessageInput, me: string): StoredMessage => ({
		id: crypto.randomUUID(),
		threadId,
		text: input.text,
		createdAt: now().toISOString(),
		authorId: me,
		nickname: visitorName(me),
		fromOwner: false,
	});

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
			mine: thread.ownerId === me,
			summary: own[0]?.text,
			lastMessage: last && { text: last.text, createdAt: last.createdAt },
		};
	};

	return {
		async myName() {
			return visitorName(await authorIdPromise);
		},

		async listThreads() {
			const me = await authorIdPromise;
			const { threads, messages } = read();
			const replies = messages.filter((m) => m.threadId === PINNED_THREAD_ID);
			return [withPinnedIntro(pinnedThread(), replies), ...threads.map((thread) => toThread(thread, messages, me))];
		},

		async listMessages(threadId) {
			const me = await authorIdPromise;
			const stored = read()
				.messages.filter((m) => m.threadId === threadId)
				.map((message) => toMessage(message, me));
			return threadId === PINNED_THREAD_ID ? [...pinnedMessages(), ...stored] : stored;
		},

		async createThread(input) {
			const me = await authorIdPromise;
			const data = read();
			const thread: StoredThread = {
				id: crypto.randomUUID(),
				ownerId: me,
				title: visitorName(me),
				createdAt: now().toISOString(),
			};
			const message = newMessage(thread.id, input, me);
			const next = { threads: [...data.threads, thread], messages: [...data.messages, message] };
			write(next);
			return { thread: toThread(thread, next.messages, me), message: toMessage(message, me) };
		},

		async postMessage(threadId, input) {
			const me = await authorIdPromise;
			const data = read();
			if (threadId !== PINNED_THREAD_ID && !data.threads.some((t) => t.id === threadId)) return 'not-found';
			const message = newMessage(threadId, input, me);
			write({ ...data, messages: [...data.messages, message] });
			return toMessage(message, me);
		},

		async removeMessage(messageId) {
			const me = await authorIdPromise;
			const data = read();
			const message = data.messages.find((m) => m.id === messageId);
			// 사이트 주인의 안내 글은 저장소에 없다
			if (!message) return 'not-found';
			if (message.authorId !== me) return 'not-mine';
			write({ ...data, messages: data.messages.filter((m) => m.id !== messageId) });
			return 'deleted';
		},
	};
}
