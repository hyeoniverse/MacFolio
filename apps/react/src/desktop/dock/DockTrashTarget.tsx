import { useState, type DragEvent } from 'react';
import { canTrash } from '@/apps/finder/edit';
import { find } from '@/apps/finder/files';
import { FINDER_DRAG_TYPE, finderDrag, useFinderEdit } from '@/apps/finder/useFinderEdit';
import { useLocations } from '@/apps/finder/useLocations';

/**
 * Dock의 휴지통 칸에 붙일 끌어 놓기 처리: macOS처럼 Finder의 항목을 끌어다 놓으면 휴지통으로 이동한다 (관리자).
 * Finder 창에서 끄는 것은 HTML 끌어 놓기, 바탕화면 아이콘은 포인터로 끌다가 놓는 자리(data-dock-trash)를 찾는다 (DesktopIcons)
 */
export function useDockTrashDrop() {
	// 첫 화면에 늘 있어서 블로그 글 묶음은 받지 않는다 (Finder 등이 받았으면 함께 쓴다)
	const locations = useLocations({ posts: false });
	const edit = useFinderEdit(locations);
	const [over, setOver] = useState(false);
	const dragged = () =>
		finderDrag
			.getState()
			.ids.map((id) => find(locations, id))
			.filter((item) => item !== null);
	const accepts = (event: DragEvent) => {
		if (!event.dataTransfer.types.includes(FINDER_DRAG_TYPE)) return false;
		const items = dragged();
		return edit.admin && items.length > 0 && items.every(canTrash);
	};
	return {
		'data-dock-trash': '',
		className: over ? 'drop-target' : undefined,
		onDragOver: (event: DragEvent<HTMLDivElement>) => {
			if (!accepts(event)) return;
			event.preventDefault();
			event.dataTransfer.dropEffect = 'move';
			setOver(true);
		},
		onDragLeave: () => setOver(false),
		onDrop: (event: DragEvent<HTMLDivElement>) => {
			setOver(false);
			if (!accepts(event)) return;
			event.preventDefault();
			edit.trash(dragged());
		},
	};
}
