// 관리자가 메모를 정리한 내용: 만든 폴더, 옮긴 글, 옮긴 폴더, 고정.
// 글은 저장소의 Markdown 파일이라 파일은 그대로 두고, API(/memo/organization)에 저장한 정리 내용을 겹쳐 보여준다.
// 정리 내용의 모양과 서버도 쓰는 검사는 rules.ts에 있다. 순수 함수만 둔다.
import type { Post } from './posts.js';
import {
	EMPTY_ORGANIZATION,
	FOLDER_NAME_MAX,
	MAX_FOLDER_DEPTH,
	type FolderPath,
	type Organization,
	type PostSlug,
} from './rules.js';

const lastName = (path: string) => path.split('/').at(-1) ?? path;
const parentOf = (path: string) => path.split('/').slice(0, -1).join('/');
/** 규칙에 맞는 경로끼리 잇거나 앞부분을 바꾼 결과는 다시 폴더 경로다 (여기서만 표시를 붙인다) */
const asPath = (path: string) => path as FolderPath;
const join = (parent: string, name: string) => (parent ? `${parent}/${name}` : name);

/** path가 prefix이거나 그 아래 경로면 prefix를 바꾼다 */
function rebase(path: FolderPath, from: FolderPath, to: FolderPath): FolderPath {
	if (path === from) return to;
	if (path.startsWith(`${from}/`)) return asPath(to + path.slice(from.length));
	return path;
}

/** 새 폴더 이름을 검사한다. 문제가 없으면 null, 있으면 안내 문구 */
export function validateFolderName(name: string, siblings: string[]): string | null {
	const trimmed = name.trim();
	if (!trimmed) return '폴더 이름을 입력하세요.';
	if (trimmed.length > FOLDER_NAME_MAX) return `${FOLDER_NAME_MAX}자 이하로 입력하세요.`;
	if (trimmed.includes('/')) return "이름에 '/'는 쓸 수 없어요.";
	if (siblings.some((folder) => folder.toLowerCase() === trimmed.toLowerCase())) return '이미 있는 폴더예요.';
	return null;
}

/** 정리 내용을 적용한 글 (category가 지금 있는 폴더로, pinned·locked가 관리자가 고른 값으로 바뀐다) */
export function organizePosts(posts: Post[], organization: Organization): Post[] {
	return posts.map((post) => {
		const moved = organization.posts[post.slug];
		const category =
			moved ?? organization.moves.reduce((path, move) => rebase(path, move.from, move.to), asPath(post.category));
		const pinned = organization.pins[post.slug] ?? post.pinned ?? false;
		const locked = organization.locks[post.slug] ?? false;
		return category === post.category && pinned === (post.pinned ?? false) && locked === Boolean(post.locked)
			? post
			: { ...post, category, pinned, locked };
	});
}

/** 글을 고정하거나 고정을 푼다 */
export function setPinned(organization: Organization, slug: PostSlug, pinned: boolean): Organization {
	return { ...organization, pins: { ...organization.pins, [slug]: pinned } };
}

/** 글을 잠그거나 잠금을 푼다 (푼 글은 목록에서 지운다) */
export function setLocked(organization: Organization, slug: PostSlug, locked: boolean): Organization {
	const { [slug]: _, ...rest } = organization.locks;
	return { ...organization, locks: locked ? { ...rest, [slug]: true } : rest };
}

/** 고정된 글과 나머지로 나눈다 (각각 원래 순서 유지) */
export function splitPinned(posts: Post[]): { pinned: Post[]; others: Post[] } {
	return { pinned: posts.filter((post) => post.pinned), others: posts.filter((post) => !post.pinned) };
}

/** 폴더의 단 (맨 위 폴더가 1단, '' = 0) */
export const folderDepth = (path: string) => (path ? path.split('/').length : 0);

/** parent 안에 새 폴더를 만들 수 있는지 (3단까지) */
export const canAddFolder = (parent: string) => folderDepth(parent) < MAX_FOLDER_DEPTH;

/**
 * 폴더를 parent 아래로 옮길 수 있는지.
 * 자기 자신이나 자기 아래로는 못 옮기고, 이미 그 자리면 의미가 없고, 옮긴 뒤 하위 폴더까지 3단을 넘으면 안 된다.
 * @param allFolders 지금 있는 모든 폴더 경로 (옮길 폴더의 하위 폴더 깊이를 잰다)
 */
