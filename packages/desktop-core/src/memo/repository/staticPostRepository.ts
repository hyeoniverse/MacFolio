import { sortPosts, toPost, type Post } from '../posts.js';
import { postSlug } from '../rules.js';
import type { PostRepository } from './types.js';

/**
 * Markdown 파일 묶음으로 만든 저장소.
 * @param files 파일 경로 → 파일 내용. 파일 이름(확장자 제외)이 글의 slug가 된다.
 *   머리말이 잘못된 파일은 빌드를 깨지 않고 목록에서만 빠진다.
 * @param onInvalid 빠진 파일을 알린다 (개발 중 경고 등)
 * @param created slug → 올린 시각 (ISO, 빌드가 git 기록에서 읽는다). 같은 날 글의 순서를 정한다
 */
export function createStaticPostRepository(
	files: Record<string, string>,
	onInvalid?: (path: string) => void,
	created: Record<string, string> = {}
): PostRepository {
	const posts: Post[] = [];
	for (const [path, source] of Object.entries(files)) {
		// 파일 이름이 글 주소 모양이 아니면(공백·한글 등) 글로 보지 않는다
		const slug = postSlug(path.split('/').at(-1)!.replace(/\.md$/, ''));
		const post = slug && toPost(slug, source);
		if (post) posts.push(created[slug] ? { ...post, createdAt: created[slug] } : post);
		else onInvalid?.(path);
	}
	const sorted = sortPosts(posts);
	return {
		async list() {
			return sorted;
		},
	};
}
