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
import type { DocumentFolderValue } from './documents';
import { find, isFileItem, pathTo, TRASH_ID, uploadFolderOf, type FinderItem, type FolderItem } from './files';

/** 편집할 수 있는 항목의 종류. 시스템 항목(프로젝트, 앱, 저장소 문서, 사진 폴더, 위치, 기본 폴더)은 null */
export type EditKind = 'folder' | 'file' | 'blog-folder' | 'post' | 'alias';

export function editKind(item: FinderItem): EditKind | null {
	if (item.kind === 'folder') {
		if (item.aliasOf) return 'alias';
		if (item.id.startsWith('folder:')) return 'folder';
		if (item.id.startsWith('blog/')) return 'blog-folder';
		return null;
	}
	if (isFileItem(item) && item.id.startsWith('file:') && item.documentId) return 'file';
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
		if (kind === 'blog-folder') return canMoveFolder(blogPath(item.id), blogPath(target.id), blogFolderPaths(roots));
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
			folders: state.layout.folders.map((folder) =>
				folder.id === item.id ? { ...folder, name: name.trim() } : folder
			),
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
	// 휴지통으로 끌어 넣으면 원래 자리를 적고, 휴지통에서 끌어 내면 지운다
	const trash = { ...(layout.trash ?? {}) };
	for (const item of items) {
		const from = parentOf(roots, item.id)?.id;
		if (target.id === TRASH_ID) {
			if (from && from !== TRASH_ID) trash[item.id] = from;
		} else delete trash[item.id];
	}
	layout = { ...layout, trash };
	for (const item of items) {
		if (editKind(item) === 'folder')
			layout = {
				...layout,
				folders: layout.folders.map((folder) => (folder.id === item.id ? { ...folder, parent: target.id } : folder)),
			};
		else {
			// 원래 올린 폴더로 돌아가면 적어 둔 자리를 지운다
			const { [item.id]: _, ...rest } = layout.files;
			const home = isFileItem(item) ? item.home : undefined;
			layout = { ...layout, files: home === target.id ? rest : { ...rest, [item.id]: target.id } };
		}
	}
	return { layout };
}

/**
 * 휴지통으로 이동 (macOS처럼 지우지 않고 휴지통에 넣는다): 만든 폴더·올린 파일은 휴지통(trash)으로 옮기고 원래 폴더를 적어 둔다.
 * 가상본은 바탕화면에서 빼고, 빈 블로그 폴더는 메모 폴더를 지운다 (둘 다 지울 파일이 없다)
 */
export function trashChange(
	roots: FinderItem[],
	items: FinderItem[],
	state: { layout: FinderLayoutValue; organization: Organization }
): Change {
	let { layout, organization } = state;
	const trash = { ...(layout.trash ?? {}) };
	for (const item of items) {
		const kind = editKind(item);
		const from = parentOf(roots, item.id)?.id;
		if (kind === 'folder') {
			if (from) trash[item.id] = from;
			layout = {
				...layout,
				folders: layout.folders.map((folder) => (folder.id === item.id ? { ...folder, parent: TRASH_ID } : folder)),
			};
		} else if (kind === 'file') {
			if (from) trash[item.id] = from;
			layout = { ...layout, files: { ...layout.files, [item.id]: TRASH_ID } };
		} else if (kind === 'alias' && item.kind === 'folder')
			layout = {
				...layout,
				aliases: (layout.aliases ?? [...DEFAULT_DESKTOP_ALIASES]).filter((target) => target !== item.aliasOf),
			};
		else if (kind === 'blog-folder') organization = removeMemoFolder(organization, blogPath(item.id) as FolderPath);
	}
	return { layout: { ...layout, trash }, organization };
}

/** 휴지통의 항목을 원래 폴더로 되돌린다 (그 폴더가 없어졌으면 올린 폴더, 그것도 없으면 데스크탑) */
export function putBackChange(roots: FinderItem[], items: FinderItem[], state: { layout: FinderLayoutValue }): Change {
	let { layout } = state;
	const trash = { ...(layout.trash ?? {}) };
	for (const item of items) {
		const saved = trash[item.id];
		delete trash[item.id];
		const home = isFileItem(item) ? item.home : undefined;
		const back = saved && find(roots, saved)?.kind === 'folder' ? saved : (home ?? 'desktop');
		if (editKind(item) === 'folder')
			layout = {
				...layout,
				folders: layout.folders.map((folder) => (folder.id === item.id ? { ...folder, parent: back } : folder)),
			};
		else if (isFileItem(item)) {
			const { [item.id]: _, ...rest } = layout.files;
			layout = { ...layout, files: back === home ? rest : { ...rest, [item.id]: back } };
		}
	}
	return { layout: { ...layout, trash } };
}

/** 영구 삭제 (휴지통 비우기·즉시 삭제): 만든 폴더(안의 폴더까지)를 구조에서 빼고, 지울 문서 파일(서버 id)을 모은다 */
export function deleteChange(
	items: FinderItem[],
	state: { layout: FinderLayoutValue }
): Change & { documents: string[] } {
	let { layout } = state;
	const documents: string[] = [];
	const folderIds = new Set<string>();
	const fileIds = new Set<string>();
	const collect = (item: FinderItem) => {
		if (isFileItem(item) && item.documentId) {
			documents.push(item.documentId);
			fileIds.add(item.id);
		}
		if (item.kind === 'folder' && !item.aliasOf) {
			if (item.id.startsWith('folder:')) folderIds.add(item.id);
			item.children.forEach(collect);
		}
	};
	items.forEach(collect);
	const gone = (id: string) => folderIds.has(id) || fileIds.has(id);
	const files = Object.fromEntries(
		Object.entries(layout.files).filter(([id, parent]) => !folderIds.has(parent) && !gone(id))
	);
	const trash = Object.fromEntries(Object.entries(layout.trash ?? {}).filter(([id]) => !gone(id)));
	layout = { ...layout, folders: layout.folders.filter((folder) => !folderIds.has(folder.id)), files, trash };
	return { layout, documents };
}

/**
 * 관리자가 컴퓨터의 파일을 이 폴더에 놓았을 때: 올릴 문서 폴더 값(R2)과, 그 폴더가 아닌 곳이면 Finder 구조에 적어 둘 자리.
 * 놓은 폴더에서 위로 올라가며 처음 만나는 이력서·포트폴리오·자격증·프로젝트 폴더에 올리고, 그런 폴더가 없으면(데스크탑, 문서 맨 위, 그 안의 만든 폴더) 포트폴리오에 올린다.
 * 그래서 만든 폴더·바탕화면에 놓아도 놓은 자리에 보인다. 받을 수 없는 폴더(블로그·사진·앱)면 null
 */
export function uploadPlan(
	roots: FinderItem[],
	targetItem: FinderItem | null | undefined
): { folder: DocumentFolderValue; target: string; place: string | null } | null {
	const target = targetItem ? resolveAlias(roots, targetItem) : null;
	if (!target || containerKind(target) !== 'fs') return null;
	const path = pathTo(roots, target.id);
	const home = [...(path.length ? path : [target])].reverse().find((step) => uploadFolderOf(step));
	const folder = uploadFolderOf(home) ?? '포트폴리오';
	return { folder, target: target.id, place: home?.id === target.id ? null : target.id };
}

/** 올린 파일을 놓은 자리에 둔다 (uploadPlan의 place) */
export const placeFileChange = (layout: FinderLayoutValue, key: string, place: string): Change => ({
	layout: { ...layout, files: { ...layout.files, [`file:${key}`]: place } },
});