export function canMoveFolder(from: string, parent: string, allFolders: string[] = []): boolean {
	if (parent === from || parent.startsWith(`${from}/`)) return false;
	if (parentOf(from) === parent) return false;
	// 옮길 폴더 자신을 포함한 높이 (하위 폴더가 없으면 1)
	const height = Math.max(
		1,
		...allFolders.filter((path) => path.startsWith(`${from}/`)).map((path) => folderDepth(path) - folderDepth(from) + 1)
	);
	return folderDepth(parent) + height <= MAX_FOLDER_DEPTH;
}

/** 폴더를 parent 아래로 옮긴다 (parent가 ''이면 맨 위로). 안의 글과 하위 폴더도 함께 옮겨 간다 */
export function moveFolder(
	organization: Organization,
	from: FolderPath,
	parent: string,
	allFolders: string[] = []
): Organization {
	if (!canMoveFolder(from, parent, allFolders)) return organization;
	return relocate(organization, from, asPath(join(parent, lastName(from))));
}

/** 폴더 이름을 바꾼다. 안의 글과 하위 폴더도 새 경로를 따라간다 */
export function renameFolder(organization: Organization, path: FolderPath, name: string): Organization {
	const to = asPath(join(parentOf(path), name.trim()));
	return to === path ? organization : relocate(organization, path, to);
}

/** 폴더를 from에서 to 경로로 옮긴다 */
function relocate(organization: Organization, from: FolderPath, to: FolderPath): Organization {
	return {
		folders: [...new Set(organization.folders.map((path) => rebase(path, from, to)))],
		posts: Object.fromEntries(
			Object.entries(organization.posts).map(([slug, path]) => [slug, rebase(path, from, to)])
		) as Record<PostSlug, FolderPath>,
		moves: [...organization.moves, { from, to }],
		pins: organization.pins,
		locks: organization.locks,
		order: [...new Set(organization.order.map((path) => rebase(path, from, to)))],
	};
}

/** 글을 폴더로 옮긴다 */
export function movePost(organization: Organization, slug: PostSlug, folder: FolderPath): Organization {
	return { ...organization, posts: { ...organization.posts, [slug]: folder } };
}

/** 폴더를 만든다 (parent가 ''이면 맨 위) */
export function addFolder(organization: Organization, parent: string, name: string): Organization {
	if (!canAddFolder(parent)) return organization;
	return { ...organization, folders: [...organization.folders, asPath(join(parent, name.trim()))] };
}

/** 만든 폴더를 지운다 (비어 있는 폴더만 지우게 화면에서 막는다) */
export function removeFolder(organization: Organization, path: FolderPath): Organization {
	return {
		...organization,
		folders: organization.folders.filter((folder) => folder !== path && !folder.startsWith(`${path}/`)),
		order: organization.order.filter((folder) => folder !== path && !folder.startsWith(`${path}/`)),
	};
}

/**
 * 같은 층 폴더의 순서를 바꾼다. siblings는 그 층의 폴더 경로를 새 순서대로 모두 담는다.
 * 다른 층의 순서는 그대로 두고, 이 층의 경로만 새 순서로 바꿔 넣는다.
 */
export function reorderFolders(organization: Organization, siblings: FolderPath[]): Organization {
	return { ...organization, order: [...organization.order.filter((path) => !siblings.includes(path)), ...siblings] };
}

/** API가 돌려준 값을 정리 내용으로 (모양이 다른 필드는 비운다) */
export function normalizeOrganization(raw: unknown): Organization {
	if (!raw || typeof raw !== 'object') return EMPTY_ORGANIZATION;
	const value = raw as Partial<Organization>;
	const isRecord = (field: unknown) => typeof field === 'object' && field !== null && !Array.isArray(field);
	return {
		folders: Array.isArray(value.folders) ? value.folders.filter((folder) => typeof folder === 'string') : [],
		posts: isRecord(value.posts) ? (value.posts as Record<PostSlug, FolderPath>) : {},
		moves: Array.isArray(value.moves)
			? value.moves.filter((move) => move && typeof move.from === 'string' && typeof move.to === 'string')
			: [],
		pins: isRecord(value.pins) ? (value.pins as Record<PostSlug, boolean>) : {},
		locks: isRecord(value.locks) ? (value.locks as Record<PostSlug, boolean>) : {},
		order: Array.isArray(value.order) ? value.order.filter((path) => typeof path === 'string') : [],
	};
}
