import type { MenuItem } from '@/shared/ui/menu/Menu';
import ShareIcon from '@/shared/ui/ShareIcon';
import { canBeSecret, type Arrangement, type Post } from '@macfolio/desktop-core/memo';
import type { View } from './components/MemoToolbar';
import { sortMenuItems } from './components/sortMenuItems';

/** 메모 하나에 할 수 있는 일 (관리자). 우클릭 메뉴, 도구 •••, 휴대폰 ••• 가 같은 동작을 부른다 */
export interface NoteActions {
	togglePin: (post: Post) => void;
	toggleLock: (post: Post) => void;
	/** 비밀 글로 지정하거나 푼다 (서버에만 있는 글) */
	toggleSecret: (post: Post) => void;
	remove: (post: Post) => void;
	restore: (post: Post) => void;
	purge: (post: Post) => void;
	/** 서버에서 고친 저장소 글을 저장소의 원래 글로 되돌린다 */
	revert: (post: Post) => void;
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

/**
 * 비밀 글 지정·해제: 관리자에게만 보이게 한다. 서버에만 있는 글만 고를 수 있고,
 * 저장소 글은 공개 저장소에 원문이 있어 숨길 수 없다는 이유를 보이며 막는다. 잠긴 메모도 바꿀 수 없다
 */
export const secretItem = (post: Post, actions: NoteActions): ActionItem => {
	const secret = Boolean(post.status?.secret);
	const reason = !canBeSecret(post)
		? '저장소의 글은 공개 저장소에 있어 비밀로 할 수 없습니다'
		: post.locked
			? '잠긴 메모는 바꿀 수 없습니다'
			: undefined;
	return {
		label: secret ? '비밀 글 해제' : '비밀 글로 지정',
		icon: secret ? 'fa-solid fa-lock-open' : 'fa-solid fa-user-lock',
		disabled: reason !== undefined,
		hint: reason,
		onSelect: () => actions.toggleSecret(post),
	};
};

/** 지우기. 잠긴 메모는 지울 수 없다 */
export const removeItem = (post: Post, actions: NoteActions, label = '메모 삭제'): ActionItem => ({
	label,
	icon: 'fa-regular fa-trash-can',
	disabled: post.locked,
	hint: post.locked ? LOCKED_HINT : undefined,
	onSelect: () => actions.remove(post),
});

/** 저장소 글로 되돌리기: 서버에서 고친 저장소 글만 (저장소에 없는 글은 되돌릴 원래 글이 없다). 잠긴 메모는 고칠 수 없다 */
const revertItems = (post: Post, actions: NoteActions): ActionItem[] =>
	post.status?.overridesRepo
		? [
				{
					label: '저장소 글로 되돌리기',
					icon: 'fa-solid fa-clock-rotate-left',
					disabled: post.locked,
					hint: post.locked ? '잠긴 메모는 되돌릴 수 없습니다' : undefined,
					onSelect: () => actions.revert(post),
				},
			]
		: [];

/** 목록의 우클릭 메뉴 */
export const noteContextItems = (post: Post, actions: NoteActions): MenuItem[] =>
	post.deletedAt
		? [restoreItem(post, actions), 'separator', purgeItem(post, actions)]
		: [
				...pinLockItems(post, actions),
				secretItem(post, actions),
				'separator',
				...revertItems(post, actions),
				removeItem(post, actions),
			];

/**
 * 휴대폰 본문의 ••• 메뉴 (iOS 메모처럼): 맨 위에 고정·잠그기, 비밀 글, 그 아래 찾기·삭제.
 * 최근 삭제된 메모는 되돌려 놓기·즉시 삭제
 */
export const phoneNoteItems = (
	post: Post,
	actions: NoteActions,
	{
		canEdit,
		inTrash,
		newDraft,
		onFind,
		readerView = null,
		onToggleReaderView,
	}: {
		canEdit: boolean;
		inTrash: boolean;
		newDraft: boolean;
		onFind: () => void;
		/** 읽기 화면으로 보는 중인지 (관리자가 편집할 수 있는 글일 때만, 아니면 null) */
		readerView?: boolean | null;
		onToggleReaderView?: () => void;
	}
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
				...(canEdit && !newDraft ? [secretItem(post, actions)] : []),
				{ label: '메모에서 찾기', icon: 'fa-solid fa-magnifying-glass', onSelect: onFind },
				...(readerView !== null && !newDraft && onToggleReaderView
					? [
							{
								label: readerView ? '편집 화면으로 돌아가기' : '읽기 화면으로 보기',
								icon: readerView ? 'fa-solid fa-pen' : 'fa-regular fa-eye',
								onSelect: onToggleReaderView,
							},
						]
					: []),
				...(canEdit && !newDraft
					? [...revertItems(post, actions), { ...removeItem(post, actions, '삭제'), destructive: true }]
					: []),
			];

/**
 * 본문 도구 막대의 ••• 메뉴 (검색하는 동안 접힌 도구가 여기 모인다):
 * 새 메모, 그 글의 일(되돌려 놓기·즉시 삭제, 또는 고정·잠그기·삭제), 링크 공유, 정렬, 보기 방식
 */
export const toolMenuItems = ({
	selected,
	actions,
	canEdit,
	inTrash,
	onNewNote,
	onShare,
	arrangement,
	onArrange,
	view,
	onView,
}: {
	selected: Post | null;
	actions: NoteActions;
	canEdit: boolean;
	inTrash: boolean;
	onNewNote: () => void;
	onShare: (post: Post) => void;
	arrangement: Arrangement;
	onArrange: (next: Arrangement) => void;
	view: View;
	onView: (view: View) => void;
}): MenuItem[] => [
	...(canEdit ? [{ label: '새 메모', icon: 'fa-regular fa-pen-to-square', onSelect: onNewNote }] : []),
	...(canEdit && selected && inTrash
		? [restoreItem(selected, actions), purgeItem(selected, actions), 'separator' as const]
		: []),
	...(canEdit && selected && !inTrash
		? [
				...pinLockItems(selected, actions),
				secretItem(selected, actions),
				...revertItems(selected, actions),
				removeItem(selected, actions),
				'separator' as const,
			]
		: []),
	...(selected && !inTrash && !selected.status?.draftOnly && !selected.status?.secret
		? [{ label: '링크 공유', icon: <ShareIcon />, onSelect: () => onShare(selected) }, 'separator' as const]
		: []),
	...sortMenuItems(arrangement, onArrange),
	'separator',
	{ heading: '보기' },
	{ label: '목록으로 보기', checked: view === 'list', onSelect: () => onView('list') },
	{ label: '갤러리로 보기', checked: view === 'gallery', onSelect: () => onView('gallery') },
];
