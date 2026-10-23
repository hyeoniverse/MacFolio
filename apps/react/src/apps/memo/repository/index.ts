import { createStaticPostRepository, type PostRepository } from '@macfolio/desktop-core/memo';

export type { PostRepository } from '@macfolio/desktop-core/memo';

let repository: PostRepository | null = null;
let loading: Promise<PostRepository> | null = null;

/**
 * 저장소 안의 Markdown 글. 글 원문 묶음(contentFiles.ts, 글 200편이면 2MB가 넘는다)은 처음 목록을 물을 때 따로 받는다.
 * 첫 화면이 이 묶음을 기다리지 않게 하려고 (예전에는 첫 방문의 공용 묶음에 들어 있었다)
 */
export function getPostRepository(): PostRepository {
	repository ??= {
		async list() {
			loading ??= import('./contentFiles').then(({ files, created }) =>
				createStaticPostRepository(
					files,
					(path) => {
						if (import.meta.env.DEV) console.warn(`[memo] 머리말(title, date)이 잘못된 글: ${path}`);
					},
					// 같은 날 글은 나중에 올린 글이 위로 (git에 처음 더한 시각)
					created
				)
			);
			return (await loading).list();
		},
	};
	return repository;
}
