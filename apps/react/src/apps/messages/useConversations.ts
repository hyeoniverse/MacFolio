import { useCallback, useEffect, useMemo, useState } from 'react';
import { sortThreads, validateMessageInput, type InputErrors, type Message, type Thread } from './conversations';
import { getConversationRepository, PINNED_THREAD_ID, type DeleteResult } from './repository';

/** 새 피드백을 남기는 화면 (쓰기 버튼) */
export const NEW_THREAD = 'new';

export function useConversations() {
	const repository = getConversationRepository();
	const [threads, setThreads] = useState<Thread[]>([]);
	const [selectedId, setSelectedId] = useState<string>(PINNED_THREAD_ID);
	const [messages, setMessages] = useState<Message[]>([]);
	const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
	/** 이 브라우저의 이름 (저장소가 정한다: 예 🦊 날쌘 여우). 모르면 null */
	const [myName, setMyName] = useState<string | null>(null);
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
		repository.myName().then(setMyName, () => setMyName(null));
	}, [refreshThreads, repository]);

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

	/** 새 피드백을 남기거나, 보고 있는 항목에 답글을 단다. 실패하면 이유를 돌려준다 */
	const send = useCallback(
		async (text: string): Promise<InputErrors> => {
			const { value, errors } = validateMessageInput({ text });
			if (Object.keys(errors).length > 0) return errors;
			try {
				if (selectedId === NEW_THREAD) {
					const { thread, message } = await repository.createThread(value);
					if (!message.fromOwner) setMyName(message.nickname);
					setSelectedId(thread.id);
				} else {
					const result = await repository.postMessage(selectedId, value);
					if (result === 'not-found') return { text: '삭제된 피드백입니다.' };
					if (!result.fromOwner) setMyName(result.nickname);
					setMessages((prev) => [...prev, result]);
				}
			} catch (error) {
				return { text: error instanceof Error ? error.message : '보내지 못했습니다.' };
			}
			await refreshThreads();
			return {};
		},
		[repository, selectedId, refreshThreads]
	);

	const remove = useCallback(
		async (messageId: string): Promise<DeleteResult> => {
			const result = await repository.removeMessage(messageId);
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
		myName,
		select,
		back,
		compose,
		cancelNewThread,
		send,
		remove,
	};
}
