import type { MenuItem } from '@/shared/ui/menu/Menu';
import type { Post } from './posts';

/** 메모 하나에 할 수 있는 일 (관리자). 우클릭 메뉴, 도구 •••, 휴대폰 ••• 가 같은 동작을 부른다 */
export interface NoteActions {
	togglePin: (post: Post) => void;
	toggleLock: (post: Post) => void;
	remove: (post: Post) => void;
	restore: (post: Post) => void;
	purge: (post: Post) => void;
}

const LOCKED_HINT = '잠긴 메모는 지울 수 없습니다';

/** 누를 수 있는 메뉴 항목 */
type ActionItem = Extract<MenuItem, { onSelect: () => void }>;

/** 최근 삭제된 메모: 되돌려 놓기, 즉시 삭제 */
export const restoreItem = (post: Post, actions: NoteActions): ActionItem => ({
	label: '되돌려 놓기',
	icon: 'fa-solid fa-rotate-left',
	onSelect: () => actions.restore(post),
});

export const purgeItem = (post: Post, actions: NoteActions): ActionItem => ({
	label: '즉시 삭제',
	icon: 'fa-regular fa-trash-can',
	destructive: true,
	onSelect: () => actions.purge(post),
});

/** 고정·잠그기 (넓은 창 메뉴의 글자) */
export const pinLockItems = (post: Post, actions: NoteActions): ActionItem[] => [
	{
		label: post.pinned ? '메모 고정 해제' : '메모 고정',
		icon: 'fa-solid fa-thumbtack',
		onSelect: () => actions.togglePin(post),
	},
	{
		label: post.locked ? '메모 잠금 해제' : '메모 잠그기',
		icon: post.locked ? 'fa-solid fa-lock-open' : 'fa-solid fa-lock',
		onSelect: () => actions.toggleLock(post),
	},
];

/** 지우기. 잠긴 메모는 지울 수 없다 */
export const removeItem = (post: Post, actions: NoteActions, label = '메모 삭제'): ActionItem => ({
	label,
	icon: 'fa-regular fa-trash-can',
	disabled: post.locked,
	hint: post.locked ? LOCKED_HINT : undefined,
	onSelect: () => actions.remove(post),
});

/** 목록의 우클릭 메뉴 */
export const noteContextItems = (post: Post, actions: NoteActions): MenuItem[] =>
	post.deletedAt
		? [restoreItem(post, actions), 'separator', purgeItem(post, actions)]
		: [...pinLockItems(post, actions), 'separator', removeItem(post, actions)];

/**
 * 휴대폰 본문의 ••• 메뉴 (iOS 메모처럼): 맨 위에 고정·잠그기, 그 아래 찾기·삭제.
 * 최근 삭제된 메모는 되돌려 놓기·즉시 삭제
 */
export const phoneNoteItems = (
	post: Post,
	actions: NoteActions,
	{ canEdit, inTrash, newDraft, onFind }: { canEdit: boolean; inTrash: boolean; newDraft: boolean; onFind: () => void }
): MenuItem[] =>
	canEdit && inTrash
		? [restoreItem(post, actions), purgeItem(post, actions)]
		: [
				...(canEdit && !newDraft
					? [
							{
								row: [
									{
										label: post.pinned ? '고정 해제' : '메모 고정',
										icon: 'fa-solid fa-thumbtack',
										onSelect: () => actions.togglePin(post),
									},
									{
										label: post.locked ? '잠금 해제' : '잠그기',
										icon: post.locked ? 'fa-solid fa-lock-open' : 'fa-solid fa-lock',
										onSelect: () => actions.toggleLock(post),
									},
								],
							},
						]
					: []),
				{ label: '메모에서 찾기', icon: 'fa-solid fa-magnifying-glass', onSelect: onFind },
				...(canEdit && !newDraft ? [{ ...removeItem(post, actions, '삭제'), destructive: true }] : []),
			];
