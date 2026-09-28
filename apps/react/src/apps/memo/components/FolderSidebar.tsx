import React, { useState } from 'react';
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
	const active = over && dragging !== null && canDrop(path);
	return {
		active,
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

type RowProps = Pick<
	Props,
	'current' | 'onSelect' | 'onRemoveFolder' | 'dragging' | 'onDragFolder' | 'canDrop' | 'onDrop'
> & {
	node: FolderNode;
	depth: number;
	collapsed: Set<string>;
	onToggle: (path: string) => void;
	/** 새 폴더를 만드는 중인 부모 폴더 (null = 만드는 중 아님) */
	addingUnder: string | null;
	newFolderInput: React.ReactNode;
};

/** 폴더 한 줄: 펼침 단추 + 폴더 (+ 방문자가 만든 빈 폴더면 지우기). 끌어서 다른 폴더로 옮긴다 */
const FolderRow: React.FC<RowProps> = (props) => {
	const { node, depth, current, collapsed, onToggle, onSelect, onRemoveFolder, addingUnder, newFolderInput } = props;
	const open = !collapsed.has(node.path) || addingUnder === node.path;
	const drop = useDropTarget(node.path, props);
	const hasChildren = node.children.length > 0;
	const beingDragged = props.dragging?.type === 'folder' && props.dragging.id === node.path;

	return (
		<li>
			<div
				className={`memo-folder-row ${drop.active ? 'drop-target' : ''} ${beingDragged ? 'dragging' : ''}`}
				style={{ ['--depth' as string]: depth }}
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
					<i className="fa-regular fa-folder" aria-hidden="true" />
					<span className="memo-folder-name">{node.name}</span>
					<span className="memo-count">{node.count}</span>
				</button>
				{node.custom && node.count === 0 && (
					<button
						type="button"
						className="memo-folder-remove"
						aria-label={`폴더 삭제 (${node.name})`}
						title="폴더 삭제"
						onClick={() => onRemoveFolder(node.path)}
					>
						<i className="fa-solid fa-xmark" aria-hidden="true" />
					</button>
				)}
			</div>
			{open && (hasChildren || addingUnder === node.path) && (
				<ul>
					{node.children.map((child) => (
						<FolderRow key={child.path} {...props} node={child} depth={depth + 1} />
					))}
					{addingUnder === node.path && newFolderInput}
				</ul>
			)}
		</li>
	);
};

/** 새 폴더 이름 입력 줄. Enter로 만들고 Esc로 그만둔다 */
const NewFolderInput: React.FC<{
	depth: number;
	siblings: string[];
	onAdd: (name: string) => void;
	onCancel: () => void;
}> = ({ depth, siblings, onAdd, onCancel }) => {
	const [name, setName] = useState('');
	const [error, setError] = useState<string | null>(null);

	const submit = () => {
		const problem = validateFolderName(name, siblings);
		if (problem) setError(problem);
		else onAdd(name.trim());
	};

	return (
		<li className="memo-new-folder">
			<div className="memo-folder-row" style={{ ['--depth' as string]: depth }}>
				<span className="memo-disclosure" aria-hidden="true" />
				<i className="fa-regular fa-folder" aria-hidden="true" />
				<input
					aria-label="새로운 폴더 이름"
					placeholder="새로운 폴더"
					maxLength={FOLDER_NAME_MAX}
					value={name}
					autoFocus
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
						if (!name.trim()) onCancel();
					}}
				/>
			</div>
			{error && (
				<p className="memo-folder-error" role="alert" style={{ ['--depth' as string]: depth }}>
					{error}
				</p>
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
 * 폴더 사이드바 (창 안에 떠 있는 패널). 위쪽은 신호등 버튼 자리이고 오른쪽에 여닫기 버튼이 있다.
 * 폴더를 고른 채 '새로운 폴더'를 누르면 그 폴더 아래에 만든다. 폴더와 글은 끌어서 다른 폴더로 옮긴다.
 * (방문자가 정리한 내용은 이 브라우저에만 저장된다)
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
			<NewFolderInput
				key={addingUnder}
				depth={addingUnder ? addingUnder.split('/').length : 0}
				siblings={(parentNode ? parentNode.children : folders).map((node) => node.name)}
				onAdd={(name) => {
					onAddFolder(addingUnder, name);
					setAddingUnder(null);
				}}
				onCancel={() => setAddingUnder(null)}
			/>
		);

	return (
		<nav className="memo-folders" aria-label="카테고리" inert={!open}>
			<div className="memo-sidebar-bar">
				<span className="memo-lights-space" aria-hidden="true" />
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
								<i className="fa-regular fa-folder" aria-hidden="true" />
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
							collapsed={collapsed}
							onToggle={toggleFolder}
							addingUnder={addingUnder}
							newFolderInput={newFolderInput}
						/>
					))}
					{addingUnder === '' && newFolderInput}
				</ul>
			</div>

			<button
				type="button"
				className="memo-add-folder"
				title={current === ALL_CATEGORY ? '새로운 폴더' : `'${current.split('/').at(-1)}' 안에 새로운 폴더`}
				onClick={() => setAddingUnder(current === ALL_CATEGORY ? '' : current)}
			>
				<i className="fa-solid fa-circle-plus" aria-hidden="true" /> 새로운 폴더
			</button>
		</nav>
	);
};

export default FolderSidebar;
