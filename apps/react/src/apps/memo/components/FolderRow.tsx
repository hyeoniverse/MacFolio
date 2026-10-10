// 폴더 한 줄 (트리의 한 노드). 사이드바(FolderSidebar)가 폴더마다 하나씩 그린다
import { cssVars } from '@/shared/lib/cssVars';
import { useExitMotion } from '@/shared/ui/motion/useExitMotion';
import React, { useState } from 'react';
import Menu from '@/shared/ui/menu/Menu';
import { reorderKeyDelta } from '@/shared/ui/reorder/pointerReorder';
import { ALL_CATEGORY, canAddFolder, canMoveFolder, folderLabelOf, type FolderNode } from '@macfolio/desktop-core/memo';
import { useDropTarget } from './useDropTarget';
import { FolderIcon, FolderNameInput } from './FolderNameInput';
import { DEPTH_LIMIT_HINT, type FolderSidebarProps } from './folderSidebar.model';

type RowProps = Omit<FolderSidebarProps, 'open' | 'onToggle' | 'folders' | 'total' | 'onAddFolder'> & {
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
export const FolderRow: React.FC<RowProps> = (props) => {
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
