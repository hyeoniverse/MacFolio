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
	it('처음에는 사이트 주인의 고정 방만 있다', async () => {
		const repo = createLocalConversationRepository('visitor-a', memoryStorage());
		const threads = await repo.listThreads();
		expect(threads).toHaveLength(1);
		expect(threads[0]).toMatchObject({ id: PINNED_THREAD_ID, pinned: true, mine: false });
		expect((await repo.listMessages(PINNED_THREAD_ID)).every((m) => m.fromOwner && !m.mine)).toBe(true);
	});

	it('글을 써도 방은 생기지 않는다', async () => {
		const repo = createLocalConversationRepository('visitor-a', memoryStorage());
		const posted = await repo.postMessage(PINNED_THREAD_ID, input('반가워요'));
		expect(posted).toMatchObject({ text: '반가워요', mine: true, nickname: '민수' });
		expect(await repo.listThreads()).toHaveLength(1);
	});

	it('쓰기로 새 방을 만들면 첫 글과 함께 생기고, 한 사람당 하나만 만들 수 있다', async () => {
		const repo = createLocalConversationRepository('visitor-a', memoryStorage());
		const created = await repo.createThread(input('내 방 첫 글'));
		if (!('thread' in created)) throw new Error('방이 만들어져야 한다');
		expect(created.thread).toMatchObject({ title: '민수', mine: true, lastMessage: { text: '내 방 첫 글' } });
		expect(created.message).toMatchObject({ threadId: created.thread.id, mine: true });

		const again = await repo.createThread(input('또 만들기', '다른 이름'));
		expect(again).toEqual({ existing: expect.objectContaining({ id: created.thread.id }) });
		expect(await repo.listThreads()).toHaveLength(2);
	});

	it('다른 사람의 방에도 쓸 수 있고, 작성자는 브라우저마다 구분된다', async () => {
		const storage = memoryStorage();
		const a = createLocalConversationRepository('visitor-a', storage);
		const b = createLocalConversationRepository('visitor-b', storage);

		const created = await a.createThread(input('A의 방', '민수'));
		if (!('thread' in created)) throw new Error('방이 만들어져야 한다');
		await b.postMessage(created.thread.id, input('B가 A의 방에', '지영'));

		const seenByA = await a.listMessages(created.thread.id);
		const seenByB = await b.listMessages(created.thread.id);
		expect(seenByA.map((m) => [m.nickname, m.mine])).toEqual([
			['민수', true],
			['지영', false],
		]);
		expect(seenByB.map((m) => [m.nickname, m.mine])).toEqual([
			['민수', false],
			['지영', true],
		]);
		// B는 글만 썼으므로 B의 방은 없다
		expect((await b.listThreads()).some((t) => t.mine)).toBe(false);
	});

	it('없는 방에는 쓸 수 없다', async () => {
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
