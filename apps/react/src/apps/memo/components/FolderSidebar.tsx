import React, { useState } from 'react';
import { ALL_CATEGORY, type FolderNode } from '../posts';
import { FOLDER_NAME_MAX, validateFolderName } from '../userFolders';
import { SidebarToggle } from './MemoToolbar';

interface Props {
	open: boolean;
	onToggle: () => void;
	folders: FolderNode[];
	total: number;
	current: string;
	onSelect: (path: string) => void;
	/** 방문자가 만든 폴더 이름 (같은 이름을 막는 데 쓴다) */
	existingNames: string[];
	onAddFolder: (name: string) => void;
	onRemoveFolder: (name: string) => void;
}

/** 폴더 한 줄: 펼침 단추 + 폴더 (+ 방문자가 만든 폴더면 지우기) */
const FolderRow: React.FC<{
	node: FolderNode;
	depth: number;
	current: string;
	collapsed: Set<string>;
	onToggle: (path: string) => void;
	onSelect: (path: string) => void;
	onRemove: (name: string) => void;
}> = ({ node, depth, current, collapsed, onToggle, onSelect, onRemove }) => {
	const open = !collapsed.has(node.path);
	return (
		<li>
			<div className="memo-folder-row" style={{ paddingLeft: depth * 14 }}>
				{node.children.length > 0 ? (
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
					onClick={() => onSelect(node.path)}
				>
					<i className="fa-regular fa-folder" aria-hidden="true" />
					<span className="memo-folder-name">{node.name}</span>
					<span className="memo-count">{node.count}</span>
				</button>
				{node.custom && (
					<button
						type="button"
						className="memo-folder-remove"
						aria-label={`폴더 삭제 (${node.name})`}
						title="폴더 삭제"
						onClick={() => onRemove(node.name)}
					>
						<i className="fa-solid fa-xmark" aria-hidden="true" />
					</button>
				)}
			</div>
			{open && node.children.length > 0 && (
				<ul>
					{node.children.map((child) => (
						<FolderRow
							key={child.path}
							node={child}
							depth={depth + 1}
							current={current}
							collapsed={collapsed}
							onToggle={onToggle}
							onSelect={onSelect}
							onRemove={onRemove}
						/>
					))}
				</ul>
			)}
		</li>
	);
};

/** 새 폴더 이름 입력 줄. Enter로 만들고 Esc로 그만둔다 */
const NewFolderInput: React.FC<{
	existingNames: string[];
	onAdd: (name: string) => void;
	onCancel: () => void;
}> = ({ existingNames, onAdd, onCancel }) => {
	const [name, setName] = useState('');
	const [error, setError] = useState<string | null>(null);

	const submit = () => {
		const problem = validateFolderName(name, existingNames);
		if (problem) setError(problem);
		else onAdd(name.trim());
	};

	return (
		<li className="memo-new-folder">
			<div className="memo-folder-row">
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
				<p className="memo-folder-error" role="alert">
					{error}
				</p>
			)}
		</li>
	);
};

/**
 * 폴더 사이드바 (창 안에 떠 있는 패널). 위쪽은 신호등 버튼 자리이고 오른쪽에 여닫기 버튼이 있다.
 * 아래의 '새로운 폴더'로 폴더를 만든다 (방문자의 폴더는 이 브라우저에만 저장된다).
 */
const FolderSidebar: React.FC<Props> = ({
	open,
	onToggle,
	folders,
	total,
	current,
	onSelect,
	existingNames,
	onAddFolder,
	onRemoveFolder,
}) => {
	const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
	const [adding, setAdding] = useState(false);

	const toggleFolder = (path: string) =>
		setCollapsed((prev) => {
			const next = new Set(prev);
			if (next.has(path)) next.delete(path);
			else next.add(path);
			return next;
		});

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
						<div className="memo-folder-row">
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
							node={node}
							depth={0}
							current={current}
							collapsed={collapsed}
							onToggle={toggleFolder}
							onSelect={onSelect}
							onRemove={onRemoveFolder}
						/>
					))}
					{adding && (
						<NewFolderInput
							existingNames={existingNames}
							onAdd={(name) => {
								onAddFolder(name);
								setAdding(false);
							}}
							onCancel={() => setAdding(false)}
						/>
					)}
				</ul>
			</div>

			<button type="button" className="memo-add-folder" onClick={() => setAdding(true)}>
				<i className="fa-solid fa-circle-plus" aria-hidden="true" /> 새로운 폴더
			</button>
		</nav>
	);
};

export default FolderSidebar;
