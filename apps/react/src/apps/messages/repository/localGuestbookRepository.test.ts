import { describe, expect, it } from 'vitest';
import { createLocalGuestbookRepository, STORAGE_KEY } from './localGuestbookRepository';

const memoryStorage = () => {
	const data = new Map<string, string>();
	return {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => data.set(key, value),
		data,
	};
};

const input = { nickname: '방문자', message: '안녕하세요', password: 'pw1234' };

describe('createLocalGuestbookRepository', () => {
	it('처음에는 주인의 환영 글이 있다', async () => {
		const entries = await createLocalGuestbookRepository(memoryStorage()).list();
		expect(entries).toHaveLength(1);
		expect(entries[0].isOwner).toBe(true);
	});

	it('작성한 글이 목록에 나오고, 비밀번호는 평문으로도 해시로도 노출되지 않는다', async () => {
		const storage = memoryStorage();
		const repo = createLocalGuestbookRepository(storage, () => new Date('2026-09-28T01:02:03Z'));
		const created = await repo.create(input);

		expect(created).toMatchObject({ nickname: '방문자', message: '안녕하세요', createdAt: '2026-09-28T01:02:03.000Z' });
		expect(created).not.toHaveProperty('passwordHash');
		expect((await repo.list()).map((e) => e.id)).toContain(created.id);
		expect(storage.data.get(STORAGE_KEY)).not.toContain('pw1234');
	});

	it('틀린 비밀번호로는 지울 수 없고, 맞는 비밀번호로는 지운다', async () => {
		const repo = createLocalGuestbookRepository(memoryStorage());
		const { id } = await repo.create(input);

		expect(await repo.remove(id, 'wrong')).toBe('wrong-password');
		expect(await repo.remove(id, 'pw1234')).toBe('deleted');
		expect((await repo.list()).some((e) => e.id === id)).toBe(false);
	});

	it('없는 글이나 주인의 글은 지울 수 없다', async () => {
		const repo = createLocalGuestbookRepository(memoryStorage());
		expect(await repo.remove('nope', 'pw')).toBe('not-found');
		expect(await repo.remove('welcome', '')).toBe('not-found');
	});

	it('저장된 값이 깨져 있으면 기본 글로 시작한다', async () => {
		const storage = memoryStorage();
		storage.setItem(STORAGE_KEY, '{broken');
		expect(await createLocalGuestbookRepository(storage).list()).toHaveLength(1);
	});
});
