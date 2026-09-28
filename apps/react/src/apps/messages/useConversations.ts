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

/** 새 피드백을 남기는 화면 (쓰기 버튼) */
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
	/** 쓰기 버튼을 누를 때마다 입력창에 커서를 둔다 */
	const [focusRequest, setFocusRequest] = useState(0);
	/** 새 피드백을 취소하면 돌아갈 항목 */
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

	/** 쓰기 버튼: 새 피드백을 남기는 화면을 연다 */
	const compose = useCallback(() => {
		if (selectedId !== NEW_THREAD) setPreviousId(selectedId);
		select(NEW_THREAD);
		setFocusRequest((n) => n + 1);
	}, [selectedId, select]);

	/** 새 피드백을 그만두고 보던 항목으로 돌아간다 */
	const cancelNewThread = useCallback(() => setSelectedId(previousId), [previousId]);

	/** 좁은 창에서 대화 목록으로 돌아간다 */
	const back = useCallback(() => setChatOpen(false), []);

	/** 새 피드백을 남기거나, 보고 있는 항목에 답글을 단다. 실패하면 필드별 이유를 돌려준다 */
	const send = useCallback(
		async (text: string): Promise<InputErrors> => {
			const { value, errors } = validateMessageInput({ nickname, password, text });
			if (Object.keys(errors).length > 0) return errors;
			if (selectedId === NEW_THREAD) {
				const { thread } = await repository.createThread(value);
				setSelectedId(thread.id);
			} else {
				const result = await repository.postMessage(selectedId, value);
				if (result === 'not-found') return { text: '삭제된 피드백입니다.' };
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
