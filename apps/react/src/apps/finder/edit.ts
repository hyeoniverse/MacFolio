// 관리자의 Finder 편집 (새 폴더, 이름 변경, 끌어서 옮기기, 휴지통으로 이동). React와 DOM에 의존하지 않는 순수 함수만 둔다.
// 바꾸는 곳은 둘이다: 문서·데스크탑·프로젝트 폴더 쪽은 Finder 구조(/finder/layout), 블로그 쪽은 메모의 정리 내용(/memo/organization).
// 그래서 블로그 폴더를 Finder에서 옮기거나 이름을 바꾸면 메모 사이드바도 같이 바뀐다. 파일(R2)은 옮기지 않고 보이는 자리만 적는다.
import {
	DEFAULT_DESKTOP_ALIASES,
	FINDER_BUILTIN_PARENT,
	finderNameError,
	type FinderLayoutValue,
} from '@macfolio/contracts';
import {
	addFolder as addMemoFolder,
	canAddFolder,
	canMoveFolder,
	moveFolder as moveMemoFolder,
	movePost,
	removeFolder as removeMemoFolder,
	renameFolder as renameMemoFolder,
	validateFolderName,
	type FolderPath,
	type Organization,
	type PostSlug,
} from '@macfolio/desktop-core/memo';
import { find, pathTo, type FinderItem, type FolderItem } from './files';

/** 편집할 수 있는 항목의 종류. 시스템 항목(프로젝트, 앱, 저장소 문서, 사진 폴더, 위치, 기본 폴더)은 null */
export type EditKind = 'folder' | 'file' | 'blog-folder' | 'post' | 'alias';

export function editKind(item: FinderItem): EditKind | null {
	if (item.kind === 'folder') {
		if (item.aliasOf) return 'alias';
		if (item.id.startsWith('folder:')) return 'folder';
		if (item.id.startsWith('blog/')) return 'blog-folder';
		return null;
	}
	if ((item.kind === 'pdf' || item.kind === 'image') && item.id.startsWith('file:') && item.documentId) return 'file';
	if (item.kind === 'post') return 'post';
	return null;
}

export const canRename = (item: FinderItem) => ['folder', 'file', 'blog-folder'].includes(editKind(item) ?? '');
export const canMove = (item: FinderItem) => ['folder', 'file', 'blog-folder', 'post'].includes(editKind(item) ?? '');
/** 블로그 폴더는 메모처럼 비어 있을 때만 지운다 (글은 메모에서 지운다) */
export const canTrash = (item: FinderItem) => {
	const kind = editKind(item);
	if (kind === 'blog-folder') return item.kind === 'folder' && item.children.length === 0;
	return kind === 'folder' || kind === 'file' || kind === 'alias';
};

/** 폴더가 받을 수 있는 쪽: 파일·만든 폴더(fs), 블로그 글·폴더(blog), 아무것도(null) */
export function containerKind(folder: FinderItem | null | undefined): 'fs' | 'blog' | null {
	if (!folder || folder.kind !== 'folder' || folder.aliasOf) return null;
	if (folder.id === 'blog' || folder.id.startsWith('blog/')) return 'blog';
	if (folder.id.startsWith('folder:') || FINDER_BUILTIN_PARENT.test(folder.id)) return 'fs';
	return null;
}

/** 가상본이면 원래 폴더, 아니면 그대로 */
export const resolveAlias = (roots: FinderItem[], item: FinderItem): FinderItem | null =>
	item.kind === 'folder' && item.aliasOf ? find(roots, item.aliasOf) : item;

/** 항목이 지금 들어 있는 폴더 */
export const parentOf = (roots: FinderItem[], id: string): FolderItem | null =>
	(pathTo(roots, id).at(-2) as FolderItem | undefined) ?? null;

/** 블로그 폴더 id(blog/개발기/MacFolio)의 메모 경로(개발기/MacFolio). 블로그 맨 위는 '' */
export const blogPath = (id: string) => (id === 'blog' ? '' : id.slice('blog/'.length));

