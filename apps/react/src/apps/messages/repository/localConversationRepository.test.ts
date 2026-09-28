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

	it('처음 글을 쓰면 내 방이 생기고, 두 번째부터는 생기지 않는다', async () => {
		const repo = createLocalConversationRepository('visitor-a', memoryStorage());
		const first = await repo.postMessage(PINNED_THREAD_ID, input('반가워요'));
		expect(first).not.toBe('not-found');
		if (first === 'not-found') return;
		expect(first.createdThread).toMatchObject({ title: '민수', mine: true });
		expect(first.message).toMatchObject({ text: '반가워요', mine: true, nickname: '민수' });

		const second = await repo.postMessage(PINNED_THREAD_ID, input('또 왔어요'));
		expect(second !== 'not-found' && second.createdThread).toBeUndefined();
		expect(await repo.listThreads()).toHaveLength(2);
	});

	it('다른 사람의 방에도 쓸 수 있고, 작성자는 브라우저마다 구분된다', async () => {
		const storage = memoryStorage();
		const a = createLocalConversationRepository('visitor-a', storage);
		const b = createLocalConversationRepository('visitor-b', storage);

		const posted = await a.postMessage(PINNED_THREAD_ID, input('A의 첫 글', '민수'));
		const aThread = posted !== 'not-found' ? posted.createdThread! : null;
		await b.postMessage(aThread!.id, input('B가 A의 방에', '지영'));

		const seenByA = await a.listMessages(aThread!.id);
		const seenByB = await b.listMessages(aThread!.id);
		expect(seenByA.map((m) => [m.nickname, m.mine])).toEqual([['지영', false]]);
		expect(seenByB.map((m) => [m.nickname, m.mine])).toEqual([['지영', true]]);
		// B도 처음 글을 썼으므로 B의 방이 생긴다
		expect((await b.listThreads()).filter((t) => t.mine).map((t) => t.title)).toEqual(['지영']);
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

		expect(await repo.removeMessage(posted.message.id, 'wrong')).toBe('wrong-password');
		expect(await repo.removeMessage(posted.message.id, 'pw1234')).toBe('deleted');
		expect(await repo.removeMessage(posted.message.id, 'pw1234')).toBe('not-found');
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
