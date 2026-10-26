import { useState, type KeyboardEvent } from 'react';
import { readString, removeKey, STORAGE_KEYS, writeString } from '@/shared/lib/storage';

const loadOpen = () => readString(STORAGE_KEYS.memoTocOpen) === 'true';
const saveOpen = (open: boolean) =>
	open ? writeString(STORAGE_KEYS.memoTocOpen, 'true') : removeKey(STORAGE_KEYS.memoTocOpen);

/**
 * 목차를 여닫는 규칙: 처음에는 접혀 있고, 누르면(클릭·탭·Enter·Space) 펼치고 다시 누르면 접는다. Esc로도 접는다.
 * 마우스를 올리는 것만으로는 열지 않는다 (지나가는 마우스로 본문 위가 바뀌지 않게).
 * @param remember 펼친 상태를 브라우저에 기억한다 (제목 아래 목차: 펼쳐 두면 다음 글·다음 방문에도 펼친 채). 떠 있는 목차 창은 기억하지 않는다
 */
export function useTocDisclosure({ remember }: { remember: boolean }) {
	const [open, setOpenState] = useState(() => remember && loadOpen());

	const setOpen = (next: boolean) => {
		setOpenState(next);
		if (remember) saveOpen(next);
	};

	const onKeyDown = (event: KeyboardEvent) => {
		if (event.key !== 'Escape' || !open) return;
		event.preventDefault();
		event.stopPropagation();
		setOpen(false);
	};

	return { open, toggle: () => setOpen(!open), close: () => setOpen(false), onKeyDown };
}
