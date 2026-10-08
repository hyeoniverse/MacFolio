import { useAppMenus } from '@/desktop/status-bar/appMenus';
import type { MenuItem } from '@/shared/ui/menu/Menu';
import { sortMenuItems } from './components/sortMenuItems';
import type { View } from './components/MemoToolbar';
import type { Arrangement } from './arrange';

/**
 * 메뉴 막대의 메모 메뉴 (#96). 메모가 지금 쓰는 앱일 때 보인다.
 * ⌘F(열린 글 안에서 찾기)도 여기 편집 → 찾기… 의 단축키다 (desktop/status-bar/MenuBarMenus.tsx)
 */
export function useMemoAppMenus({
	canEdit,
	onNewNote,
	onFind,
	view,
	onView,
	sidebarOpen,
	onToggleSidebar,
	inTrash,
	arrangement,
	onArrange,
}: {
	canEdit: boolean;
	onNewNote: () => void;
	/** 열린 글이 없으면 null (찾기를 못 한다) */
	onFind: (() => void) | null;
	view: View;
	onView: (view: View) => void;
	sidebarOpen: boolean;
	onToggleSidebar: () => void;
	/** 최근 삭제된 항목은 늘 최근에 지운 순서라 정렬이 없다 */
	inTrash: boolean;
	arrangement: Arrangement;
	onArrange: (next: Arrangement) => void;
}) {
	useAppMenus('memo', [
		{
			title: '파일',
			items: canEdit
				? [
						{
							label: '새로운 메모',
							icon: 'fa-regular fa-pen-to-square',
							shortcut: { code: 'KeyN', alt: true },
							onSelect: onNewNote,
						},
					]
				: [],
		},
		{
			title: '편집',
			items: [
				{
					label: '찾기…',
					icon: 'fa-solid fa-magnifying-glass',
					disabled: !onFind,
					// 브라우저의 페이지 찾기 대신 열린 글 안에서 찾는다
					shortcut: { code: 'KeyF', mod: true },
					hint: onFind ? undefined : '글을 열면 그 글 안에서 찾습니다',
					onSelect: () => onFind?.(),
				},
			],
		},
		{
			title: '보기',
			items: [
				{
					label: '목록으로 보기',
					checked: view === 'list',
					shortcut: { code: 'Digit1', alt: true },
					onSelect: () => onView('list'),
				},
				{
					label: '갤러리로 보기',
					checked: view === 'gallery',
					shortcut: { code: 'Digit2', alt: true },
					onSelect: () => onView('gallery'),
				},
				'separator',
				{ label: '사이드바', checked: sidebarOpen, onSelect: onToggleSidebar },
				...(inTrash ? [] : (['separator', ...sortMenuItems(arrangement, onArrange)] as MenuItem[])),
			],
		},
	]);
}
