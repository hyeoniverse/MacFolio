// 방문자가 만든 폴더. 글은 저장소의 Markdown 파일이라 방문자는 글을 쓰지 못하고, 폴더만 이 브라우저에 만든다.
// React에 의존하지 않는 순수 함수와 저장소만 둔다.
import type { FolderNode } from './posts';

export const USER_FOLDERS_KEY = 'macfolio:memo:folders';
export const FOLDER_NAME_MAX = 30;

/** 새 폴더 이름을 검사한다. 문제가 없으면 null, 있으면 안내 문구 */
export function validateFolderName(name: string, existing: string[]): string | null {
	const trimmed = name.trim();
	if (!trimmed) return '폴더 이름을 입력하세요.';
	if (trimmed.length > FOLDER_NAME_MAX) return `${FOLDER_NAME_MAX}자 이하로 입력하세요.`;
	if (trimmed.includes('/')) return "이름에 '/'는 쓸 수 없어요.";
	if (existing.some((folder) => folder.toLowerCase() === trimmed.toLowerCase())) return '이미 있는 폴더예요.';
	return null;
}

/** 글에서 만든 폴더 트리 뒤에 방문자가 만든 폴더(글 0개)를 붙인다. 같은 이름이 있으면 붙이지 않는다 */
export function withUserFolders(tree: FolderNode[], userFolders: string[]): FolderNode[] {
	const extra = userFolders
		.filter((name) => !tree.some((node) => node.name === name))
		.map((name): FolderNode => ({ name, path: name, count: 0, children: [], custom: true }));
	return [...tree, ...extra];
}

export function loadUserFolders(): string[] {
	try {
		const value: unknown = JSON.parse(localStorage.getItem(USER_FOLDERS_KEY) ?? '[]');
		return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
	} catch {
		return [];
	}
}

export function saveUserFolders(folders: string[]) {
	try {
		localStorage.setItem(USER_FOLDERS_KEY, JSON.stringify(folders));
	} catch {
		// 저장하지 못해도 이번 방문 동안은 보인다
	}
}
