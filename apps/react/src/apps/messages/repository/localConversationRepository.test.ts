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

const input = { nickname: '민수', password: 'pw1234', text: '안녕하세요' };

describe('createLocalConversationRepository', () => {
	it('처음에는 주인의 고정 대화만 있다', async () => {
		const repo = createLocalConversationRepository(memoryStorage());
		const threads = await repo.listThreads();
		expect(threads).toHaveLength(1);
		expect(threads[0]).toMatchObject({ id: PINNED_THREAD_ID, pinned: true });
		expect((await repo.listMessages(PINNED_THREAD_ID)).every((m) => m.fromOwner)).toBe(true);
	});

	it('대화를 시작하면 목록에 생기고, 비밀번호와 토큰은 저장소에 평문으로 남지 않는다', async () => {
		const storage = memoryStorage();
		const repo = createLocalConversationRepository(storage, () => new Date('2026-09-28T01:02:03Z'));
		const { thread, message, access } = await repo.createThread(input);

		expect(thread).toMatchObject({ title: '민수' });
		expect(thread).not.toHaveProperty('passwordHash');
		expect(message).toMatchObject({ text: '안녕하세요', fromOwner: false, createdAt: '2026-09-28T01:02:03.000Z' });
		const listed = (await repo.listThreads()).find((t) => t.id === thread.id);
		expect(listed?.lastMessage).toEqual({ text: '안녕하세요', createdAt: '2026-09-28T01:02:03.000Z' });

		const raw = storage.data.get(STORAGE_KEY)!;
		expect(raw).not.toContain('pw1234');
		expect(raw).not.toContain(access.token);
	});

	it('토큰이 맞아야 자기 대화에 이어서 쓸 수 있다', async () => {
		const repo = createLocalConversationRepository(memoryStorage());
		const { access } = await repo.createThread(input);

		expect(await repo.postMessage({ ...access, token: 'stolen' }, '끼어들기')).toBe('forbidden');
		const posted = await repo.postMessage(access, '두 번째');
		expect(posted).toMatchObject({ text: '두 번째', threadId: access.threadId });
		expect(await repo.listMessages(access.threadId)).toHaveLength(2);
	});

	it('대화를 시작할 때 정한 비밀번호로 메시지를 지운다', async () => {
		const repo = createLocalConversationRepository(memoryStorage());
		const { message } = await repo.createThread(input);

		expect(await repo.removeMessage(message.id, 'wrong')).toBe('wrong-password');
		expect(await repo.removeMessage(message.id, 'pw1234')).toBe('deleted');
		expect(await repo.removeMessage(message.id, 'pw1234')).toBe('not-found');
	});

	it('고정 대화의 주인 메시지는 지울 수 없다', async () => {
		const repo = createLocalConversationRepository(memoryStorage());
		expect(await repo.removeMessage('owner-1', '')).toBe('not-found');
	});

	it('저장된 값이 깨져 있으면 빈 상태로 시작한다', async () => {
		const storage = memoryStorage();
		storage.setItem(STORAGE_KEY, '{broken');
		expect(await createLocalConversationRepository(storage).listThreads()).toHaveLength(1);
	});
});
