import { cssVars } from '@/shared/lib/cssVars';
import React, { useState } from 'react';
import Menu from '@/shared/ui/menu/Menu';
import { startPointerReorder } from '@/shared/ui/reorder/pointerReorder';
import {
	ALL_CATEGORY,
	POPULAR_VIEW,
	canAddFolder,
	type FolderNode,
	RECENTLY_DELETED,
	type FolderPath,
} from '@macfolio/desktop-core/memo';
import TagChips from './TagChips';
import { SidebarToggle } from './MemoToolbar';
import IconButton from '@/shared/ui/button/IconButton';
import { useDropTarget } from './useDropTarget';
import { FolderIcon, FolderNameInput } from './FolderNameInput';
import { DEPTH_LIMIT_HINT, type FolderSidebarProps } from './folderSidebar.model';
import { FolderRow } from './FolderRow';

/** 트리에서 경로의 폴더를 찾는다 */
const findNode = (nodes: FolderNode[], path: string): FolderNode | null => {
	for (const node of nodes) {
		if (node.path === path) return node;
		const found = findNode(node.children, path);
		if (found) return found;
	}
	return null;
};

/**
 * 폴더 사이드바 (창 안에 떠 있는 패널). macOS 메모처럼 위쪽에 신호등 버튼 자리, 새로운 폴더, 사이드바 여닫기가 있다.
 * 폴더를 고른 채 새로운 폴더를 누르면 그 폴더 안에 만든다. 폴더에 마우스를 올리면 ••• 메뉴(이름 변경, 삭제, 새로운 폴더).
 * 폴더와 글은 끌어서 다른 폴더로 옮긴다. 방문자가 정리한 내용은 이 브라우저에만 저장된다.
 */
