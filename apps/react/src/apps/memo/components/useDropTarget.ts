// 폴더에 글·폴더를 끌어 놓는 대상 (사이드바 맨 위·휴지통·폴더 줄이 같이 쓴다)
import React, { useState } from 'react';
import type { FolderSidebarProps } from './folderSidebar.model';

/** 폴더에 끌어 놓기. 놓을 수 있는 폴더에 올리면 강조한다 */
export function useDropTarget(
	path: string,
	{ canDrop, onDrop, dragging }: Pick<FolderSidebarProps, 'canDrop' | 'onDrop' | 'dragging'>
) {
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
