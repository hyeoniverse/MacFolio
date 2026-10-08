import { cssVars } from '@/shared/lib/cssVars';
import { useExitMotion } from '@/shared/ui/motion/useExitMotion';
import React, { useState } from 'react';
import Menu from '@/shared/ui/menu/Menu';
import { reorderKeyDelta, startPointerReorder } from '@/shared/ui/reorder/pointerReorder';
import { ALL_CATEGORY, folderLabelOf, RECENTLY_DELETED, type FolderNode } from '../posts';
import type { TagSelection } from '../tagFilter';
import TagChips from './TagChips';
import { canAddFolder, canMoveFolder, FOLDER_NAME_MAX, MAX_FOLDER_DEPTH, validateFolderName } from '../organize';

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
	/** 폴더를 target 폴더 안으로 옮긴다 (ALL_CATEGORY = 맨 위). 휴대폰 편집의 '이 폴더 이동' */
	onMoveFolder?: (path: string, target: string) => void;
	/** 같은 층 폴더의 순서를 바꾼다 (그 층의 경로를 새 순서대로). 휴대폰 편집의 ≡ 손잡이 */
	onReorderFolders?: (siblings: string[]) => void;
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
	/** 고른 태그 (태그마다 미선택 → 포함 → 제외), 바꾸기 */
	tagSelection?: TagSelection;
	onTagsChange?: (next: TagSelection) => void;
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
			<div className="memo-folder-row" style={cssVars({ depth })}>
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
				<p className="memo-folder-error" role="alert" style={cssVars({ depth })}>
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
	/** 휴대폰 폴더 화면의 편집: 줄을 눌러도 열지 않고, ••• 단추로 폴더 추가·이동·이름 변경·삭제 */
	editing?: boolean;
	/** 모든 폴더 경로 ('이 폴더 이동'의 갈 곳) */
	movePaths?: string[];
	/** ≡ 손잡이: 끌기 시작 (포인터), ↑·↓ 키로 한 칸씩 */
	onReorderStart?: (event: React.PointerEvent<HTMLButtonElement>) => void;
	onReorderStep?: (path: string, delta: number) => void;
};

/** 폴더 한 줄: 펼침 단추 + 폴더 + (마우스를 올리면) ••• 메뉴. 끌어서 다른 폴더로 옮긴다 */
const FolderRow: React.FC<RowProps> = (props) => {
	const { node, depth, current, collapsed, onToggle, onSelect, addingUnder, newFolderInput } = props;
	/** 메뉴를 연 자리 (null이면 닫힘) */
	const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
	const menuOpen = menuAt !== null;
	const [renaming, setRenaming] = useState(false);
	/** '이 폴더 이동'에서 고를 갈 곳 메뉴를 연 자리 */
	const [moveAt, setMoveAt] = useState<{ x: number; y: number } | null>(null);
	const open = !collapsed.has(node.path) || addingUnder === node.path;
	const drop = useDropTarget(node.path, props);
	const hasChildren = node.children.length > 0;
	const subfolders = useExitMotion<HTMLUListElement>('fade-out');
	const beingDragged = props.dragging?.type === 'folder' && props.dragging.id === node.path;
	const siblingNames = (props.siblings ?? []).filter((name) => name !== node.name);
	const removable = Boolean(node.custom) && node.count === 0;
	const removeHint = removable
		? undefined
		: node.custom
			? '메모가 있는 폴더는 지울 수 없어요'
			: '블로그 글의 폴더는 지울 수 없어요';

	return (
		<li data-folder-path={node.path}>
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
					style={cssVars({ depth })}
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
						onClick={() => !props.editing && onSelect(node.path)}
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
					{props.editing && props.onReorderStart && (
						<button
							type="button"
							className="memo-folder-handle"
							aria-label={`순서 바꾸기 (${node.name})`}
							title="끌거나 ↑·↓ 키로 순서를 바꿉니다"
							onPointerDown={props.onReorderStart}
							onKeyDown={(event) => {
								const delta = reorderKeyDelta(event.key);
								if (!delta) return;
								event.preventDefault();
								props.onReorderStep?.(node.path, delta);
							}}
						>
							<i className="fa-solid fa-bars" aria-hidden="true" />
						</button>
					)}
					{menuAt && (
						<Menu
							label={`${node.name} 폴더 메뉴`}
							anchor={menuAt}
							onClose={() => setMenuAt(null)}
							className={props.editing ? 'touch' : undefined}
							items={
								props.editing
									? [
											{
												label: '폴더 추가',
												icon: 'fa-solid fa-folder-plus',
												onSelect: () => props.onStartAdding(node.path),
												disabled: !canAddFolder(node.path),
												hint: canAddFolder(node.path) ? undefined : DEPTH_LIMIT_HINT,
											},
											{
												label: '이 폴더 이동',
												icon: 'fa-regular fa-folder',
												onSelect: () => setMoveAt(menuAt),
											},
											{ label: '이름 변경', icon: 'fa-solid fa-pen', onSelect: () => setRenaming(true) },
											{
												label: '삭제',
												icon: 'fa-regular fa-trash-can',
												destructive: true,
												onSelect: () => props.onRemoveFolder(node.path),
												disabled: !removable,
												hint: removeHint,
											},
										]
									: [
											{ label: '폴더 이름 변경', icon: 'fa-solid fa-pen', onSelect: () => setRenaming(true) },
											{
												label: '폴더 삭제',
												icon: 'fa-regular fa-trash-can',
												onSelect: () => props.onRemoveFolder(node.path),
												disabled: !removable,
												hint: removeHint,
											},
											'separator',
											{
												label: '새로운 폴더',
												icon: 'fa-solid fa-folder-plus',
												onSelect: () => props.onStartAdding(node.path),
												disabled: !canAddFolder(node.path),
												hint: canAddFolder(node.path) ? undefined : DEPTH_LIMIT_HINT,
											},
										]
							}
						/>
					)}
					{moveAt && props.onMoveFolder && (
						<Menu
							label={`${node.name} 폴더를 옮길 곳`}
							className="touch"
							anchor={moveAt}
							onClose={() => setMoveAt(null)}
							items={[
								{ heading: '옮길 곳' },
								...[ALL_CATEGORY, ...(props.movePaths ?? [])].map((target) => ({
									label: target === ALL_CATEGORY ? '맨 위' : folderLabelOf(target),
									icon: target === ALL_CATEGORY ? 'fa-solid fa-arrow-up' : 'fa-regular fa-folder',
									disabled: !canMoveFolder(node.path, target === ALL_CATEGORY ? '' : target, props.movePaths),
									onSelect: () => props.onMoveFolder?.(node.path, target),
								})),
							]}
						/>
					)}
				</div>
			)}
			{open && (hasChildren || addingUnder === node.path) && (
				// 펼치면 하위 폴더가 위에서 내려오고, 접으면 흐려지며 사라진다
				<ul ref={subfolders} className="memo-subfolders">
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
	const reorderStep = (path: string, delta: number) => {
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
				const next = items.map((el) => el.dataset.folderPath as string);
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