const FolderSidebar: React.FC<FolderSidebarProps> = (props) => {
	const { open, onToggle, folders, total, current, onSelect, onAddFolder } = props;
	const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
	/** 새 폴더를 만드는 중인 부모 ('' = 맨 위, null = 만드는 중 아님) */
	const [addingUnder, setAddingUnder] = useState<string | null>(null);
	const rootDrop = useDropTarget(ALL_CATEGORY, props);
	const trashDrop = useDropTarget(RECENTLY_DELETED, props);
	/** 최근 삭제된 항목의 메뉴를 연 자리 (null이면 닫힘) */
	const [trashMenuAt, setTrashMenuAt] = useState<{ x: number; y: number } | null>(null);
	/** '선택된 태그 중 모두/일부 포함' 메뉴를 연 자리 */
	const [matchMenuAt, setMatchMenuAt] = useState<{ x: number; y: number } | null>(null);
	/** 휴대폰에서 '블로그' 묶음 접기 (iOS 메모의 'iCloud' 옆 화살표) */
	const [blogOpen, setBlogOpen] = useState(true);
	/** 휴대폰 폴더 화면의 편집 (iOS 메모의 '편집' → ✓) */
	const [editing, setEditing] = useState(false);
	const movePaths: string[] = [];
	const walkPaths = (nodes: FolderNode[]) =>
		nodes.forEach((node) => {
			movePaths.push(node.path);
			walkPaths(node.children);
		});
	walkPaths(folders);

	/** 같은 층 폴더 경로 (지금 보이는 순서) */
	const siblingsOf = (path: string) => {
		const parent = path.split('/').slice(0, -1).join('/');
		return (parent ? (findNode(folders, parent)?.children ?? []) : folders).map((node) => node.path);
	};
	/** ↑·↓ 키: 한 칸씩 */
	const reorderStep = (path: FolderPath, delta: number) => {
		const siblings = siblingsOf(path);
		const from = siblings.indexOf(path);
		const to = from + delta;
		if (from === -1 || to < 0 || to >= siblings.length) return;
		const next = [...siblings];
		[next[from], next[to]] = [next[to], next[from]];
		props.onReorderFolders?.(next);
	};
	/**
	 * ≡ 끌기 (iOS 메모처럼, shared/ui/reorder): 놓으면 같은 층의 새 순서를 저장한다.
	 * 다른 층으로는 옮기지 않는다 ('이 폴더 이동'이나 끌어 놓기)
	 */
	const reorderStart = (event: React.PointerEvent<HTMLButtonElement>) =>
		startPointerReorder(
			event,
			(from, to, items) => {
				const next = items.map((el) => el.dataset.folderPath as FolderPath);
				next.splice(to, 0, ...next.splice(from, 1));
				props.onReorderFolders?.(next);
			},
			(el) => !!el.dataset.folderPath
		);

	const toggleFolder = (path: string) =>
		setCollapsed((prev) => {
			const next = new Set(prev);
			if (next.has(path)) next.delete(path);
			else next.add(path);
			return next;
		});

	const parentNode = addingUnder ? findNode(folders, addingUnder) : null;
	/** 새로운 폴더를 만들 자리: 고른 폴더 안 (모든 글이면 맨 위) */
	const parentOfNew = current === ALL_CATEGORY ? '' : current;
	const newFolderInput =
		addingUnder === null ? null : (
			<li className="memo-new-folder">
				<FolderNameInput
					key={addingUnder}
					depth={addingUnder ? addingUnder.split('/').length : 0}
					label="새로운 폴더 이름"
					siblings={(parentNode ? parentNode.children : folders).map((node) => node.name)}
					onSubmit={(name) => {
						onAddFolder(addingUnder, name);
						setAddingUnder(null);
					}}
					onCancel={() => setAddingUnder(null)}
				/>
			</li>
		);

	return (
		<nav className={`memo-folders ${editing ? 'editing' : ''}`} aria-label="카테고리" inert={!open}>
			{/* 신호등 버튼 바로 옆에 여닫기 (접었을 때와 같은 자리), 오른쪽 끝에 새로운 폴더 */}
			<div className="memo-sidebar-bar">
				<span className="memo-lights-space" aria-hidden="true" />
				<SidebarToggle open onToggle={onToggle} />
				{props.canEdit && props.onNewNote && (
					<IconButton
						className="memo-new-note-button"
						label="새 메모"
						onClick={props.onNewNote}
						icon="fa-regular fa-pen-to-square"
					/>
				)}
				{props.canEdit && (
					<IconButton
						className="memo-new-folder-button"
						label="새로운 폴더"
						disabled={!canAddFolder(parentOfNew)}
						title={
							!canAddFolder(parentOfNew)
								? DEPTH_LIMIT_HINT
								: parentOfNew
									? `'${parentOfNew.split('/').at(-1)}' 안에 새로운 폴더`
									: '새로운 폴더'
						}
						onClick={() => setAddingUnder(parentOfNew)}
						icon="fa-solid fa-folder-plus"
					/>
				)}
				{props.canEdit && (
					<button
						type="button"
						className={`memo-folders-edit ${editing ? 'done' : ''}`}
						aria-label={editing ? '편집 완료' : '폴더 편집'}
						aria-pressed={editing}
						onClick={() => setEditing(!editing)}
					>
						{editing ? <i className="fa-solid fa-check" aria-hidden="true" /> : '편집'}
					</button>
				)}
			</div>

			<div className="memo-folder-scroll">
				{/* 휴대폰: iOS 메모처럼 큰 제목, 묶음 이름 옆에 접기 단추 */}
				<p className="memo-phone-title" aria-hidden="true">
					폴더
				</p>
				<div className="memo-folder-group-head">
					<h2>블로그</h2>
					<button
						type="button"
						className={`memo-folder-group-toggle ${blogOpen ? 'open' : ''}`}
						aria-label={`블로그 ${blogOpen ? '접기' : '펼치기'}`}
						aria-expanded={blogOpen}
						onClick={() => setBlogOpen(!blogOpen)}
					>
						<i className="fa-solid fa-chevron-down" aria-hidden="true" />
					</button>
				</div>
				<ul className="memo-subfolders" hidden={!blogOpen}>
					<li>
						{/* 모든 글: 폴더를 여기에 놓으면 맨 위로 옮겨 간다 */}
						<div
							className={`memo-folder-row ${rootDrop.active ? 'drop-target' : ''}`}
							style={cssVars({ depth: 0 })}
							{...rootDrop.handlers}
						>
							<span className="memo-disclosure" aria-hidden="true" />
							<button
								type="button"
								className={`memo-folder ${current === ALL_CATEGORY ? 'active' : ''}`}
								aria-current={current === ALL_CATEGORY || undefined}
								disabled={editing}
								onClick={() => onSelect(ALL_CATEGORY)}
							>
								<FolderIcon />
								<span className="memo-folder-name">{ALL_CATEGORY}</span>
								<span className="memo-count">{total}</span>
							</button>
						</div>
					</li>
					{/* 인기글: 조회·댓글·좋아요로 고른 10개 (폴더가 아니라 보기라서 끌어 놓을 수 없다) */}
					{props.popular != null && (
						<li>
							<div className="memo-folder-row" style={cssVars({ depth: 0 })}>
								<span className="memo-disclosure" aria-hidden="true" />
								<button
									type="button"
									className={`memo-folder memo-popular-folder ${current === POPULAR_VIEW ? 'active' : ''}`}
									aria-current={current === POPULAR_VIEW || undefined}
									disabled={editing}
									onClick={() => onSelect(POPULAR_VIEW)}
								>
									<FolderIcon />
									<span className="memo-folder-name">인기글</span>
									<span className="memo-count">{props.popular}</span>
								</button>
							</div>
						</li>
					)}
					{folders.map((node) => (
						<FolderRow
							key={node.path}
							{...props}
							node={node}
							depth={0}
							siblings={folders.map((n) => n.name)}
							collapsed={collapsed}
							onToggle={toggleFolder}
							addingUnder={addingUnder}
							onStartAdding={setAddingUnder}
							newFolderInput={newFolderInput}
							editing={editing}
							movePaths={movePaths}
							onReorderStart={props.onReorderFolders ? reorderStart : undefined}
							onReorderStep={reorderStep}
						/>
					))}
					{addingUnder === '' && newFolderInput}
					{/* 최근 삭제된 항목: macOS 메모처럼 폴더 목록 맨 아래. 글을 끌어 놓으면 지운다 (폴더는 놓을 수 없다) */}
					{/* 비어 있으면 숨기되, 글을 끄는 동안에는 놓을 자리로 보인다 */}
					{((props.recentlyDeleted ?? 0) > 0 || props.dragging?.type === 'post') && (
						<li>
							<div
								className={`memo-folder-row ${trashDrop.active ? 'drop-target' : ''} ${trashMenuAt ? 'menu-open' : ''}`}
								style={cssVars({ depth: 0 })}
								onContextMenu={
									props.canEdit && props.onEmptyTrash
										? (event) => {
												event.preventDefault();
												setTrashMenuAt({ x: event.clientX, y: event.clientY });
											}
										: undefined
								}
								{...trashDrop.handlers}
							>
								<span className="memo-disclosure" aria-hidden="true" />
								<button
									type="button"
									className={`memo-folder ${current === RECENTLY_DELETED ? 'active' : ''}`}
									aria-current={current === RECENTLY_DELETED || undefined}
									disabled={editing}
									onClick={() => onSelect(RECENTLY_DELETED)}
								>
									<i className="fa-regular fa-trash-can memo-folder-icon" aria-hidden="true" />
									<span className="memo-folder-name">최근 삭제된 항목</span>
									{(props.recentlyDeleted ?? 0) > 0 && <span className="memo-count">{props.recentlyDeleted}</span>}
								</button>
								{props.canEdit && props.onEmptyTrash && (
									<button
										type="button"
										className="memo-folder-more"
										aria-label="휴지통 동작"
										aria-haspopup="menu"
										aria-expanded={trashMenuAt !== null}
										onClick={(event) => {
											const rect = event.currentTarget.getBoundingClientRect();
											setTrashMenuAt(trashMenuAt ? null : { x: rect.left, y: rect.bottom + 4 });
										}}
									>
										<i className="fa-solid fa-ellipsis" aria-hidden="true" />
									</button>
								)}
								{trashMenuAt && props.onEmptyTrash && (
									<Menu
										label="휴지통 메뉴"
										anchor={trashMenuAt}
										onClose={() => setTrashMenuAt(null)}
										items={[
											{
												label: '휴지통 비우기',
												icon: 'fa-regular fa-trash-can',
												destructive: true,
												disabled: (props.recentlyDeleted ?? 0) === 0,
												onSelect: props.onEmptyTrash,
											},
										]}
									/>
								)}
							</div>
						</li>
					)}
				</ul>
				{/* 태그: macOS 메모처럼 폴더 아래에. 누를 때마다 미선택 → 포함(채운 칩) → 제외(테두리·취소선) */}
				{props.tags && props.tags.length > 0 && props.tagSelection && props.onTagsChange && (
					<section className="memo-tag-browser" aria-label="태그">
						<div className="memo-tag-head">
							<h3>태그</h3>
							{/* 태그를 둘 이상 고르면: 모두 포함(그리고)인지 일부 포함(또는)인지 */}
							{Object.keys(props.tagSelection.tags).length >= 2 && (
								<button
									type="button"
									className="memo-tag-match"
									aria-haspopup="menu"
									aria-expanded={matchMenuAt !== null}
									onClick={(event) => {
										const rect = event.currentTarget.getBoundingClientRect();
										setMatchMenuAt(matchMenuAt ? null : { x: rect.left, y: rect.bottom + 4 });
									}}
								>
									선택된 태그 중 {props.tagSelection.match === 'all' ? '모두' : '일부'} 포함
									<span className="memo-tag-match-chevrons" aria-hidden="true">
										<i className="fa-solid fa-chevron-up" />
										<i className="fa-solid fa-chevron-down" />
									</span>
								</button>
							)}
							{matchMenuAt && (
								<Menu
									label="태그 일치 방식"
									anchor={matchMenuAt}
									onClose={() => setMatchMenuAt(null)}
									items={(['all', 'any'] as const).map((match) => ({
										label: `선택된 태그 중 ${match === 'all' ? '모두' : '일부'} 포함`,
										checked: props.tagSelection!.match === match,
										onSelect: () => props.onTagsChange!({ ...props.tagSelection!, match }),
									}))}
								/>
							)}
						</div>
						<TagChips tags={props.tags} selection={props.tagSelection} onChange={props.onTagsChange} />
					</section>
				)}
			</div>
		</nav>
	);
};

export default FolderSidebar;
