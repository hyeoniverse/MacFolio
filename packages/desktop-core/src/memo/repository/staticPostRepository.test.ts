import { describe, expect, it } from 'vitest';
import { createStaticPostRepository } from './staticPostRepository.js';

describe('createStaticPostRepository', () => {
	it('파일 이름이 slug가 되고, 최신 글이 위로 온다', async () => {
		const repo = createStaticPostRepository({
			'../content/old-post.md': '---\ntitle: 예전 글\ndate: 2026-01-01\n---\n본문',
			'../content/new-post.md': '---\ntitle: 새 글\ndate: 2026-09-28\ncategory: 개발기\n---\n본문',
		});
		expect((await repo.list()).map((p) => [p.slug, p.category])).toEqual([
			['new-post', '개발기'],
			['old-post', '기타'],
		]);
	});

	it('같은 날 글은 올린 때(빌드가 git 기록에서 읽은 값)로 나중에 올린 글이 위', async () => {
		const repo = createStaticPostRepository(
			{
				'../content/a-morning.md': '---\ntitle: 가 아침 글\ndate: 2026-09-28\n---\n본문',
				'../content/b-evening.md': '---\ntitle: 나 저녁 글\ndate: 2026-09-28\n---\n본문',
			},
			undefined,
			{ 'a-morning': '2026-09-28T00:00:00.000Z', 'b-evening': '2026-09-28T11:00:00.000Z' }
		);
		expect((await repo.list()).map((p) => [p.slug, p.createdAt])).toEqual([
			['b-evening', '2026-09-28T11:00:00.000Z'],
			['a-morning', '2026-09-28T00:00:00.000Z'],
		]);
	});

	it('머리말이 잘못된 파일은 목록에서 빠진다', async () => {
		const repo = createStaticPostRepository({
			'a.md': '제목 없는 글',
			'b.md': '---\ntitle: 정상\ndate: 2026-09-28\n---\n',
		});
		expect((await repo.list()).map((p) => p.slug)).toEqual(['b']);
	});
});
