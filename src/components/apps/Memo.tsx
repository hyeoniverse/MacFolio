import React, { useState, useEffect, useRef } from 'react';
import { useAppState } from '../../contexts/AppContext';
import { useMemoContext } from '../../contexts/MemoContext';
import { database } from '../../services/firebase';
import { ref, onValue, set, remove, update } from 'firebase/database';
import { Folder as FolderT } from '../../types/MemoTypes';
import { Memo as MemoT } from '../../types/MemoTypes';

import '../../styles/Memo.css';
import Container from '../common/Container';
import Modal from '../common/Modal';
import { ScrollArea } from '../common/ScrollArea';
import { Trash2, Type, AlignLeft, Grid, Share, PenBox } from 'lucide-react';

import SearchInput from './memo/SearchInput';
import FolderList from './memo/FolderList';
import MemoItem from './memo/MemoItem';

const Memo: React.FC = () => {
	const { apps } = useAppState();
	const {
		selectedFolder,
		selectedMemo,
		searchQuery,
		isCreating,
		showPasswordModal,
		showErrorModal,
		setSearchQuery,
		setSelectedFolder,
		setSelectedMemo,
		setIsCreating,
		setShowPasswordModal,
		setShowErrorModal,
		filteredMemos,
	} = useMemoContext();

	const memoAppState = apps['memo'];
	const isRunning = memoAppState.isRunning;
	const isMinimized = memoAppState.isMinimized;

	const [isScrolled, setIsScrolled] = useState(false);
	const [folders, setFolders] = useState<FolderT[]>([]);
	const [memos, setMemos] = useState<MemoT[]>([]);
	const [newMemo, setNewMemo] = useState<MemoT>({
		id: 0,
		title: '',
		content: '',
		created_at: '',
		folder_id: selectedFolder,
		password: '',
	});
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [deletePassword, setDeletePassword] = useState('');
	const [showFailureModal, setShowFailureModal] = useState(false);
	const [showSuccessModal, setShowSuccessModal] = useState(false);

	const handleAppStateChange = () => {
		if (!isRunning) {
			setFolders([]);
			setMemos([]);
		} else if (isRunning && !isMinimized) {
			fetchFolders();
			fetchMemos(selectedFolder);
		}
	};

	useEffect(() => {
		// 선택된 폴더가 변경될 때마다 새 데이터를 자동으로 가져옵니다.
		if (!selectedFolder) return;
		console.log(`폴더 ${selectedFolder} 데이터를 불러옵니다.`);
	}, [selectedFolder]);

	const fetchFolders = () => {
		const folderRef = ref(database, 'folders');
		onValue(folderRef, (snapshot) => {
			const data = snapshot.val();
			setFolders(data ? (Object.values(data) as FolderT[]) : []);

			console.log('폴더 데이터를 불러왔습니다.', folders);
		});
	};

	const fetchMemos = (folderId: number) => {
		if (folderId === 0) return;
		const memoRef = ref(database, `memos/${folderId}`);
		onValue(memoRef, (snapshot) => {
			const data = snapshot.val();
			setMemos(data ? (Object.values(data) as MemoT[]) : []);
		});
	};

	useEffect(() => {
		handleAppStateChange();
	}, [isRunning, isMinimized]);

	useEffect(() => {
		fetchMemos(selectedFolder);
	}, [selectedFolder]);

	const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
		setIsScrolled(event.currentTarget.scrollTop > 50);
	};

	const handleCreateMemo = () => {
		const id = Date.now();
		const memoRef = ref(database, `memos/${selectedFolder}/${id}`);
		set(memoRef, {
			...newMemo,
			id,
			folder_id: selectedFolder,
			created_at: new Date().toISOString(),
		});
		setNewMemo({
			id: 0,
			title: '',
			content: '',
			created_at: '',
			folder_id: selectedFolder,
			password: '',
		});
	};

	const handleDeleteMemo = (id: number, password: string) => {
		const memoRef = ref(database, `memos/${selectedFolder}/${id}`);
		remove(memoRef)
			.then(() => {
				setShowSuccessModal(true);
			})
			.catch(() => {
				setShowFailureModal(true);
			});
	};

	const handleUpdateMemo = (id: number, updatedFields: Partial<MemoT>) => {
		const memoRef = ref(database, `memos/${selectedFolder}/${id}`);
		update(memoRef, updatedFields);
	};

	if (!isRunning || isMinimized) return null;

	const handleAddTempMemo = () => {
		setIsCreating(true);
		setSelectedMemo({
			id: 0,
			title: '',
			content: '',
			created_at: '',
			folder_id: selectedFolder,
			password: '',
		});
	};

	function handlePasswordChange(event: React.ChangeEvent<HTMLInputElement>): void {
		setNewMemo({ ...newMemo, password: event.target.value });
	}

	return (
		<Container title="Memo" appName="memo">
			<div className="memo-container">
				<FolderList folders={folders} selectedFolder={selectedFolder} setSelectedFolder={setSelectedFolder} />

				<div className="notes-list">
					<SearchInput searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
					<ScrollArea className="h-[calc(100vh-60px)]">
						{filteredMemos.length === 0 ? (
							<p className="no-notes">검색 결과가 없습니다.</p>
						) : (
							filteredMemos.map((memo) => (
								<MemoItem
									key={memo.id}
									memo={{
										...memo,
										title: memo.title || '새로운 메모',
										content: memo.content || '작성 중...',
									}}
									isActive={selectedMemo?.id === memo.id}
									setSelectedMemo={setSelectedMemo}
									folders={folders}
								/>
							))
						)}
					</ScrollArea>
				</div>

				<div className="memo-content" onScroll={handleScroll}>
					<div
						className={`memo-tools ${isScrolled ? 'scrolled' : ''}`}
						style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem' }}
					>
						{isCreating ? (
							<div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
								<button onClick={() => handleDeleteMemo(selectedMemo?.id || 0, deletePassword)}>
									<i
										className="fa-solid fa-delete-left"
										style={{ fontSize: '1.2rem', color: '#edbb4d' }}
									></i>
								</button>
								<button
									onClick={() => {
										if (!newMemo.title || !newMemo.content) {
											setShowErrorModal(true);
										} else {
											setShowPasswordModal(true);
										}
									}}
									style={{ marginLeft: 'auto' }}
								>
									<i
										className="fa-solid fa-check"
										style={{
											fontSize: '1.2rem',
											color: newMemo.title && newMemo.content ? '#edbb4d' : 'gray',
										}}
									></i>
								</button>
							</div>
						) : (
							<>
								<div>
									<button
										onClick={() => {
											if (!selectedMemo?.id) return;
											setShowDeleteModal(true);
										}}
									>
										<Trash2 className="icon" />
									</button>
								</div>
								<div className="center-tools">
									<button>
										<Type className="icon" />
									</button>
									<button>
										<AlignLeft className="icon" />
									</button>
									<button>
										<Grid className="icon" />
									</button>
								</div>
								<div>
									<button>
										<Share className="icon" />
									</button>
									<button onClick={handleAddTempMemo}>
										<PenBox className="icon" />
									</button>
								</div>
							</>
						)}
					</div>

					{isCreating ? (
						<div className="create-memo">
							<input
								type="text"
								placeholder="닉네임이나 제목을 입력해주세요"
								value={newMemo.title}
								onChange={(e) => setNewMemo({ ...newMemo, title: e.target.value })}
								className="create-memo-title"
							/>
							<textarea
								placeholder="메모 내용을 입력하세요."
								value={newMemo.content}
								onChange={(e) => setNewMemo({ ...newMemo, content: e.target.value })}
								className="create-memo-content"
							/>

							{showPasswordModal && (
								<Modal title="비밀번호 입력" onClose={() => setShowPasswordModal(false)}>
									<p>비밀번호는 최대 20자까지 입력 가능합니다.</p>
									<input
										type="password"
										placeholder="삭제 시 이용할 비밀번호를 입력해주세요"
										value={newMemo.password}
										onChange={handlePasswordChange}
									/>
									<div style={{ display: 'flex', gap: '1rem' }}>
										<button onClick={handleCreateMemo}>확인</button>
										<button onClick={() => setShowPasswordModal(false)}>취소</button>
									</div>
								</Modal>
							)}

							{showErrorModal && (
								<Modal title="에러" onClose={() => setShowErrorModal(false)}>
									<p>제목과 내용을 입력해 주세요</p>
									<button onClick={() => setShowErrorModal(false)}>확인</button>
								</Modal>
							)}
						</div>
					) : (
						selectedMemo && (
							<div className="memo-view">
								<h2 className="text-2xl font-bold mb-4">{selectedMemo.title}</h2>
								<p className="whitespace-pre-wrap">{selectedMemo.content}</p>
							</div>
						)
					)}
				</div>
			</div>

			{showDeleteModal && (
				<Modal title="메모 삭제" onClose={() => setShowDeleteModal(false)}>
					<input
						type="password"
						placeholder="비밀번호를 입력해주세요"
						value={deletePassword}
						onChange={(e) => setDeletePassword(e.target.value)}
					/>
					<div style={{ display: 'flex', gap: '1rem' }}>
						<button
							onClick={() => {
								handleDeleteMemo(selectedMemo?.id || 0, deletePassword);
								setDeletePassword('');
								setShowDeleteModal(false);
							}}
						>
							삭제
						</button>
						<button
							onClick={() => {
								setDeletePassword('');
								setShowDeleteModal(false);
							}}
						>
							취소
						</button>
					</div>
				</Modal>
			)}

			{showFailureModal && (
				<Modal title="메모 삭제 실패" onClose={() => setShowFailureModal(false)}>
					<div
						style={{
							display: 'flex',
							flexDirection: 'column',
							justifyContent: 'center',
							alignItems: 'center',
							gap: '0.5rem',
						}}
					>
						<p style={{ textAlign: 'left' }}>메모가 삭제에 실패했습니다.</p>
						<button onClick={() => setShowFailureModal(false)}>확인</button>
					</div>
				</Modal>
			)}

			{showSuccessModal && (
				<Modal title="메모 삭제 완료" onClose={() => setShowDeleteModal(false)}>
					<div
						style={{
							display: 'flex',
							flexDirection: 'column',
							justifyContent: 'center',
							alignItems: 'center',
							gap: '0.5rem',
						}}
					>
						<p style={{ textAlign: 'left' }}>메모가 성공적으로 삭제되었습니다.</p>
						<button onClick={() => setShowSuccessModal(false)}>확인</button>
					</div>
				</Modal>
			)}
		</Container>
	);
};

export default Memo;
