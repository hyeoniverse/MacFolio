// 메모 목록에 무엇을 보여 줄지: 폴더(또는 태그·최근 삭제된 항목)와 검색어·검색 조건·정렬로 고른 글들, 본문에 열 글.
// 상태는 앱 쪽(React의 useNoteView)이 갖고, 여기서는 그 상태로 계산만 한다
import { sortBy, type Arrangement } from './arrange';
import { filterPosts, ALL_CATEGORY, TAG_VIEW, type FolderNode, type Post, type PostFilter } from './posts';
import { splitPinned } from './organize';
import { matchesTags, type TagSelection } from './tagFilter';
import { tagsOf } from './tags';

/** 모든 폴더 경로 (폴더를 옮길 때 하위 폴더까지 3단을 넘지 않는지 잰다) */
export function folderPaths(folders: FolderNode[]): string[] {
	return folders.flatMap((node) => [node.path, ...folderPaths(node.children)]);
}

/** 태그로 볼 때는 고른 태그에 맞는 글, 아니면 그 폴더의 글 */
export function postsInView(posts: Post[], category: string, tagSelection: TagSelection): Post[] {
	return category === TAG_VIEW
		? filterPosts(posts, ALL_CATEGORY, '').filter((post) => matchesTags(tagsOf(post.body), tagSelection))
		: filterPosts(posts, category, '');
}

/** 임시 저장·예약 글 조건은 관리자에게만 있다. 방문자에게는 조건 없이 */
export const filterFor = (filter: PostFilter | null, editing: boolean): PostFilter | null =>
	editing || (filter !== 'draft' && filter !== 'scheduled') ? filter : null;

/**
 * 목록에 보일 글. 최근 삭제된 항목은 지운 순서 그대로 검색어로만 거르고,
 * 나머지는 검색어·검색 조건으로 거른 뒤 보기 설정대로 정렬한다
 */
export function listPosts({
	inView,
	trash,
	inTrash,
	query,
	filter,
	editing,
	arrangement,
}: {
	inView: Post[];
	trash: Post[];
	inTrash: boolean;
	query: string;
	filter: PostFilter | null;
	editing: boolean;
	arrangement: Arrangement;
}): Post[] {
	if (inTrash) return filterPosts(trash, ALL_CATEGORY, query);
	return sortBy(filterPosts(inView, ALL_CATEGORY, query, filterFor(filter, editing)), arrangement);
}

/** 고른 글. 목록에 없으면(폴더·검색으로 걸러지면) 목록 맨 위의 글(고정된 글 먼저) */
export function selectPost(visible: Post[], selectedSlug: string | null) {
	const { pinned, others } = splitPinned(visible);
	const selected = visible.find((post) => post.slug === selectedSlug) ?? pinned[0] ?? others[0] ?? null;
	return { pinned, others, selected };
}
