import { useCallback, useEffect, useMemo, useState } from 'react';
import { sortThreads, validateMessageInput, type InputErrors, type Message, type Thread } from './conversations';
import { getConversationRepository, PINNED_THREAD_ID, type DeleteResult } from './repository';

/** 이름은 다음 방문에도 채워 두고, 비밀번호는 저장하지 않는다 */
const NICKNAME_KEY = 'macfolio:messages:nickname';

function loadNickname(): string {
	try {
		return localStorage.getItem(NICKNAME_KEY) ?? '';
	} catch {
		return '';
	}
}

/** 새 방을 만드는 화면 (쓰기 버튼) */
export const NEW_THREAD = 'new';

export function useConversations() {
	const repository = getConversationRepository();
	const [threads, setThreads] = useState<Thread[]>([]);
	const [selectedId, setSelectedId] = useState<string>(PINNED_THREAD_ID);
	const [messages, setMessages] = useState<Message[]>([]);
	const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
	const [nickname, setNickname] = useState(loadNickname);
	const [password, setPassword] = useState('');
	/** 좁은 창에서 목록 대신 대화를 보여주는지 (넓은 창에서는 둘 다 보인다) */
	const [isChatOpen, setChatOpen] = useState(false);
	/** 새 메시지 버튼을 누를 때마다 입력창에 커서를 둔다 */
	const [focusRequest, setFocusRequest] = useState(0);
	/** 새 메시지를 취소하면 돌아갈 방 */
	const [previousId, setPreviousId] = useState<string>(PINNED_THREAD_ID);

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

	const select = useCallback((id: string) => {
		setSelectedId(id);
		setChatOpen(true);
	}, []);

	const myThreadId = useMemo(() => threads.find((t) => t.mine)?.id ?? null, [threads]);

	/** 쓰기 버튼: 내 방이 있으면 그 방을, 없으면 새 방을 만드는 화면을 연다 (한 사람당 방 하나) */
	const compose = useCallback(() => {
		if (myThreadId) select(myThreadId);
		else {
			if (selectedId !== NEW_THREAD) setPreviousId(selectedId);
			select(NEW_THREAD);
		}
		setFocusRequest((n) => n + 1);
	}, [myThreadId, selectedId, select]);

	/** 새 메시지를 그만두고 이전 방으로 돌아간다 */
	const cancelNewThread = useCallback(() => setSelectedId(previousId), [previousId]);

	/** 좁은 창에서 대화 목록으로 돌아간다 */
	const back = useCallback(() => setChatOpen(false), []);

	/** 지금 보고 있는 방에 글을 쓴다. 실패하면 필드별 이유를 돌려준다 */
	const send = useCallback(
		async (text: string): Promise<InputErrors> => {
			const { value, errors } = validateMessageInput({ nickname, password, text });
			if (Object.keys(errors).length > 0) return errors;
			if (selectedId === NEW_THREAD) {
				const result = await repository.createThread(value);
				// 다른 창에서 이미 방을 만들었다면 그 방에 이어서 쓴다
				const threadId = 'thread' in result ? result.thread.id : result.existing.id;
				if ('existing' in result) await repository.postMessage(threadId, value);
				setSelectedId(threadId);
			} else {
				const result = await repository.postMessage(selectedId, value);
				if (result === 'not-found') return { text: '대화방을 찾을 수 없습니다.' };
				setMessages((prev) => [...prev, result]);
			}
			try {
				localStorage.setItem(NICKNAME_KEY, value.nickname);
			} catch {
				// 저장하지 못해도 이번 방문 동안은 유지된다
			}
			await refreshThreads();
			return {};
		},
		[nickname, password, repository, selectedId, refreshThreads]
	);

	const remove = useCallback(
		async (messageId: string, deletePassword: string): Promise<DeleteResult> => {
			const result = await repository.removeMessage(messageId, deletePassword);
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
		isChatOpen,
		focusRequest,
		isComposing: selectedId === NEW_THREAD,
		identity: { nickname, password, setNickname, setPassword },
		select,
		back,
		compose,
		cancelNewThread,
		send,
		remove,
	};
}
