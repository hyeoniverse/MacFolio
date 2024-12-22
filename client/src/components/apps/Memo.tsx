import React, { useState, useEffect, useRef } from 'react';
import { useAppState } from '../../contexts/AppContext';
import { useMemoContext } from '../../contexts/MemoContext';
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
		memos,
		folders,
		selectedFolder,
		selectedMemo,
		searchQuery,
		isCreating,
		newMemo,
		showPasswordModal,
		showErrorModal,
		setSearchQuery,
		setSelectedFolder,
		setMemos,
		setSelectedMemo,
		setIsCreating,
		setNewMemo,
		setShowPasswordModal,
		setShowErrorModal,
		createMemo,
		deleteMemo,
		resetMemoState,
		resetMemoCreateState,

		filteredMemos,
		fetchFoldersAndSetFirstMemo,
		fetchFoldersAndSetSelectedMemo,
	} = useMemoContext();

	const memoAppState = apps['memo'];
	const isRunning = memoAppState.isRunning;
	const isMinimized = memoAppState.isMinimized;
	const [isScrolled, setIsScrolled] = useState(false);
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [deletePassword, setDeletePassword] = useState('');
	const [showFailureModal, setShowFailureModal] = useState(false);
	const [showSuccessModal, setShowSuccessModal] = useState(false);

	// 앱 상태 변경 시 처리
	useEffect(() => {
		handleAppStateChange();
	}, [isRunning, isMinimized]);

	useEffect(() => {
		if (isCreating) {
			// 폴더 변경 시 새로운 폴더 ID를 반영하여 임시 메모를 생성
			setNewMemo((prev) => ({ ...prev, folder_id: selectedFolder }));
		}
	}, [selectedFolder, isCreating]);

	const handleAppStateChange = () => {
		if (!isRunning) resetMemoState();
		if (isRunning && !isMinimized) {
			fetchFoldersAndSetFirstMemo();
			fetchFoldersAndSetSelectedMemo();
		}
	};

	const handleResetMemo = () => {
		resetMemoCreateState();
		setSelectedMemo(memos.find((memo) => memo.id !== 0 && memo.folder_id === selectedFolder) || null);
	};

	const handleCreateMemo = async () => {
		await createMemo();
	};

	const handleAddTempMemo = () => {
		setIsCreating(true);
		const tempMemo = {
			id: 0,
			title: '새로운 메모',
			content: '작성 중...',
			date: new Date().toLocaleString(),
			folder_id: selectedFolder,
		};

		// 임시 메모를 최상단에 추가하면서 기존 메모들을 유지
		setMemos((prevMemos) => {
			// 고정 메모(id === 1)를 유지하고 임시 메모를 최상단에 추가
			const fixedMemos = prevMemos.filter((memo) => memo.id === 1);
			const otherMemos = prevMemos.filter((memo) => memo.id !== 1 && memo.id !== 0);

			// 임시 메모를 최상단에 추가하고 나머지 메모들을 뒤에 위치
			return [tempMemo, ...fixedMemos, ...otherMemos];
		});

		// 임시 메모를 선택
		setSelectedMemo(tempMemo);
	};

	const handleDeleteMemo = async (id: number, password: string) => {
		const result = await deleteMemo(id.toString(), password);
		setDeletePassword('');

		if (result) {
			setShowSuccessModal(true);

			// 메모 삭제 후 선택된 폴더의 최신 메모 선택 (고정 메모 제외)
			const updatedMemos = memos.filter((memo) => memo.id !== id); // 삭제된 메모를 제외
			setMemos(updatedMemos); // 최신 메모 목록 업데이트

			const folderMemos = updatedMemos
				.filter((memo) => memo.folder_id === selectedFolder && memo.id !== 1) // 고정 메모 제외
				.sort((a, b) => b.id - a.id); // 최신 메모가 가장 앞에 오도록 정렬

			setSelectedMemo(folderMemos.length > 0 ? folderMemos[0] : null); // 최신 메모 선택
		} else {
			setShowFailureModal(true);
		}
	};

	const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const input = e.target.value;
		if (input.length <= 20) {
			setNewMemo({ ...newMemo, password: input });
		}
	};

	const handleScroll = (event: React.UIEvent<HTMLDivElement>) => setIsScrolled(event.currentTarget.scrollTop > 50);

	if (!isRunning || isMinimized) return null;

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
								<button onClick={handleResetMemo}>
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
