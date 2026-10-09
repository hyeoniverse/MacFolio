import { createStaticPostRepository, type PostRepository } from '@macfolio/desktop-core/memo';

export type { PostRepository } from '@macfolio/desktop-core/memo';

/** 예전 Memo(방명록)가 브라우저에 남긴 데이터. 블로그로 바뀌어 쓰지 않으므로 지운다 */
const LEGACY_KEYS = ['macfolio:memos'];

let repository: PostRepository | null = null;

/** 지금은 저장소 안의 Markdown 파일을 읽는다. 관리자 글쓰기(#9)가 생기면 여기서 구현체를 고른다. */
export function getPostRepository(): PostRepository {
	if (!repository) {
		try {
			LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
		} catch {
			// 지우지 못해도 블로그는 이 데이터를 쓰지 않는다
		}
		const files = import.meta.glob<string>('../content/*.md', { query: '?raw', import: 'default', eager: true });
		repository = createStaticPostRepository(files, (path) => {
			if (import.meta.env.DEV) console.warn(`[memo] 머리말(title, date)이 잘못된 글: ${path}`);
		});
	}
	return repository;
}
