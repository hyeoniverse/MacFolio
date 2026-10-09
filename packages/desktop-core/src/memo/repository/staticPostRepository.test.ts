import { describe, expect, it } from 'vitest';
import { createStaticPostRepository } from './staticPostRepository';

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

	it('머리말이 잘못된 파일은 목록에서 빠진다', async () => {
		const repo = createStaticPostRepository({
			'a.md': '제목 없는 글',
			'b.md': '---\ntitle: 정상\ndate: 2026-09-28\n---\n',
		});
		expect((await repo.list()).map((p) => p.slug)).toEqual(['b']);
	});
});
