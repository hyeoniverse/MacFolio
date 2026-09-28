import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	sortThreads,
	validateMessage,
	validateNewThread,
	type InputErrors,
	type Message,
	type NewThreadInput,
	type Thread,
} from './conversations';
import { getConversationRepository, PINNED_THREAD_ID, type DeleteResult, type ThreadAccess } from './repository';

/** 이 브라우저가 시작한 대화의 작성 권한 */
const ACCESS_KEY = 'macfolio:messages:access';

function loadAccess(): ThreadAccess | null {
	try {
		return JSON.parse(localStorage.getItem(ACCESS_KEY) ?? 'null') as ThreadAccess | null;
	} catch {
		return null;
	}
}

function saveAccess(access: ThreadAccess) {
	try {
		localStorage.setItem(ACCESS_KEY, JSON.stringify(access));
	} catch {
		// 저장하지 못하면 이번 방문 동안만 이어 쓸 수 있다
	}
}

/** 새 대화를 쓰는 화면 */
export const NEW_THREAD = 'new';

export function useConversations() {
	const repository = getConversationRepository();
	const [access, setAccess] = useState<ThreadAccess | null>(loadAccess);
	const [threads, setThreads] = useState<Thread[]>([]);
	const [selectedId, setSelectedId] = useState<string>(() => loadAccess()?.threadId ?? PINNED_THREAD_ID);
	const [messages, setMessages] = useState<Message[]>([]);
	const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

	const refreshThreads = useCallback(
		() =>
			repository
				.listThreads()
				.then((list) => {
					setThreads(sortThreads(list));
					setStatus('ready');
				})
				.catch(() => setStatus('error')),
		[repository]
	);

	useEffect(() => {
		void refreshThreads();
	}, [refreshThreads]);

	useEffect(() => {
		if (selectedId === NEW_THREAD) return;
		let cancelled = false;
		repository.listMessages(selectedId).then((list) => !cancelled && setMessages(list));
		return () => {
			cancelled = true;
		};
	}, [repository, selectedId]);

	const myThreadId = access?.threadId ?? null;

	/** 내 대화가 있으면 그 대화로, 없으면 새 대화 화면으로 */
	const openMyThread = useCallback(() => setSelectedId(myThreadId ?? NEW_THREAD), [myThreadId]);

	const startThread = useCallback(
		async (input: NewThreadInput): Promise<InputErrors> => {
			const { value, errors } = validateNewThread(input);
			if (Object.keys(errors).length > 0) return errors;
			const created = await repository.createThread(value);
			saveAccess(created.access);
			setAccess(created.access);
			setMessages([created.message]);
			setSelectedId(created.thread.id);
			await refreshThreads();
			return {};
		},
		[repository, refreshThreads]
	);

	/** 내 대화에 이어서 쓴다. 실패하면 이유를 돌려준다 */
	const send = useCallback(
		async (text: string): Promise<string | undefined> => {
			const { value, error } = validateMessage(text);
			if (error) return error;
			if (!access) return '대화를 먼저 시작해주세요.';
			const result = await repository.postMessage(access, value);
			if (result === 'forbidden') return '이 대화에 메시지를 보낼 수 없습니다.';
			setMessages((prev) => [...prev, result]);
			await refreshThreads();
		},
		[access, repository, refreshThreads]
	);

	const remove = useCallback(
		async (messageId: string, password: string): Promise<DeleteResult> => {
			const result = await repository.removeMessage(messageId, password);
			if (result === 'deleted') {
				setMessages((prev) => prev.filter((m) => m.id !== messageId));
				await refreshThreads();
			}
			return result;
		},
		[repository, refreshThreads]
	);

	const selectedThread = useMemo(() => threads.find((t) => t.id === selectedId) ?? null, [threads, selectedId]);

	return {
		threads,
		status,
		selectedId,
		selectedThread,
		messages: selectedId === NEW_THREAD ? [] : messages,
		myThreadId,
		select: setSelectedId,
		openMyThread,
		startThread,
		send,
		remove,
	};
}
