import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ALL_CATEGORY, type FolderNode } from '../posts';
import { FOLDER_NAME_MAX, validateFolderName } from '../organize';
import { SidebarToggle } from './MemoToolbar';

/** 끌고 있는 것: 글(slug) 또는 폴더(경로) */
export type DragItem = { type: 'post'; id: string } | { type: 'folder'; id: string };

interface Props {
	open: boolean;
	onToggle: () => void;
	folders: FolderNode[];
	total: number;
	current: string;
	onSelect: (path: string) => void;
	/** 새 폴더를 이 폴더 아래에 만든다 ('' = 맨 위) */
	onAddFolder: (parent: string, name: string) => void;
	onRenameFolder: (path: string, name: string) => void;
	onRemoveFolder: (path: string) => void;
	dragging: DragItem | null;
	onDragFolder: (item: DragItem | null) => void;
	/** 끌고 있는 것을 target 폴더에 놓을 수 있는지 (ALL_CATEGORY = 맨 위) */
	canDrop: (target: string) => boolean;
	onDrop: (target: string) => void;
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

/**
 * 폴더의 ••• 메뉴 (우클릭으로도 연다). 사이드바 패널 밖으로 나와야 하므로 body에 그리고,
 * 연 자리(anchor)에 맞춰 놓는다.
 */
const FolderMenu: React.FC<{
	node: FolderNode;
	anchor: { x: number; y: number };
	onRename: () => void;
	onRemove: () => void;
	onAddChild: () => void;
	onClose: () => void;
}> = ({ node, anchor, onRename, onRemove, onAddChild, onClose }) => {
	const ref = useRef<HTMLDivElement>(null);
	const removable = Boolean(node.custom) && node.count === 0;

	useEffect(() => {
		const close = (event: Event) => {
			if (event instanceof KeyboardEvent ? event.key === 'Escape' : !ref.current?.contains(event.target as Node))
				onClose();
		};
		document.addEventListener('pointerdown', close);
		document.addEventListener('keydown', close);
		return () => {
			document.removeEventListener('pointerdown', close);
			document.removeEventListener('keydown', close);
		};
	}, [onClose]);

	const item = (label: string, icon: string, action: () => void, disabled = false, hint?: string) => (
		<button
			type="button"
			role="menuitem"
			disabled={disabled}
			title={hint}
			onClick={() => {
				onClose();
				action();
			}}
		>
			<i className={icon} aria-hidden="true" />
			{label}
		</button>
	);

	return createPortal(
		<div
			ref={ref}
			className="memo-folder-menu"
			role="menu"
			aria-label={`${node.name} 폴더 메뉴`}
			style={{ left: anchor.x, top: anchor.y }}
		>
			{item('폴더 이름 변경', 'fa-solid fa-pen', onRename)}
			{item(
				'폴더 삭제',
				'fa-regular fa-trash-can',
				onRemove,
				!removable,
				removable ? undefined : node.custom ? '메모가 있는 폴더는 지울 수 없어요' : '블로그 글의 폴더는 지울 수 없어요'
			)}
			<hr />
			{item('새로운 폴더', 'fa-solid fa-folder-plus', onAddChild)}
		</div>,
		document.body
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
					onContextMenu={(event) => {
						event.preventDefault();
						setMenuAt({ x: event.clientX, y: event.clientY });
					}}
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
						draggable
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
					{menuOpen && (
						<FolderMenu
							node={node}
							anchor={menuAt}
							onRename={() => setRenaming(true)}
							onRemove={() => props.onRemoveFolder(node.path)}
							onAddChild={() => props.onStartAdding(node.path)}
							onClose={() => setMenuAt(null)}
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

	const toggleFolder = (path: string) =>
		setCollapsed((prev) => {
			const next = new Set(prev);
			if (next.has(path)) next.delete(path);
			else next.add(path);
			return next;
		});

	const parentNode = addingUnder ? findNode(folders, addingUnder) : null;
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
			<div className="memo-sidebar-bar">
				<span className="memo-lights-space" aria-hidden="true" />
				<button
					type="button"
					className="memo-tool memo-new-folder-button"
					aria-label="새로운 폴더"
					title={current === ALL_CATEGORY ? '새로운 폴더' : `'${current.split('/').at(-1)}' 안에 새로운 폴더`}
					onClick={() => setAddingUnder(current === ALL_CATEGORY ? '' : current)}
				>
					<i className="fa-solid fa-folder-plus" aria-hidden="true" />
				</button>
				<SidebarToggle open onToggle={onToggle} />
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
				</ul>
			</div>
		</nav>
	);
};

export default FolderSidebar;
