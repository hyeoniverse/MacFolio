import {
	addFolder,
	ALL_CATEGORY,
	moveFolder,
	removeFolder,
	renameFolder,
	type FolderPath,
	type Organization,
} from '@macfolio/desktop-core/memo';

interface FolderActionsOptions {
	edit: (change: (prev: Organization) => Organization) => void;
	/** 지금 연 폴더 */
	category: string;
	setCategory: (path: string) => void;
	selectFolder: (path: string) => void;
	folderPaths: string[];
}

/**
 * 폴더 정리 (관리자): 만들기·이름 바꾸기·지우기·옮기기.
 * 지금 연 폴더(또는 그 안)가 바뀌면 새 경로를 따라가고, 지우면 모든 글로 간다
 */
export function useFolderActions({ edit, category, setCategory, selectFolder, folderPaths }: FolderActionsOptions) {
	const inside = (path: string) => category === path || category.startsWith(`${path}/`);
	return {
		add: (parent: string, name: string) => {
			edit((prev) => addFolder(prev, parent, name));
			selectFolder(parent ? `${parent}/${name}` : name);
		},
		rename: (path: FolderPath, name: string) => {
			edit((prev) => renameFolder(prev, path, name));
			if (inside(path)) setCategory([...path.split('/').slice(0, -1), name].join('/') + category.slice(path.length));
		},
		remove: (path: FolderPath) => {
			edit((prev) => removeFolder(prev, path));
			if (inside(path)) selectFolder(ALL_CATEGORY);
		},
		/** 폴더를 target 폴더 안(모든 글이면 맨 위)으로 옮긴다 */
		moveTo: (path: FolderPath, target: string) => {
			const parent = target === ALL_CATEGORY ? '' : target;
			edit((prev) => moveFolder(prev, path, parent, folderPaths));
			const moved = `${parent ? `${parent}/` : ''}${path.split('/').at(-1)}`;
			if (inside(path)) setCategory(moved + category.slice(path.length));
		},
	};
}