/** 블로그의 모든 폴더 경로 (메모의 3단 검사용) */
function blogFolderPaths(roots: FinderItem[]): string[] {
	const blog = find(roots, 'blog');
	const paths: string[] = [];
	const walk = (folder: FinderItem) => {
		if (folder.kind !== 'folder') return;
		if (folder.id !== 'blog') paths.push(blogPath(folder.id));
		folder.children.forEach(walk);
	};
	if (blog) walk(blog);
	return paths;
}

/** items를 target 폴더에 놓을 수 있는지: 같은 쪽이고, 자기 안이 아니고, 이미 그 자리가 아니다 */
export function canDropInto(roots: FinderItem[], items: FinderItem[], targetItem: FinderItem): boolean {
	const target = resolveAlias(roots, targetItem);
	const side = containerKind(target);
	if (!target || !side || items.length === 0) return false;
	const targetPath = pathTo(roots, target.id).map((step) => step.id);
	return items.every((item) => {
		if (!canMove(item)) return false;
		const kind = editKind(item);
		const itemSide = kind === 'folder' || kind === 'file' ? 'fs' : 'blog';
		if (itemSide !== side) return false;
		if (targetPath.includes(item.id)) return false;
		if (parentOf(roots, item.id)?.id === target.id) return false;
		if (kind === 'blog-folder')
			return canMoveFolder(blogPath(item.id), blogPath(target.id), blogFolderPaths(roots));
		return true;
	});
}

/** 같은 폴더 안 이름 (대소문자 무시). 겹치면 안내 문구, 아니면 null */
export function nameProblem(siblings: FinderItem[], name: string, self?: string): string | null {
	const error = finderNameError(name);
	if (error) return error;
	const lower = name.trim().toLowerCase();
	if (siblings.some((item) => item.id !== self && item.name.toLowerCase() === lower))
		return `‘${name.trim()}’ 이름은 이미 사용 중입니다. 다른 이름을 선택하십시오.`;
	return null;
}

/** 새 폴더 이름: 이름 없는 폴더, 이름 없는 폴더 2, 3 … (macOS와 같다) */
export function untitledName(siblings: FinderItem[], base = '이름 없는 폴더'): string {
	const taken = new Set(siblings.map((item) => item.name.toLowerCase()));
	if (!taken.has(base)) return base;
	for (let n = 2; ; n++) if (!taken.has(`${base} ${n}`)) return `${base} ${n}`;
}

/** 새 폴더 id (folder:<무작위 소문자·숫자 10자>) */
export const newFolderId = (random: () => number = Math.random) =>
	`folder:${Array.from({ length: 10 }, () => '0123456789abcdefghijklmnopqrstuvwxyz'[Math.floor(random() * 36)]).join('')}`;

/** 이 폴더 안에 새 폴더를 만들 수 있는지 (블로그는 메모의 3단 규칙) */
export function canCreateIn(folder: FinderItem | null | undefined): boolean {
	const side = containerKind(folder);
	if (side === 'blog') return canAddFolder(blogPath(folder!.id));
	return side === 'fs';
}

export interface Change {
	layout?: FinderLayoutValue;
	organization?: Organization;
}

/** 새 폴더 (fs 쪽은 id를 정해 만들고, 블로그 쪽은 메모 폴더). 만든 항목의 Finder id도 돌려준다 */
export function createFolder(
	folder: FolderItem,
	name: string,
	state: { layout: FinderLayoutValue; organization: Organization },
	id = newFolderId()
): Change & { id: string } {
	if (containerKind(folder) === 'blog') {
		const parent = blogPath(folder.id);
		return {
			organization: addMemoFolder(state.organization, parent, name),
			id: `blog/${parent ? `${parent}/` : ''}${name.trim()}`,
		};
	}
	return {
		layout: { ...state.layout, folders: [...state.layout.folders, { id, name: name.trim(), parent: folder.id }] },
		id,
	};
}

