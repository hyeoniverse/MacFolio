import { createStaticPostRepository, type PostRepository } from '@macfolio/desktop-core/memo';

export type { PostRepository } from '@macfolio/desktop-core/memo';

let repository: PostRepository | null = null;

/** 지금은 저장소 안의 Markdown 파일을 읽는다. 관리자 글쓰기(#9)가 생기면 여기서 구현체를 고른다. */
export function getPostRepository(): PostRepository {
	if (!repository) {
		const files = import.meta.glob<string>('../content/*.md', { query: '?raw', import: 'default', eager: true });
		repository = createStaticPostRepository(files, (path) => {
			if (import.meta.env.DEV) console.warn(`[memo] 머리말(title, date)이 잘못된 글: ${path}`);
		});
	}
	return repository;
}
