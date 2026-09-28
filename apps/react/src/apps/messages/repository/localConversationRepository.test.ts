import { describe, expect, it } from 'vitest';
import { createLocalConversationRepository, PINNED_THREAD_ID, STORAGE_KEY } from './localConversationRepository';

const memoryStorage = () => {
	const data = new Map<string, string>();
	return {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => void data.set(key, value),
		data,
	};
};

const input = (text: string, nickname = '민수') => ({ nickname, password: 'pw1234', text });

describe('createLocalConversationRepository', () => {
	it('처음에는 사이트 주인의 고정 안내만 있다', async () => {
		const repo = createLocalConversationRepository('visitor-a', memoryStorage());
		const threads = await repo.listThreads();
		expect(threads).toHaveLength(1);
		expect(threads[0]).toMatchObject({ id: PINNED_THREAD_ID, pinned: true, mine: false });
		expect((await repo.listMessages(PINNED_THREAD_ID)).every((m) => m.fromOwner && !m.mine)).toBe(true);
	});

	it('답글을 달아도 목록에 항목이 생기지 않는다', async () => {
		const repo = createLocalConversationRepository('visitor-a', memoryStorage());
		const posted = await repo.postMessage(PINNED_THREAD_ID, input('반가워요'));
		expect(posted).toMatchObject({ text: '반가워요', mine: true, nickname: '민수' });
		expect(await repo.listThreads()).toHaveLength(1);
	});

	it('쓰기로 남긴 피드백마다 항목이 생기고, 한 사람이 여러 개 남길 수 있다', async () => {
		const repo = createLocalConversationRepository('visitor-a', memoryStorage());
		const first = await repo.createThread(input('디자인이 예뻐요'));
		expect(first.thread).toMatchObject({ title: '민수', mine: true, summary: '디자인이 예뻐요' });
		expect(first.message).toMatchObject({ threadId: first.thread.id, mine: true });

		const second = await repo.createThread(input('음악 앱 건의가 있어요'));
		expect(second.thread.id).not.toBe(first.thread.id);
		expect(await repo.listThreads()).toHaveLength(3);
	});

	it('다른 사람의 피드백에 답글을 달 수 있고, 미리보기는 피드백 본문·시각은 마지막 활동', async () => {
		const storage = memoryStorage();
		let clock = new Date('2026-09-28T01:00:00Z');
		const a = createLocalConversationRepository('visitor-a', storage, () => clock);
		const b = createLocalConversationRepository('visitor-b', storage, () => clock);

		const { thread } = await a.createThread(input('모바일에서 깨져요', '민수'));
		clock = new Date('2026-09-28T02:00:00Z');
		await b.postMessage(thread.id, input('저도 그래요', '지영'));

		expect((await a.listMessages(thread.id)).map((m) => [m.nickname, m.mine])).toEqual([
			['민수', true],
			['지영', false],
		]);
		const listed = (await b.listThreads()).find((t) => t.id === thread.id)!;
		expect(listed).toMatchObject({
			mine: false,
			summary: '모바일에서 깨져요',
			lastMessage: { text: '저도 그래요', createdAt: '2026-09-28T02:00:00.000Z' },
		});
		// 답글만 단 지영의 항목은 생기지 않는다
		expect((await b.listThreads()).some((t) => t.mine)).toBe(false);
	});

	it('없는 피드백에는 답글을 달 수 없다', async () => {
		const repo = createLocalConversationRepository('visitor-a', memoryStorage());
		expect(await repo.postMessage('nope', input('hi'))).toBe('not-found');
	});

	it('비밀번호가 맞아야 지우고, 저장소에는 비밀번호와 브라우저 id가 평문으로 남지 않는다', async () => {
		const storage = memoryStorage();
		const repo = createLocalConversationRepository('visitor-secret-id', storage);
		const posted = await repo.postMessage(PINNED_THREAD_ID, input('지울 글'));
		if (posted === 'not-found') throw new Error('unexpected');

		const raw = storage.data.get(STORAGE_KEY)!;
		expect(raw).not.toContain('pw1234');
		expect(raw).not.toContain('visitor-secret-id');

		expect(await repo.removeMessage(posted.id, 'wrong')).toBe('wrong-password');
		expect(await repo.removeMessage(posted.id, 'pw1234')).toBe('deleted');
		expect(await repo.removeMessage(posted.id, 'pw1234')).toBe('not-found');
	});

	it('사이트 주인의 글은 지울 수 없다', async () => {
		const repo = createLocalConversationRepository('visitor-a', memoryStorage());
		expect(await repo.removeMessage('owner-1', '')).toBe('not-found');
	});

	it('저장된 값이 깨져 있으면 빈 상태로 시작한다', async () => {
		const storage = memoryStorage();
		storage.setItem(STORAGE_KEY, '{broken');
		expect(await createLocalConversationRepository('visitor-a', storage).listThreads()).toHaveLength(1);
	});
});
