import { useRef, useState } from 'react';

import { linkedId } from '@/shared/lib/appLink';
import type { View } from './components/MemoToolbar';
import { loadPaneWidth, loadTextScale, saveTextScale } from './memoStorage';
import { useShellSize } from './useShellSize';

/** 칸을 넓혀도 본문은 이만큼(px) 남긴다 */
const READER_MIN = 360;

export type Pane = 'folders' | 'list' | 'reader';

const PANES: Pane[] = ['folders', 'list', 'reader'];

/**
 * 메모 창의 칸 배치: 한 칸씩 볼 때 어느 칸인지(폴더 → 목록 → 본문)와 넘어간 방향,
 * 사이드바 열림·너비, 목록 너비, 목록·갤러리 보기, 읽기 글자 크기. phone이면 폭과 상관없이 한 칸씩 본다
 */
export function useMemoLayout(phone: boolean) {
	// 좁은 창에서는 한 칸씩 보여준다 (iOS 메모처럼 폴더 → 목록 → 본문). 넓은 창에서는 쓰지 않는다.
	// 글 주소로 들어왔으면 본문부터
	const [pane, setPaneState] = useState<Pane>(() => (linkedId('memo') ? 'reader' : 'list'));
	// 넘어간 방향. 앞으로 가면 오른쪽에서, 뒤로 가면 왼쪽에서 들어온다 (처음에는 애니메이션 없음)
	const [nav, setNav] = useState<'forward' | 'back' | undefined>();
	/** 사용자가 사이드바를 직접 열거나 닫았으면 그 값, 아니면 창 폭으로 정한다 */
	const [sidebarChoice, setSidebarChoice] = useState<boolean | null>(null);
	// 사이드바 너비(px): 경계를 끌어 바꾸고 이 브라우저에 남긴다. 끄는 동안은 칸 너비 애니메이션을 끈다
	const [sidebarWidth, setSidebarWidth] = useState(() => loadPaneWidth('sidebar'));
	const [listWidth, setListWidth] = useState(() => loadPaneWidth('list'));
	const [resizing, setResizing] = useState(false);
	/** 읽기 화면 글자 크기 (보는 사람마다 이 브라우저에 남는다) */
	const [textScale, setTextScaleState] = useState(loadTextScale);
	const memoRef = useRef<HTMLDivElement>(null);
	const [view, setView] = useState<View>('list');
	/** 갤러리에서 카드를 눌러 글을 연 상태 */
	const [galleryNoteOpen, setGalleryNoteOpen] = useState(false);
	const shellRef = useRef<HTMLDivElement>(null);
	const shellSize = useShellSize(shellRef);
	// 휴대폰 화면에서는 폭과 상관없이 한 칸씩. 모양도 이 값을 따른다 (memo-shell의 data-compact)
	const compact = phone || shellSize.compact;
	// 한 칸씩 볼 때는 폴더가 따로 한 화면이라 닫지 않는다
	const sidebarOpen = compact || (sidebarChoice ?? !shellSize.narrow);

	return {
		pane,
		nav,
		setPane: (next: Pane) => {
			setNav(PANES.indexOf(next) > PANES.indexOf(pane) ? 'forward' : 'back');
			setPaneState(next);
		},
		compact,
		shellRef,
		memoRef,
		sidebarOpen,
		toggleSidebar: () => setSidebarChoice(!sidebarOpen),
		sidebarWidth,
		setSidebarWidth,
		listWidth,
		setListWidth,
		resizing,
		setResizing,
		/**
		 * 칸 하나를 넓힐 수 있는 최대 너비: 창 너비에서 다른 칸과 본문 최소 너비(READER_MIN)를 뺀 값.
		 * 넓은 창에서는 PANE_WIDTHS의 최대가 먼저 걸린다
		 */
		roomFor: (others: number) => () => (memoRef.current?.clientWidth ?? Infinity) - others - READER_MIN,
		view,
		changeView: (next: View) => {
			setView(next);
			setGalleryNoteOpen(false);
		},
		galleryNoteOpen,
		setGalleryNoteOpen,
		textScale,
		setTextScale: (next: number) => {
			setTextScaleState(next);
			saveTextScale(next);
		},
	};
}
