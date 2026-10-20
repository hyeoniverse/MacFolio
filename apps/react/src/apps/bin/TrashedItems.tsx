import React, { useState } from 'react';
import FinderIcon from '@/apps/finder/FinderIcon';
import { canSetWallpaper, setDesktopWallpaper } from '@/apps/finder/setWallpaper';
import { useFinderEdit } from '@/apps/finder/useFinderEdit';
import { useLocations, useTrash } from '@/apps/finder/useLocations';
import type { FinderItem } from '@/apps/finder/files';
import Menu, { type MenuItem } from '@/shared/ui/menu/Menu';
import Button from '@/shared/ui/button/Button';
import '@/apps/finder/Finder.css';
import EmptyState from '@/shared/ui/empty-state/EmptyState';

/**
 * Finder에서 휴지통으로 보낸 항목 (만든 폴더·올린 파일). macOS 휴지통처럼 오른쪽 클릭으로 되돌려 놓거나 즉시 삭제하고,
 * 위의 비우기 버튼으로 모두 영구 삭제한다 (관리자만. 방문자는 보기만)
 */
const TrashedItems: React.FC = () => {
	const locations = useLocations();
	const trash = useTrash();
	// 되돌릴 자리를 찾으려면 위치와 휴지통을 함께 본다
	const edit = useFinderEdit([...locations, trash]);
	const [selected, setSelected] = useState<string | null>(null);
	const [menu, setMenu] = useState<{ anchor: { x: number; y: number }; item: FinderItem } | null>(null);
	const items = trash.children;

	const menuItems: MenuItem[] = menu
		? [
				{ label: '되돌려 놓기', disabled: !edit.admin, onSelect: () => edit.putBack([menu.item]) },
				...(canSetWallpaper(menu.item)
					? [{ label: '데스크탑 사진 설정', onSelect: () => setDesktopWallpaper(menu.item) }]
					: []),
				'separator',
				{ label: '즉시 삭제…', disabled: !edit.admin, onSelect: () => edit.deleteForever([menu.item]) },
			]
		: [];

	return (
		<div className="bin-trash" onClick={() => setSelected(null)}>
			<div className="bin-trash-bar">
				<span>{items.length > 0 ? `${items.length}개의 항목` : ''}</span>
				{edit.admin && (
					<Button
						disabled={items.length === 0}
						onClick={() => edit.deleteForever(items, '휴지통에 있는 항목을 영구적으로 지우겠습니까?')}
					>
						비우기
					</Button>
				)}
			</div>
			{items.length === 0 ? (
				<EmptyState className="finder-empty">휴지통이 비어 있습니다.</EmptyState>
			) : (
				<div className="finder-grid" role="listbox" aria-label="휴지통 항목">
					{items.map((item) => (
						<div
							key={item.id}
							role="option"
							aria-selected={selected === item.id}
							className={`finder-item ${item.kind}${selected === item.id ? ' selected' : ''}`}
							onClick={(event) => {
								event.stopPropagation();
								setSelected(item.id);
							}}
							onContextMenu={(event) => {
								event.preventDefault();
								event.stopPropagation();
								setSelected(item.id);
								setMenu({ anchor: { x: event.clientX, y: event.clientY }, item });
							}}
						>
							<span className="finder-icon">
								<FinderIcon item={item} />
							</span>
							<span className="finder-name">{item.name}</span>
						</div>
					))}
				</div>
			)}
			{menu && <Menu label="항목 메뉴" anchor={menu.anchor} items={menuItems} onClose={() => setMenu(null)} />}
			{edit.dialog}
		</div>
	);
};

export default TrashedItems;
