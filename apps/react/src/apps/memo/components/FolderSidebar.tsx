import React, { useState } from 'react';
import Menu from '@/shared/ui/menu/Menu';
import { ALL_CATEGORY, RECENTLY_DELETED, TAG_PREFIX, type FolderNode } from '../posts';
import { canAddFolder, FOLDER_NAME_MAX, MAX_FOLDER_DEPTH, validateFolderName } from '../organize';

const DEPTH_LIMIT_HINT = `폴더는 ${MAX_FOLDER_DEPTH}단까지 만들 수 있어요`;
import { SidebarToggle } from './MemoToolbar';
import IconButton from '@/shared/ui/button/IconButton';

/** 끌고 있는 것: 글(slug) 또는 폴더(경로) */
/** 끄는 것: 글, 폴더, 최근 삭제된 항목의 글 (폴더에 놓으면 되살린다) */
export type DragItem = { type: 'post' | 'folder' | 'deleted'; id: string };

interface Props {
	/** 관리자만 편집(새로운 폴더, ••• 메뉴, 끌어 옮기기)할 수 있다 */
	canEdit: boolean;
	open: boolean;
	onToggle: () => void;
	folders: FolderNode[];
	total: number;
	current: string;
	onSelect: (path: string) => void;
	/** 새 폴더를 이 폴더 아래에 만든다 ('' = 맨 위) */
	onAddFolder: (parent: string, name: string) => void;
	/** 새 메모 (관리자). 사이드바 위쪽의 새로운 폴더 단추 왼쪽에 둔다 */
	onNewNote?: () => void;
	onRenameFolder: (path: string, name: string) => void;
	onRemoveFolder: (path: string) => void;
	dragging: DragItem | null;
	onDragFolder: (item: DragItem | null) => void;
	/** 끌고 있는 것을 target 폴더에 놓을 수 있는지 (ALL_CATEGORY = 맨 위) */
	canDrop: (target: string) => boolean;
	onDrop: (target: string) => void;
	/** '최근 삭제된 항목'의 글 수 (관리자). 1개 이상일 때만 폴더 목록 맨 아래에 보인다 */
	recentlyDeleted?: number;
	/** 휴지통 비우기 (최근 삭제된 항목의 ••• 메뉴) */
	onEmptyTrash?: () => void;
	/** 본문에 쓴 #태그와 글 수 (tags.ts). 있으면 폴더 아래에 태그 묶음이 보인다 */
	tags?: { name: string; count: number }[];
}

/** 폴더에 끌어 놓기. 놓을 수 있는 폴더에 올리면 강조한다 */
function useDropTarget(path: string, { canDrop, onDrop, dragging }: Pick<Props, 'canDrop' | 'onDrop' | 'dragging'>) {
	const [over, setOver] = useState(false);
	return {
		active: over && dragging !== null && canDrop(path),
		handlers: {
			onDragOver: (event: React.DragEvent) => {
				if (!dragging || !canDrop(path)) return;
				event.preventDefault();
				event.dataTransfer.dropEffect = 'move';
				setOver(true);
			},
			onDragLeave: () => setOver(false),
			onDrop: (event: React.DragEvent) => {
				event.preventDefault();
				setOver(false);
				if (dragging && canDrop(path)) onDrop(path);
			},
		},
	};
}

/** 폴더 아이콘 (SF Symbols의 folder 모양에 맞춰 선으로) */
const FolderIcon = () => <i className="fa-regular fa-folder memo-folder-icon" aria-hidden="true" />;

/**
 * 폴더 이름 입력 (새 폴더, 이름 바꾸기). 폴더 줄과 같은 모양이라 들여쓰기가 맞는다.
 * Enter로 정하고 Esc로 그만둔다.
 */
const FolderNameInput: React.FC<{
	depth: number;
	initial?: string;
	label: string;
	siblings: string[];
	onSubmit: (name: string) => void;
	onCancel: () => void;
}> = ({ depth, initial = '', label, siblings, onSubmit, onCancel }) => {
	const [name, setName] = useState(initial);
	const [error, setError] = useState<string | null>(null);

	const submit = () => {
		if (name.trim() === initial) return onCancel();
		const problem = validateFolderName(name, siblings);
		if (problem) setError(problem);
		else onSubmit(name.trim());
	};

	return (
		<>
			<div className="memo-folder-row" style={{ ['--depth' as string]: depth }}>
				<span className="memo-disclosure" aria-hidden="true" />
				<div className="memo-folder editing">
					<FolderIcon />
					<input
						aria-label={label}
						placeholder="새로운 폴더"
						maxLength={FOLDER_NAME_MAX}
						value={name}
						autoFocus
						onFocus={(event) => event.currentTarget.select()}
						onChange={(event) => {
							setName(event.target.value);
							setError(null);
						}}
						onKeyDown={(event) => {
							if (event.nativeEvent.isComposing) return;
							if (event.key === 'Enter') submit();
							if (event.key === 'Escape') onCancel();
						}}
						onBlur={() => {
							if (!name.trim() || name.trim() === initial) onCancel();
						}}
					/>
				</div>
			</div>
			{error && (
				<p className="memo-folder-error" role="alert" style={{ ['--depth' as string]: depth }}>
					{error}
				</p>
			)}
		</>
	);
};

