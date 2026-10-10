// 사이드바 맨 위 고정 항목: 사이트 주인의 안내. 안내 글은 여기에만 있고, 저장소에는 거기 단 답글만 있다.
// 이름은 그때의 프로필 (관리자가 시스템 설정에서 바꿀 수 있다)
import { getProfile } from '@/shared/site/profileStore';
import type { Message, Thread } from '../conversations';

export const PINNED_THREAD_ID = 'owner';
export const OWNER_AUTHOR_ID = 'owner';

export const pinnedThread = (): Thread => ({
	id: PINNED_THREAD_ID,
	title: getProfile().name,
	createdAt: '2026-09-28T00:00:00.000Z',
	pinned: true,
	mine: false,
});

export const pinnedMessages = (): Message[] => {
	const name = getProfile().name;
	return [
		{ id: 'owner-1', text: `안녕하세요, ${name}입니다 👋`, createdAt: '2026-09-28T00:00:00.000Z' },
		{
			id: 'owner-2',
			text: '포트폴리오를 보고 느낀 점, 의견, 피드백을 편하게 남겨 주세요. 왼쪽 위 쓰기 버튼으로 새 피드백을 남길 수 있어요!',
			createdAt: '2026-09-28T00:00:05.000Z',
		},
	].map((message) => ({
		...message,
		threadId: PINNED_THREAD_ID,
		authorId: OWNER_AUTHOR_ID,
		nickname: name,
		fromOwner: true,
		mine: false,
	}));
};

/** 고정 항목의 미리보기·마지막 활동: 안내 글과 답글 중 마지막 */
export function withPinnedIntro(thread: Thread, replies: { text: string; createdAt: string }[] = []): Thread {
	const intro = pinnedMessages();
	const all = [...intro, ...replies].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
	const last =
		thread.lastMessage && thread.lastMessage.createdAt > all.at(-1)!.createdAt ? thread.lastMessage : all.at(-1)!;
	return { ...thread, summary: intro[0].text, lastMessage: { text: last.text, createdAt: last.createdAt } };
}
