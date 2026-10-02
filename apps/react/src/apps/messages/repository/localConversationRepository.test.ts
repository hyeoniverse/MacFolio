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

const input = (text: string) => ({ text });
const NAME = /^\S+ .+ \S+$/;

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
		expect(posted).toMatchObject({ text: '반가워요', mine: true });
		if (posted === 'not-found') throw new Error('unexpected');
		expect(posted.nickname).toMatch(NAME);
		expect(posted.nickname).toBe(await repo.myName());
		expect(await repo.listThreads()).toHaveLength(1);
	});

	it('쓰기로 남긴 피드백마다 항목이 생기고, 한 사람이 여러 개 남길 수 있다', async () => {
		const repo = createLocalConversationRepository('visitor-a', memoryStorage());
		const first = await repo.createThread(input('디자인이 예뻐요'));
		expect(first.thread).toMatchObject({ title: await repo.myName(), mine: true, summary: '디자인이 예뻐요' });
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

		const { thread } = await a.createThread(input('모바일에서 깨져요'));
		clock = new Date('2026-09-28T02:00:00Z');
		await b.postMessage(thread.id, input('저도 그래요'));

		// 이름은 브라우저 id로 정한다: 같은 id면 같은 이름, 다른 id면 (거의 늘) 다른 이름
		expect(await createLocalConversationRepository('visitor-a', memoryStorage()).myName()).toBe(await a.myName());
		expect((await a.listMessages(thread.id)).map((m) => [m.nickname, m.mine])).toEqual([
			[await a.myName(), true],
			[await b.myName(), false],
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

	it('같은 브라우저에서 쓴 글만 지우고, 저장소에는 브라우저 id가 평문으로 남지 않는다', async () => {
		const storage = memoryStorage();
		const repo = createLocalConversationRepository('visitor-secret-id', storage);
		const other = createLocalConversationRepository('visitor-other', storage);
		const posted = await repo.postMessage(PINNED_THREAD_ID, input('지울 글'));
		if (posted === 'not-found') throw new Error('unexpected');

		expect(storage.data.get(STORAGE_KEY)!).not.toContain('visitor-secret-id');
		expect(await other.removeMessage(posted.id)).toBe('not-mine');
		expect(await repo.removeMessage(posted.id)).toBe('deleted');
		expect(await repo.removeMessage(posted.id)).toBe('not-found');
	});

	it('사이트 주인의 안내 글은 저장소에 없어서 지울 수 없다', async () => {
		const repo = createLocalConversationRepository('visitor-a', memoryStorage());
		expect(await repo.removeMessage('owner-1')).toBe('not-found');
	});

	it('저장된 값이 깨져 있으면 빈 상태로 시작한다', async () => {
		const storage = memoryStorage();
		storage.setItem(STORAGE_KEY, '{broken');
		expect(await createLocalConversationRepository('visitor-a', storage).listThreads()).toHaveLength(1);
	});
});
