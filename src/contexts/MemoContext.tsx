import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { database } from '../services/firebase';
import { ref, onValue, set, remove, update } from 'firebase/database';
import { Folder, Memo, MemoContextProps } from '../types/MemoTypes';

const MemoContext = createContext<MemoContextProps | undefined>(undefined);

export const MemoProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
	const [folders, setFolders] = useState<Folder[]>([]);
	const [memos, setMemos] = useState<Memo[]>([]);
	const [selectedFolder, setSelectedFolder] = useState<number>(1);
	const [selectedMemo, setSelectedMemo] = useState<Memo | null>(null);
	const [searchQuery, setSearchQuery] = useState<string>('');
	const [isCreating, setIsCreating] = useState<boolean>(false);
	const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
	const [showErrorModal, setShowErrorModal] = useState<boolean>(false);
	const [newMemo, setNewMemo] = useState<Memo>({
		title: '새로운 메모',
		content: '작성 중...',
		password: '0000',
		folder_id: selectedFolder,
		created_at: new Date().toISOString(),
		id: 0,
	});

	// 폴더 및 메모 불러오기
	const fetchFoldersAndMemos = () => {
		const folderRef = ref(database, 'folders');
		onValue(folderRef, (snapshot) => {
			const data = snapshot.val();
			setFolders(data ? (Object.values(data) as Folder[]) : []);
		});

		const memoRef = ref(database, `memos/${selectedFolder}`);
		onValue(memoRef, (snapshot) => {
			const data = snapshot.val();
			setMemos(data ? (Object.values(data) as Memo[]) : []);
		});
	};

	// 메모 상태 초기화
	const resetMemoState = () => {
		setSelectedMemo(null);
		setSelectedFolder(1);
		setIsCreating(false);
		setShowPasswordModal(false);
		setShowErrorModal(false);
		setNewMemo({
			title: '',
			content: '',
			password: '',
			folder_id: 1,
			created_at: new Date().toISOString(),
			id: 0,
		});
	};

	// 새 메모 생성 상태 초기화
	const resetMemoCreateState = () => {
		setIsCreating(false);
		setShowPasswordModal(false);
		setShowErrorModal(false);
		setNewMemo({
			title: '',
			content: '',
			password: '',
			folder_id: selectedFolder,
			created_at: new Date().toISOString(),
			id: 0,
		});
	};

	// 새 메모 생성
	const createMemo = async (): Promise<void> => {
		if (!newMemo.title || !newMemo.content || !newMemo.password) {
			setShowErrorModal(true);
			return;
		}

		const id = Date.now();
		const memoRef = ref(database, `memos/${selectedFolder}/${id}`);
		await set(memoRef, { ...newMemo, id, created_at: new Date().toISOString() });
		resetMemoCreateState();
		setMemos((prevMemos) => [{ ...newMemo, id }, ...prevMemos]);
	};

	// 메모 삭제
	const deleteMemo = async (id: string, password: string): Promise<boolean> => {
		const memo = memos.find((m) => m.id === parseInt(id));
		if (memo && memo.password === password) {
			const memoRef = ref(database, `memos/${selectedFolder}/${id}`);
			await remove(memoRef);
			setMemos((prevMemos) => prevMemos.filter((memo) => memo.id !== parseInt(id)));
			return true;
		}
		return false;
	};

	// 메모 업데이트
	const updateMemo = async (id: number, updatedFields: Partial<Memo>): Promise<void> => {
		const memoRef = ref(database, `memos/${selectedFolder}/${id}`);
		await update(memoRef, updatedFields);
		setMemos((prevMemos) => prevMemos.map((memo) => (memo.id === id ? { ...memo, ...updatedFields } : memo)));
	};

	useEffect(() => {
		fetchFoldersAndMemos();
	}, [selectedFolder]);

	// 검색어와 폴더에 맞는 메모 필터링
	const matchesSearchQuery = (memo: Memo) => memo.title.includes(searchQuery) || memo.content.includes(searchQuery);

	const filteredMemos = memos
		.filter((memo) => memo.folder_id === selectedFolder && matchesSearchQuery(memo))
		.sort((a, b) => b.id - a.id);

	return (
		<MemoContext.Provider
			value={{
				folders,
				memos,
				selectedMemo,
				searchQuery,
				selectedFolder,
				isCreating,
				showPasswordModal,
				showErrorModal,
				newMemo,
				setFolders,
				setMemos,
				setSelectedMemo,
				setSearchQuery,
				setSelectedFolder,
				setIsCreating,
				setShowPasswordModal,
				setShowErrorModal,
				setNewMemo,
				createMemo,
				deleteMemo,
				updateMemo,
				resetMemoState,
				resetMemoCreateState,
				filteredMemos,
			}}
		>
			{children}
		</MemoContext.Provider>
	);
};

export const useMemoContext = () => {
	const context = useContext(MemoContext);
	if (!context) {
		throw new Error('useMemoContext must be used within a MemoProvider');
	}
	return context;
};
