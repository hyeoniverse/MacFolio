export interface Folder {
	id: number;
	title: string;
}

export interface Memo {
	id: number;
	title: string;
	content: string;
	password: string;
	folder_id: number;
	created_at: string;
}

export interface MemoContextProps {
	folders: Folder[];
	memos: Memo[];
	selectedMemo: Memo | null;
	searchQuery: string;
	selectedFolder: number;
	isCreating: boolean;
	showPasswordModal: boolean;
	showErrorModal: boolean;
	newMemo: Memo;
	setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
	setMemos: React.Dispatch<React.SetStateAction<Memo[]>>;
	setSelectedMemo: React.Dispatch<React.SetStateAction<Memo | null>>;
	setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
	setSelectedFolder: React.Dispatch<React.SetStateAction<number>>;
	setIsCreating: React.Dispatch<React.SetStateAction<boolean>>;
	setShowPasswordModal: React.Dispatch<React.SetStateAction<boolean>>;
	setShowErrorModal: React.Dispatch<React.SetStateAction<boolean>>;
	setNewMemo: React.Dispatch<React.SetStateAction<Memo>>;
	createMemo: () => Promise<void>;
	deleteMemo: (id: string, password: string) => Promise<boolean>;
	updateMemo: (id: number, updatedFields: Partial<Memo>) => Promise<void>;
	resetMemoState: () => void;
	resetMemoCreateState: () => void;
	filteredMemos: Memo[];
}

export interface FolderListProps {
	folders: Folder[];
	selectedFolder: number;
	setSelectedFolder: React.Dispatch<React.SetStateAction<number>>;
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