type RowProps = Omit<Props, 'open' | 'onToggle' | 'folders' | 'total' | 'onAddFolder'> & {
	node: FolderNode;
	depth: number;
	/** 같은 층 폴더 이름 (이름 바꾸기에서 겹치지 않게) */
	siblings?: string[];
	collapsed: Set<string>;
	onToggle: (path: string) => void;
	/** 새 폴더를 만드는 중인 부모 (null = 만드는 중 아님) */
	addingUnder: string | null;
	onStartAdding: (parent: string) => void;
	newFolderInput: React.ReactNode;
};

/** 폴더 한 줄: 펼침 단추 + 폴더 + (마우스를 올리면) ••• 메뉴. 끌어서 다른 폴더로 옮긴다 */
const FolderRow: React.FC<RowProps> = (props) => {
	const { node, depth, current, collapsed, onToggle, onSelect, addingUnder, newFolderInput } = props;
	/** 메뉴를 연 자리 (null이면 닫힘) */
	const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
	const menuOpen = menuAt !== null;
	const [renaming, setRenaming] = useState(false);
	const open = !collapsed.has(node.path) || addingUnder === node.path;
	const drop = useDropTarget(node.path, props);
	const hasChildren = node.children.length > 0;
	const beingDragged = props.dragging?.type === 'folder' && props.dragging.id === node.path;
	const siblingNames = (props.siblings ?? []).filter((name) => name !== node.name);
	const removable = Boolean(node.custom) && node.count === 0;

	return (
		<li>
			{renaming ? (
				<FolderNameInput
					depth={depth}
					initial={node.name}
					label="폴더 이름"
					siblings={siblingNames}
					onSubmit={(name) => {
						props.onRenameFolder(node.path, name);
						setRenaming(false);
					}}
					onCancel={() => setRenaming(false)}
				/>
			) : (
				<div
					className={`memo-folder-row ${drop.active ? 'drop-target' : ''} ${beingDragged ? 'dragging' : ''} ${menuOpen ? 'menu-open' : ''}`}
					style={{ ['--depth' as string]: depth }}
					onContextMenu={
						props.canEdit
							? (event) => {
									event.preventDefault();
									setMenuAt({ x: event.clientX, y: event.clientY });
								}
							: undefined
					}
					{...drop.handlers}
				>
					{hasChildren ? (
						<button
							type="button"
							className={`memo-disclosure ${open ? 'open' : ''}`}
							aria-label={`하위 폴더 ${open ? '접기' : '펼치기'} (${node.name})`}
							aria-expanded={open}
							onClick={() => onToggle(node.path)}
						>
							<i className="fa-solid fa-chevron-right" aria-hidden="true" />
						</button>
					) : (
						<span className="memo-disclosure" aria-hidden="true" />
					)}
					<button
						type="button"
						className={`memo-folder ${current === node.path ? 'active' : ''}`}
						aria-current={current === node.path || undefined}
						draggable={props.canEdit}
						onDragStart={(event) => {
							event.dataTransfer.effectAllowed = 'move';
							event.dataTransfer.setData('text/plain', node.path);
							props.onDragFolder({ type: 'folder', id: node.path });
						}}
						onDragEnd={() => props.onDragFolder(null)}
						onClick={() => onSelect(node.path)}
					>
						<FolderIcon />
						<span className="memo-folder-name">{node.name}</span>
						<span className="memo-count">{node.count}</span>
					</button>
					{props.canEdit && (
						<button
							type="button"
							className="memo-folder-more"
							aria-label={`폴더 동작 (${node.name})`}
							aria-haspopup="menu"
							aria-expanded={menuOpen}
							onClick={(event) => {
								const rect = event.currentTarget.getBoundingClientRect();
								setMenuAt(menuOpen ? null : { x: rect.left, y: rect.bottom + 4 });
							}}
						>
							<i className="fa-solid fa-ellipsis" aria-hidden="true" />
						</button>
					)}
					{menuAt && (
						<Menu
							label={`${node.name} 폴더 메뉴`}
							anchor={menuAt}
							onClose={() => setMenuAt(null)}
							items={[
								{ label: '폴더 이름 변경', icon: 'fa-solid fa-pen', onSelect: () => setRenaming(true) },
								{
									label: '폴더 삭제',
									icon: 'fa-regular fa-trash-can',
									onSelect: () => props.onRemoveFolder(node.path),
									disabled: !removable,
									hint: removable
										? undefined
										: node.custom
											? '메모가 있는 폴더는 지울 수 없어요'
											: '블로그 글의 폴더는 지울 수 없어요',
								},
								'separator',
								{
									label: '새로운 폴더',
									icon: 'fa-solid fa-folder-plus',
									onSelect: () => props.onStartAdding(node.path),
									disabled: !canAddFolder(node.path),
									hint: canAddFolder(node.path) ? undefined : DEPTH_LIMIT_HINT,
								},
							]}
						/>
					)}
				</div>
			)}
			{open && (hasChildren || addingUnder === node.path) && (
				<ul>
					{node.children.map((child) => (
						<FolderRow
							key={child.path}
							{...props}
							node={child}
							depth={depth + 1}
							siblings={node.children.map((c) => c.name)}
						/>
					))}
					{addingUnder === node.path && newFolderInput}
				</ul>
			)}
		</li>
	);
};

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
const FolderSidebar: React.FC<Props> = (props) => {
	const { open, onToggle, folders, total, current, onSelect, onAddFolder } = props;
	const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
	/** 새 폴더를 만드는 중인 부모 ('' = 맨 위, null = 만드는 중 아님) */
	const [addingUnder, setAddingUnder] = useState<string | null>(null);
	const rootDrop = useDropTarget(ALL_CATEGORY, props);
	const trashDrop = useDropTarget(RECENTLY_DELETED, props);
	/** 최근 삭제된 항목의 메뉴를 연 자리 (null이면 닫힘) */
	const [trashMenuAt, setTrashMenuAt] = useState<{ x: number; y: number } | null>(null);

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
		<nav className="memo-folders" aria-label="카테고리" inert={!open}>
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
			</div>

			<div className="memo-folder-scroll">
				<h2>블로그</h2>
				<ul>
					<li>
						{/* 모든 글: 폴더를 여기에 놓으면 맨 위로 옮겨 간다 */}
						<div
							className={`memo-folder-row ${rootDrop.active ? 'drop-target' : ''}`}
							style={{ ['--depth' as string]: 0 }}
							{...rootDrop.handlers}
						>
							<span className="memo-disclosure" aria-hidden="true" />
							<button
								type="button"
								className={`memo-folder ${current === ALL_CATEGORY ? 'active' : ''}`}
								aria-current={current === ALL_CATEGORY || undefined}
								onClick={() => onSelect(ALL_CATEGORY)}
							>
								<FolderIcon />
								<span className="memo-folder-name">{ALL_CATEGORY}</span>
								<span className="memo-count">{total}</span>
							</button>
						</div>
					</li>
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
						/>
					))}
					{addingUnder === '' && newFolderInput}
					{/* 최근 삭제된 항목: macOS 메모처럼 폴더 목록 맨 아래. 글을 끌어 놓으면 지운다 (폴더는 놓을 수 없다) */}
					{/* 비어 있으면 숨기되, 글을 끄는 동안에는 놓을 자리로 보인다 */}
					{((props.recentlyDeleted ?? 0) > 0 || props.dragging?.type === 'post') && (
						<li>
							<div
								className={`memo-folder-row ${trashDrop.active ? 'drop-target' : ''} ${trashMenuAt ? 'menu-open' : ''}`}
								style={{ ['--depth' as string]: 0 }}
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
				{/* 태그: macOS 메모처럼 폴더 아래에 알약으로. 누르면 그 태그의 글만 */}
				{props.tags && props.tags.length > 0 && (
					<section className="memo-tag-browser" aria-label="태그">
						<h3>태그</h3>
						<ul>
							{props.tags.map((tag) => {
								const path = TAG_PREFIX + tag.name;
								return (
									<li key={tag.name}>
										<button
											type="button"
											className={`memo-tag-chip ${current === path ? 'active' : ''}`}
											aria-current={current === path || undefined}
											title={`${tag.count}개의 메모`}
											onClick={() => onSelect(current === path ? ALL_CATEGORY : path)}
										>
											#{tag.name}
										</button>
									</li>
								);
							})}
						</ul>
					</section>
				)}
			</div>
		</nav>
	);
};

export default FolderSidebar;
