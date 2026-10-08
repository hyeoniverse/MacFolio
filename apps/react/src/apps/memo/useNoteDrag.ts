import { useState } from 'react';
import { ALL_CATEGORY, RECENTLY_DELETED, type Post } from './posts';
import { canMoveFolder, movePost, type Organization } from './organize';
import type { DragItem } from './components/FolderSidebar';

/**
 * 끌어 놓기 (관리자): 글은 다른 폴더로(최근 삭제된 항목에 놓으면 지우기), 지운 글은 폴더에 놓으면 되살리기,
 * 폴더는 다른 폴더 안(모든 글이면 맨 위)으로. 잠긴 메모는 지울 수 없다
 */
export function useNoteDrag({
	canEdit,
	inTrash,
	organized,
	trash,
	folderPaths,
	edit,
	onRemove,
	onRestore,
	onMoveFolder,
}: {
	canEdit: boolean;
	/** 최근 삭제된 항목을 보고 있으면 끄는 글은 지운 글 */
	inTrash: boolean;
	organized: Post[];
	trash: Post[];
	folderPaths: string[];
	edit: (update: (prev: Organization) => Organization) => void;
	onRemove: (post: Post) => void;
	onRestore: (post: Post, folder: string) => void;
	onMoveFolder: (path: string, target: string) => void;
}) {
	/** 끌고 있는 글이나 폴더 */
	const [dragging, setDragging] = useState<DragItem | null>(null);

	const canDrop = (target: string) => {
		if (!dragging) return false;
		if (dragging.type === 'deleted') return target !== RECENTLY_DELETED;
		if (target === RECENTLY_DELETED) {
			return dragging.type === 'post' && !organized.find((post) => post.slug === dragging.id)?.locked;
		}
		if (dragging.type === 'post') {
			return target !== ALL_CATEGORY && organized.find((post) => post.slug === dragging.id)?.category !== target;
		}
		return canMoveFolder(dragging.id, target === ALL_CATEGORY ? '' : target, folderPaths);
	};

	const drop = (target: string) => {
		if (!dragging) return;
		if (dragging.type === 'deleted') {
			const post = trash.find((item) => item.slug === dragging.id);
			if (post) onRestore(post, target);
		} else if (target === RECENTLY_DELETED) {
			const post = organized.find((item) => item.slug === dragging.id);
			if (post) onRemove(post);
		} else if (dragging.type === 'post') edit((prev) => movePost(prev, dragging.id, target));
		else onMoveFolder(dragging.id, target);
		setDragging(null);
	};

	/** 글 목록·갤러리 카드를 끌 때 (최근 삭제된 항목의 글은 폴더에 놓아 되살린다) */
	const dragPost = (slug: string) =>
		canEdit
			? {
					draggable: true,
					onDragStart: (event: React.DragEvent) => {
						event.dataTransfer.effectAllowed = 'move';
						event.dataTransfer.setData('text/plain', slug);
						setDragging({ type: inTrash ? 'deleted' : 'post', id: slug });
					},
					onDragEnd: () => setDragging(null),
				}
			: {};

	return { dragging, setDragging, canDrop, drop, dragPost };
}
