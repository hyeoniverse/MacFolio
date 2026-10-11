import { useState, type ReactNode } from 'react';
import IconButton from '@/shared/ui/button/IconButton';
import Menu from '@/shared/ui/menu/Menu';
import type { FolderPath, Post } from '@macfolio/desktop-core/memo';
import type { View } from './MemoToolbar';
import FolderPickMenu from './FolderPickMenu';

/**
 * 휴대폰 목록의 떠 있는 막대 (iOS 메모): 오른쪽 위에 정렬·••• (메모 선택 중이면 완료),
 * 아래에 검색 알약과 새 메모 (메모 선택 중이면 이동·몇 개 선택됨·삭제). 넘기는 칸 밖에 두어 늘 제자리다
 */
const PhoneListBars = ({
	picked,
	pickedPosts,
	canPick,
	onStartPicking,
	onStopPicking,
	onMovePicked,
	onDeletePicked,
	folderPaths,
	sort,
	search,
	canEdit,
	view,
	onView,
	onShowAttachments,
	onNewNote,
}: {
	/** 메모 선택 중이면 고른 메모들, 아니면 null */
	picked: Set<string> | null;
	pickedPosts: Post[];
	/** 메모 선택을 쓸 수 있는지 (관리자, 최근 삭제된 항목이 아닐 때) */
	canPick: boolean;
	onStartPicking: () => void;
	onStopPicking: () => void;
	onMovePicked: (path: FolderPath) => void;
	onDeletePicked: () => void;
	folderPaths: FolderPath[];
	sort: ReactNode;
	search: ReactNode;
	canEdit: boolean;
	view: View;
	onView: (view: View) => void;
	onShowAttachments: () => void;
	onNewNote: () => void;
}) => {
	/** ••• 메뉴와 고른 메모를 옮길 폴더 메뉴를 연 자리 */
	const [listMenu, setListMenu] = useState<{ x: number; y: number } | null>(null);
	const [moveMenu, setMoveMenu] = useState<{ x: number; y: number } | null>(null);
	return (
		<>
			<div className="memo-phone-list-top">
				{picked ? (
					<button type="button" className="memo-phone-pill" onClick={onStopPicking}>
						완료
					</button>
				) : (
					<>
						{sort}
						<IconButton
							className="memo-phone-list-more"
							label="목록 동작"
							aria-haspopup="menu"
							aria-expanded={listMenu !== null}
							onClick={(event) => {
								const rect = event.currentTarget.getBoundingClientRect();
								setListMenu(listMenu ? null : { x: rect.right - 250, y: rect.bottom + 8 });
							}}
							icon="fa-solid fa-ellipsis"
						/>
					</>
				)}
			</div>
			<div className="memo-phone-bottom memo-list-bottom">
				{picked ? (
					<>
						<button
							type="button"
							className="memo-phone-pill"
							disabled={pickedPosts.length === 0}
							onClick={(event) => {
								const rect = event.currentTarget.getBoundingClientRect();
								setMoveMenu({ x: rect.left, y: rect.top - 8 });
							}}
						>
							이동
						</button>
						<span className="memo-pick-count" role="status">
							{pickedPosts.length > 0 ? `${pickedPosts.length}개 선택됨` : '메모 선택'}
						</span>
						<button
							type="button"
							className="memo-phone-pill destructive"
							disabled={pickedPosts.every((post) => post.locked)}
							onClick={onDeletePicked}
						>
							삭제
						</button>
					</>
				) : (
					<>
						{search}
						{canEdit && (
							<IconButton
								className="memo-phone-compose"
								label="새 메모"
								onClick={onNewNote}
								icon="fa-regular fa-pen-to-square"
							/>
						)}
					</>
				)}
			</div>
			{/* ••• 메뉴 (iOS 메모처럼): 갤러리로 보기, 메모 선택, 첨부 파일 보기 */}
			{listMenu && (
				<Menu
					label="목록 동작"
					className="touch"
					anchor={listMenu}
					onClose={() => setListMenu(null)}
					items={[
						view === 'gallery'
							? { label: '목록으로 보기', icon: 'fa-solid fa-list-ul', onSelect: () => onView('list') }
							: { label: '갤러리로 보기', icon: 'fa-solid fa-table-cells-large', onSelect: () => onView('gallery') },
						'separator',
						...(canPick ? [{ label: '메모 선택', icon: 'fa-regular fa-circle-check', onSelect: onStartPicking }] : []),
						{ label: '첨부 파일 보기', icon: 'fa-solid fa-paperclip', onSelect: onShowAttachments },
					]}
				/>
			)}
			{moveMenu && (
				<FolderPickMenu anchor={moveMenu} paths={folderPaths} onClose={() => setMoveMenu(null)} onPick={onMovePicked} />
			)}
		</>
	);
};

export default PhoneListBars;
