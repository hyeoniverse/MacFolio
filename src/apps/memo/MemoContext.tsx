import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Folder, Memo, MemoContextProps } from '@/apps/memo/memo.types';
import { getMemoRepository, MemoRecord } from '@/apps/memo/repository';

const MemoContext = createContext<MemoContextProps | undefined>(undefined);

export const MemoProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
	const [folders, setFolders] = useState<Folder[]>([]);
	const [memos, setMemos] = useState<Memo[]>([]);
	const [selectedFolder, setSelectedFolder] = useState<string>('0');
	const [selectedMemo, setSelectedMemo] = useState<Memo | null>(null);
	const [searchQuery, setSearchQuery] = useState<string>('');
	const [isCreating, setIsCreating] = useState<boolean>(false);
	const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
	const [showErrorModal, setShowErrorModal] = useState<boolean>(false);
	const [newMemo, setNewMemo] = useState<Memo>({
		title: '',
		content: '',
		password: '',
		folder_id: '0',
		date: new Date().toLocaleString('ko-KR'),
		id: '0',
	});

	// 폴더 및 메모 불러오기 (Firebase가 없으면 localStorage)
	const fetchFoldersAndMemos = async () => {
		try {
			const repository = await getMemoRepository();
			const { folders: foldersData, memos: memosData } = await repository.load();

			// 객체 형태를 배열로 변환 (key를 id로 사용)
			const foldersArray: Folder[] = Object.keys(foldersData).map((key) => ({
				id: key,
				title: foldersData[key],
			}));
			setFolders(foldersArray);

			const formattedMemos: Memo[] = Object.keys(memosData)
				.sort((a, b) => Number(b) - Number(a))
				.map((key) => ({
					...memosData[key],
					id: key,
					folder_id: memosData[key].folder_id.toString(),
					date: new Date(memosData[key].created_at).toLocaleString('ko-KR'),
				}));
			setMemos(formattedMemos);
		} catch (error) {
			console.error('Error fetching folders and memos:', error);
		}
	};

	// 메모 상태 초기화
	const resetMemoState = () => {
		setSelectedMemo(null);
		setSelectedFolder('1');
		setIsCreating(false);
		setShowPasswordModal(false);
		setShowErrorModal(false);
		setNewMemo({
			title: '',
			content: '',
			password: '',
			folder_id: '0',
			date: new Date().toLocaleString('ko-KR'),
			id: '0',
		});
		setMemos((prevMemos) => prevMemos.filter((memo) => memo.id !== '0'));
	};

	// 새 메모 생성 상태 초기화
	const resetMemoCreateState = () => {
		setIsCreating(false);
		setShowPasswordModal(false);
		setShowErrorModal(false);
		setMemos((prevMemos) => prevMemos.filter((memo) => memo.id !== '0'));
		setSelectedMemo(null);
		setNewMemo({
			title: '',
			content: '',
			password: '',
			folder_id: selectedFolder,
			date: new Date().toLocaleString('ko-KR'),
			id: '0',
		});
	};

	// 새 메모 생성
	const createMemo = async () => {
		if (!newMemo.title || !newMemo.content || !newMemo.password) {
			setShowErrorModal(true);
			return;
		}
		try {
			const repository = await getMemoRepository();
			// id와 date는 화면용 값이라 저장하지 않는다 (id는 저장소의 key)
			const memoData: MemoRecord = {
				title: newMemo.title,
				content: newMemo.content,
				password: newMemo.password,
				folder_id: selectedFolder,
				created_at: new Date().toISOString(),
			};
			const id = await repository.create(memoData);
			const createdMemo: Memo = {
				...memoData,
				id,
				date: new Date(memoData.created_at).toLocaleString('ko-KR'),
			};
			resetMemoCreateState();
			setMemos((prevMemos) => [createdMemo, ...prevMemos.filter((memo) => memo.id !== '0')]);
			setSelectedMemo(createdMemo);
			console.log('Memo created:', createdMemo);
		} catch (error) {
			console.error('Error saving memo:', error);
		}
	};

	// 메모 삭제
	const deleteMemo = async (id: string, password: string): Promise<boolean> => {
		try {
			const repository = await getMemoRepository();
			const result = await repository.remove(id, password);
			if (result === 'wrong-password') {
				// 비밀번호가 일치하지 않을 경우 에러 모달 표시
				setShowErrorModal(true);
				return false;
			}
			if (result === 'not-found') {
				console.error('Memo not found');
				return false;
			}
			await fetchFoldersAndMemos();
			return true;
		} catch (error) {
			console.error('Error deleting memo:', error);
			return false;
		}
	};

	// 폴더 변경 시 처리
	useEffect(() => {
		// 사용자가 메모를 직접 선택하지 않았고, 작성 중이 아닐 때만 자동 선택
		if (!selectedMemo && !isCreating) {
			const folderMemos = filterMemosByFolder(selectedFolder);
			if (folderMemos.length > 0) {
				setSelectedMemo(folderMemos[0]); // 최상단 메모 선택
			}
		}
	}, [selectedFolder, selectedMemo, isCreating, memos]);

	// 메모 편집 중 리스트 동기화
	useEffect(() => {
		if (selectedMemo && selectedMemo.id === newMemo.id) {
			setMemos((prevMemos) => prevMemos.map((memo) => (memo.id === newMemo.id ? { ...memo, ...newMemo } : memo)));
		}
	}, [newMemo, selectedMemo]);

	// 폴더와 메모 변경 처리
	const fetchFoldersAndSetFirstMemo = async () => {
		await fetchFoldersAndMemos();
		setFirstMemoForSelectedFolder();
	};

	const setFirstMemoForSelectedFolder = () => {
		const folderMemos = filterMemosByFolder(selectedFolder);
		setSelectedMemo(folderMemos.length ? folderMemos[0] : null);
	};

	const fetchFoldersAndSetSelectedMemo = async () => {
		await fetchFoldersAndMemos();
		selectMemoIfExists();
	};

	const selectMemoIfExists = () => {
		const selectedMemoExists = memos.find((memo) => memo.id === selectedMemo?.id);
		if (selectedMemoExists) setSelectedMemo(selectedMemoExists);
	};

	const fetchFoldersAndSetMemoOnFolderChange = async () => {
		await fetchFoldersAndMemos();

		// 새로운 메모를 작성 중이면 기존 로직 유지
		if (isCreating) {
			setNewMemo((prevMemo) => ({ ...prevMemo, folder_id: selectedFolder }));
		} else {
			// 새 메모 작성 중이 아닐 때 최상단 메모 자동 선택
			const folderMemos = filterMemosByFolder(selectedFolder);
			setSelectedMemo(folderMemos.length ? folderMemos[0] : null);
		}
	};

	const updateMemoOnFolderChange = () => {
		const folderMemos = filterMemosByFolder(selectedFolder);
		if (!isCreating) {
			setSelectedMemo(folderMemos.length ? folderMemos[0] : null);
		} else {
			setNewMemoAndSelect();
		}
	};

	const filterMemosByFolder = (folderId: string) =>
		folderId === '1' ? memos : memos.filter((memo) => memo.folder_id === folderId);

	const setNewMemoAndSelect = () => {
		const tempMemo = { ...newMemo, folder_id: selectedFolder };
		updateMemosWithNewMemo(tempMemo);
	};

	const updateMemosWithNewMemo = (tempMemo: Memo) => {
		setMemos([tempMemo, ...memos.filter((memo) => memo.id !== newMemo.id)]);
		setSelectedMemo(tempMemo);
	};

	// 검색어와 폴더에 맞는 메모 필터링
	const matchesSearchQuery = (memo: Memo) =>
		(memo.title?.includes(searchQuery) || '') !== '' || (memo.content?.includes(searchQuery) || '') !== '';

	const filteredMemos = memos
		.filter((memo) => {
			const isInSelectedFolder = selectedFolder === '1' || memo.folder_id === selectedFolder;
			return isInSelectedFolder && matchesSearchQuery(memo);
		})
		.sort((a, b) => {
			// 임시 메모(id === '0')를 항상 최상단에
			if (a.id === '0') return -1;
			if (b.id === '0') return 1;
			// 고정 메모(id === '1')를 그 다음에 위치
			if (a.id === '1') return -1;
			if (b.id === '1') return 1;
			// 그 외 메모는 id 기준 내림차순 정렬
			return Number(b.id) - Number(a.id);
		});

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
				fetchFoldersAndMemos,
				createMemo,
				deleteMemo,
				resetMemoState,
				resetMemoCreateState,
				filteredMemos,
				fetchFoldersAndSetFirstMemo,
				setFirstMemoForSelectedFolder,
				fetchFoldersAndSetSelectedMemo,
				selectMemoIfExists,
				fetchFoldersAndSetMemoOnFolderChange,
				updateMemoOnFolderChange,
				filterMemosByFolder,
				setNewMemoAndSelect,
				updateMemosWithNewMemo,
				matchesSearchQuery,
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