/** 만든 폴더·블로그 폴더의 이름 바꾸기 (파일은 문서 API가 맡는다) */
export function renameFolderChange(
	item: FinderItem,
	name: string,
	state: { layout: FinderLayoutValue; organization: Organization },
	siblings: FinderItem[]
): Change & { error?: string } {
	if (editKind(item) === 'blog-folder') {
		const path = blogPath(item.id);
		const error = validateFolderName(
			name,
			siblings.filter((other) => other.kind === 'folder' && other.id !== item.id).map((other) => other.name)
		);
		if (error) return { error };
		return { organization: renameMemoFolder(state.organization, path as FolderPath, name) };
	}
	return {
		layout: {
			...state.layout,
			folders: state.layout.folders.map((folder) => (folder.id === item.id ? { ...folder, name: name.trim() } : folder)),
		},
	};
}

/** items를 target 폴더로 옮긴다 (canDropInto를 먼저 확인한다) */
export function moveChange(
	roots: FinderItem[],
	items: FinderItem[],
	targetItem: FinderItem,
	state: { layout: FinderLayoutValue; organization: Organization }
): Change {
	const target = resolveAlias(roots, targetItem)!;
	if (containerKind(target) === 'blog') {
		let organization = state.organization;
		const all = blogFolderPaths(roots);
		for (const item of items) {
			if (item.kind === 'post')
				organization = movePost(
					organization,
					item.slug as PostSlug,
					blogPath(target.id) as FolderPath,
					blogPath(parentOf(roots, item.id)?.id ?? 'blog')
				);
			else organization = moveMemoFolder(organization, blogPath(item.id) as FolderPath, blogPath(target.id), all);
		}
		return { organization };
	}
	let layout = state.layout;
	for (const item of items) {
		if (editKind(item) === 'folder')
			layout = {
				...layout,
				folders: layout.folders.map((folder) => (folder.id === item.id ? { ...folder, parent: target.id } : folder)),
			};
		else {
			// 원래 올린 폴더로 돌아가면 적어 둔 자리를 지운다
			const { [item.id]: _, ...rest } = layout.files;
			const home = item.kind === 'pdf' || item.kind === 'image' ? item.home : undefined;
			layout = { ...layout, files: home === target.id ? rest : { ...rest, [item.id]: target.id } };
		}
	}
	return { layout };
}

/** 휴지통으로: 만든 폴더(안의 폴더까지), 가상본, 빈 블로그 폴더를 구조에서 뺀다. 지울 문서 파일(서버 id)도 모은다 */
export function trashChange(
	items: FinderItem[],
	state: { layout: FinderLayoutValue; organization: Organization }
): Change & { documents: string[] } {
	let { layout, organization } = state;
	const documents: string[] = [];
	const collect = (item: FinderItem) => {
		if ((item.kind === 'pdf' || item.kind === 'image') && item.documentId) documents.push(item.documentId);
		if (item.kind === 'folder' && !item.aliasOf) item.children.forEach(collect);
	};
	const folderIds = new Set<string>();
	for (const item of items) {
		const kind = editKind(item);
		collect(item);
		if (kind === 'folder') {
			const walk = (folder: FinderItem) => {
				if (folder.kind !== 'folder') return;
				if (folder.id.startsWith('folder:')) folderIds.add(folder.id);
				folder.children.forEach(walk);
			};
			walk(item);
		} else if (kind === 'alias' && item.kind === 'folder')
			layout = {
				...layout,
				aliases: (layout.aliases ?? [...DEFAULT_DESKTOP_ALIASES]).filter((target) => target !== item.aliasOf),
			};
		else if (kind === 'blog-folder') organization = removeMemoFolder(organization, blogPath(item.id) as FolderPath);
	}
	const files = Object.fromEntries(
		Object.entries(layout.files).filter(([id, parent]) => !folderIds.has(parent) && !items.some((i) => i.id === id))
	);
	layout = { ...layout, folders: layout.folders.filter((folder) => !folderIds.has(folder.id)), files };
	return { layout, organization, documents };
}
