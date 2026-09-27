export interface Folder {
	id: string;
	title: string;
}

export interface Memo {
	id: string;
	title: string;
	content: string;
	password?: string;
	folder_id: string;
	date: string;
}

export interface MemoContextProps {
	folders: Folder[];
	memos: Memo[];
	selectedMemo: Memo | null;
	searchQuery: string;
	selectedFolder: string;
	isCreating: boolean;
	showPasswordModal: boolean;
	showErrorModal: boolean;
	newMemo: Memo;
	setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
	setMemos: React.Dispatch<React.SetStateAction<Memo[]>>;
	setSelectedMemo: React.Dispatch<React.SetStateAction<Memo | null>>;
	setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
	setSelectedFolder: React.Dispatch<React.SetStateAction<string>>;
	setIsCreating: React.Dispatch<React.SetStateAction<boolean>>;
	setShowPasswordModal: React.Dispatch<React.SetStateAction<boolean>>;
	setShowErrorModal: React.Dispatch<React.SetStateAction<boolean>>;
	setNewMemo: React.Dispatch<React.SetStateAction<Memo>>;
	fetchFoldersAndMemos: () => Promise<void>;
	createMemo: () => Promise<void>;
	deleteMemo: (id: string, password: string) => Promise<boolean>;
	resetMemoState: () => void;
	resetMemoCreateState: () => void;

	filteredMemos: Memo[];
	fetchFoldersAndSetFirstMemo: () => Promise<void>;
	setFirstMemoForSelectedFolder: () => void;
	fetchFoldersAndSetSelectedMemo: () => Promise<void>;
	selectMemoIfExists: (id: string) => void;
	fetchFoldersAndSetMemoOnFolderChange: () => Promise<void>;
	updateMemoOnFolderChange: () => void;
	filterMemosByFolder: (folderId: string) => Memo[];
	setNewMemoAndSelect: () => void;
	updateMemosWithNewMemo: (tempMemo: Memo) => void;
	matchesSearchQuery: (memo: Memo) => boolean;
}

export interface FolderListProps {
	folders: Folder[];
	selectedFolder: string;
	setSelectedFolder: React.Dispatch<React.SetStateAction<string>>;
}

export interface SearchInputProps {
	searchQuery: string;
	setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
}

export interface MemoItemProps {
	memo: Memo;
	isActive: boolean;
	setSelectedMemo: React.Dispatch<React.SetStateAction<Memo | null>>;
	folders: Folder[];
}
