// 방문자가 메모를 정리한 내용: 만든 폴더, 옮긴 글, 옮긴 폴더.
// 글은 저장소의 Markdown 파일이라 파일은 그대로 두고, 이 브라우저에만 정리 내용을 저장해 겹쳐 보여준다.
// React에 의존하지 않는 순수 함수와 저장소만 둔다.
import type { Post } from './posts';

export const ORGANIZATION_KEY = 'macfolio:memo:organization';
/** 예전(폴더 이름 목록만 저장하던) 키 */
const LEGACY_FOLDERS_KEY = 'macfolio:memo:folders';
export const FOLDER_NAME_MAX = 30;
/** 폴더는 3단까지 (예: 개발기/MacFolio/초안) */
export const MAX_FOLDER_DEPTH = 3;

export interface Organization {
	/** 방문자가 만든 폴더의 전체 경로 (예: 읽을거리, 개발기/읽을거리) */
	folders: string[];
	/** 옮긴 글: slug → 폴더 경로 */
	posts: Record<string, string>;
	/** 옮긴 폴더 (순서대로 적용한다). 글의 원래 category 경로에 적용된다 */
	moves: { from: string; to: string }[];
}

export const EMPTY_ORGANIZATION: Organization = { folders: [], posts: {}, moves: [] };

const lastName = (path: string) => path.split('/').at(-1) ?? path;
const parentOf = (path: string) => path.split('/').slice(0, -1).join('/');
const join = (parent: string, name: string) => (parent ? `${parent}/${name}` : name);

/** path가 prefix이거나 그 아래 경로면 prefix를 바꾼다 */
function rebase(path: string, from: string, to: string): string {
	if (path === from) return to;
	if (path.startsWith(`${from}/`)) return to + path.slice(from.length);
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

/** 정리 내용을 적용한 글 (category가 지금 있는 폴더로 바뀐다) */
export function organizePosts(posts: Post[], organization: Organization): Post[] {
	return posts.map((post) => {
		const moved = organization.posts[post.slug];
		const category =
			moved ?? organization.moves.reduce((path, move) => rebase(path, move.from, move.to), post.category);
		return category === post.category ? post : { ...post, category };
	});
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
	from: string,
	parent: string,
	allFolders: string[] = []
): Organization {
	if (!canMoveFolder(from, parent, allFolders)) return organization;
	return relocate(organization, from, join(parent, lastName(from)));
}

/** 폴더 이름을 바꾼다. 안의 글과 하위 폴더도 새 경로를 따라간다 */
export function renameFolder(organization: Organization, path: string, name: string): Organization {
	const to = join(parentOf(path), name.trim());
	return to === path ? organization : relocate(organization, path, to);
}

/** 폴더를 from에서 to 경로로 옮긴다 */
function relocate(organization: Organization, from: string, to: string): Organization {
	return {
		folders: [...new Set(organization.folders.map((path) => rebase(path, from, to)))],
		posts: Object.fromEntries(Object.entries(organization.posts).map(([slug, path]) => [slug, rebase(path, from, to)])),
		moves: [...organization.moves, { from, to }],
	};
}

/** 글을 폴더로 옮긴다 */
export function movePost(organization: Organization, slug: string, folder: string): Organization {
	return { ...organization, posts: { ...organization.posts, [slug]: folder } };
}

/** 폴더를 만든다 (parent가 ''이면 맨 위) */
export function addFolder(organization: Organization, parent: string, name: string): Organization {
	if (!canAddFolder(parent)) return organization;
	return { ...organization, folders: [...organization.folders, join(parent, name.trim())] };
}

/** 만든 폴더를 지운다 (비어 있는 폴더만 지우게 화면에서 막는다) */
export function removeFolder(organization: Organization, path: string): Organization {
	return {
		...organization,
		folders: organization.folders.filter((folder) => folder !== path && !folder.startsWith(`${path}/`)),
	};
}

export function loadOrganization(): Organization {
	try {
		const raw: unknown = JSON.parse(localStorage.getItem(ORGANIZATION_KEY) ?? 'null');
		if (raw && typeof raw === 'object') {
			const value = raw as Partial<Organization>;
			return {
				folders: Array.isArray(value.folders) ? value.folders.filter((f) => typeof f === 'string') : [],
				posts: value.posts && typeof value.posts === 'object' ? value.posts : {},
				moves: Array.isArray(value.moves) ? value.moves.filter((m) => m && typeof m.from === 'string') : [],
			};
		}
		// 예전에 만든 폴더(이름 목록)를 옮겨 온다
		const legacy: unknown = JSON.parse(localStorage.getItem(LEGACY_FOLDERS_KEY) ?? '[]');
		localStorage.removeItem(LEGACY_FOLDERS_KEY);
		return { ...EMPTY_ORGANIZATION, folders: Array.isArray(legacy) ? legacy.filter((f) => typeof f === 'string') : [] };
	} catch {
		return EMPTY_ORGANIZATION;
	}
}

export function saveOrganization(organization: Organization) {
	try {
		localStorage.setItem(ORGANIZATION_KEY, JSON.stringify(organization));
	} catch {
		// 저장하지 못해도 이번 방문 동안은 보인다
	}
}
