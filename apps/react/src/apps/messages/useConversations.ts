import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	sortThreads,
	validateMessageInput,
	type ComposeKind,
	type InputErrors,
	type Message,
	type Thread,
} from './conversations';
import { useProfile } from '@/shared/site/profileStore';
import { env } from '@/shared/config/env';
import { usePolling } from '@/shared/hooks/usePolling';
import { keepIfSame } from '@/shared/lib/poller';
import { useAppWindowShown } from '@/desktop/useAppWindowShown';
import { getConversationRepository, PINNED_THREAD_ID, type DeleteResult } from './repository';

/** 새 피드백을 남기는 화면 (쓰기 버튼) */
export const NEW_THREAD = 'new';

/** 보고 있는 대화의 말풍선을 다시 묻는 간격. 답글이 오가는 동안 15초 안에 보인다 */
export const MESSAGES_POLL_MS = 15_000;
/** 피드백 목록을 다시 묻는 간격. 새 피드백은 자주 생기지 않는다 */
export const THREADS_POLL_MS = 60_000;

export function useConversations() {
	const repository = getConversationRepository();
	/** 고정 항목의 이름·안내 글은 프로필에서 온다. 바뀌면(앱을 연 뒤 서버의 프로필이 도착하면) 다시 읽는다 */
	const ownerName = useProfile().name;
	const [threads, setThreads] = useState<Thread[]>([]);
	const [selectedId, setSelectedId] = useState<string>(PINNED_THREAD_ID);
	const [messages, setMessages] = useState<Message[]>([]);
	/** 처음 불러오기의 결과. error면 앱을 열 수 없다 (열어 둔 뒤의 실패는 보내기 에러로만 보인다) */
	const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
	/** 이 브라우저의 이름 (저장소가 정한다: 예 🦊 날쌘 여우). 모르면 null */
	const [myName, setMyName] = useState<string | null>(null);
	/** 좁은 창에서 목록 대신 대화를 보여주는지 (넓은 창에서는 둘 다 보인다) */
	const [isChatOpen, setChatOpen] = useState(false);
	/** 쓰기 버튼을 누를 때마다 입력창에 커서를 둔다 */
	const [focusRequest, setFocusRequest] = useState(0);
	/** 새 피드백 화면을 연 경로: 쓰기 버튼이면 feedback, 도움말 › 문제 알리기면 issue (안내 문구가 다르다) */
	const [composeKind, setComposeKind] = useState<ComposeKind>('feedback');
	/** 새 피드백을 취소하면 돌아갈 항목 */
	const [previousId, setPreviousId] = useState<string>(PINNED_THREAD_ID);

	// 서버에 저장할 때만 주기적으로 다시 묻는다. 로컬 저장소 모드는 이 브라우저만 쓰므로 바뀌지 않는다 (열 때 한 번).
	// 창을 닫거나 최소화했거나 탭이 숨으면 묻지 않는다
	const shown = useAppWindowShown('messages');
	const repeat = env.messagesStore !== 'local';

	/** 이 화면에서 말풍선을 더하거나 지운 시각. 그보다 먼저 보낸 조회의 응답은 말풍선을 덮지 않는다 */
	const messagesEditedAt = useRef(0);

	const refreshThreads = useCallback(
		() =>
			repository.listThreads().then(
				(list) => {
					setThreads((prev) => keepIfSame(prev, sortThreads(list)));
					setStatus('ready');
				},
				(error: unknown) => {
					setStatus((prev) => (prev === 'loading' ? 'error' : prev));
					throw error;
				}
			),
		[repository]
	);

	// 피드백 목록: 1분마다. 프로필(주인 이름)이 바뀌면 고정 항목을 다시 읽는다
	usePolling(() => refreshThreads(), { intervalMs: THREADS_POLL_MS, active: shown, resetKey: ownerName, repeat });

	useEffect(() => {
		repository.myName().then(setMyName, () => setMyName(null));
	}, [repository, ownerName]);

	// 보고 있는 대화의 말풍선: 15초마다. 다른 항목을 고르면 바로 묻는다. 새 피드백 화면에서는 묻지 않는다.
	// 서버가 잠깐 끊기면 보던 말풍선을 그대로 둔다
	usePolling(
		(isCurrent) => {
			// 새 피드백 화면으로 넘어가는 순간(조건이 바뀌어 꺼지기 전)에 불려도 묻지 않는다
			if (selectedId === NEW_THREAD) return Promise.resolve();
			const askedAt = Date.now();
			return repository.listMessages(selectedId).then((list) => {
				if (!isCurrent() || askedAt < messagesEditedAt.current) return;
				setMessages((prev) => keepIfSame(prev, list));
			});
		},
		{
			intervalMs: MESSAGES_POLL_MS,
			active: shown && selectedId !== NEW_THREAD,
			resetKey: `${selectedId}|${ownerName}`,
			repeat,
		}
	);

	const select = useCallback((id: string) => {
		setSelectedId(id);
		setChatOpen(true);
	}, []);

	/** 쓰기 버튼(또는 도움말 › 문제 알리기): 새 피드백을 남기는 화면을 열고 입력 칸에 커서를 둔다 */
	const compose = useCallback(
		(kind: ComposeKind = 'feedback') => {
			if (selectedId !== NEW_THREAD) setPreviousId(selectedId);
			select(NEW_THREAD);
			setComposeKind(kind);
			setFocusRequest((n) => n + 1);
		},
		[selectedId, select]
	);

	/** 새 피드백을 그만두고 보던 항목으로 돌아간다 */
	const cancelNewThread = useCallback(() => setSelectedId(previousId), [previousId]);

	/** 좁은 창에서 대화 목록으로 돌아간다 */
	const back = useCallback(() => setChatOpen(false), []);

	/** 새 피드백을 남기거나, 보고 있는 항목에 답글을 단다. 실패하면 이유를 돌려준다. turnstileToken: 사람 확인을 켰을 때 */
	const send = useCallback(
		async (text: string, turnstileToken?: string): Promise<InputErrors> => {
			const checked = validateMessageInput({ text });
			if (Object.keys(checked.errors).length > 0) return checked.errors;
			const value = { ...checked.value, turnstileToken };
			try {
				if (selectedId === NEW_THREAD) {
					const { thread, message } = await repository.createThread(value);
					if (!message.fromOwner) setMyName(message.nickname);
					setSelectedId(thread.id);
				} else {
					const result = await repository.postMessage(selectedId, value);
					if (result === 'not-found') return { text: '삭제된 피드백입니다.' };
					if (!result.fromOwner) setMyName(result.nickname);
					messagesEditedAt.current = Date.now();
					setMessages((prev) => [...prev, result]);
				}
			} catch (error) {
				return { text: error instanceof Error ? error.message : '보내지 못했습니다.' };
			}
			await refreshThreads().catch(() => undefined);
			return {};
		},
		[repository, selectedId, refreshThreads]
	);

	const remove = useCallback(
		async (messageId: string): Promise<DeleteResult> => {
			const result = await repository.removeMessage(messageId);
			if (result === 'deleted') {
				messagesEditedAt.current = Date.now();
				setMessages((prev) => prev.filter((m) => m.id !== messageId));
				await refreshThreads().catch(() => undefined);
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
		composeKind,
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
