import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { readString, removeKey, STORAGE_KEYS, writeString } from '@/shared/lib/storage';

/** 마우스를 올린 뒤 이만큼 머물러야 연다 (지나가는 마우스로 깜빡이지 않게) */
export const PEEK_OPEN_DELAY = 120;
/** 마우스가 벗어난 뒤 이만큼 기다렸다 닫는다 (목록으로 옮겨 가는 사이에 닫히지 않게) */
export const PEEK_CLOSE_DELAY = 250;
/** 이만큼 누르고 있으면 길게 누르기 (iOS의 길게 누르기와 비슷한 길이) */
export const LONG_PRESS = 500;
/** 누른 채 이만큼 움직이면 스크롤로 보고 길게 누르기를 취소한다 */
const LONG_PRESS_SLOP = 10;

const loadPinned = () => readString(STORAGE_KEYS.memoTocPinned) === 'true';
const savePinned = (pinned: boolean) =>
	pinned ? writeString(STORAGE_KEYS.memoTocPinned, 'true') : removeKey(STORAGE_KEYS.memoTocPinned);

/**
 * 목차를 여닫는 규칙. 처음에는 접혀 있고, 두 가지로 열린다.
 * - 잠깐 열기(peek): 마우스를 올리면 열리고 벗어나면 닫힌다. 휴대폰은 탭하면 열리고, 바깥을 탭하거나 항목을 고르면 닫힌다
 * - 고정(pinned): 마우스는 클릭, 키보드는 Enter·Space, 휴대폰은 길게 누르기. 다시 하면 풀린다. 다음 방문에도 기억한다
 * Esc는 둘 다 닫는다
 * @param remember 고정을 브라우저에 기억한다 (제목 아래 목차). 떠 있는 목차 창은 기억하지 않는다
 */
export function useTocDisclosure({ remember }: { remember: boolean }) {
	const [pinned, setPinnedState] = useState(() => remember && loadPinned());
	const [peek, setPeek] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const press = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
	/** 길게 누르기로 고정했다: 손을 뗄 때 오는 click을 무시한다 */
	const longPressed = useRef(false);
	/** 마지막으로 누른 포인터 (click에는 마우스인지 손가락인지가 없다) */
	const pointer = useRef<string>('mouse');

	const setPinned = useCallback(
		(next: boolean) => {
			setPinnedState(next);
			if (remember) savePinned(next);
		},
		[remember]
	);

	useEffect(
		() => () => {
			clearTimeout(timer.current);
			if (press.current) clearTimeout(press.current.timer);
		},
		[]
	);

	const schedule = (open: boolean, delay: number) => {
		clearTimeout(timer.current);
		timer.current = setTimeout(() => setPeek(open), delay);
	};

	const close = useCallback(() => {
		clearTimeout(timer.current);
		setPeek(false);
	}, []);

	/** 목차 전체(제목 줄과 목록)에 단다: 마우스를 올리면 잠깐 연다 */
	const hoverProps = {
		onPointerEnter: (event: PointerEvent) => {
			if (event.pointerType === 'mouse') schedule(true, PEEK_OPEN_DELAY);
		},
		onPointerLeave: (event: PointerEvent) => {
			if (event.pointerType === 'mouse') schedule(false, PEEK_CLOSE_DELAY);
		},
	};

	const cancelPress = () => {
		if (press.current) clearTimeout(press.current.timer);
		press.current = null;
	};

	/** 여닫는 단추에 단다: 클릭·탭·길게 누르기·키 */
	const toggleProps = {
		onPointerDown: (event: PointerEvent) => {
			pointer.current = event.pointerType;
			longPressed.current = false;
			if (event.pointerType === 'mouse') return;
			cancelPress();
			press.current = {
				x: event.clientX,
				y: event.clientY,
				timer: setTimeout(() => {
					press.current = null;
					longPressed.current = true;
					setPinned(!pinned);
					setPeek(false);
					navigator.vibrate?.(10);
				}, LONG_PRESS),
			};
		},
		onPointerMove: (event: PointerEvent) => {
			const start = press.current;
			if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > LONG_PRESS_SLOP) cancelPress();
		},
		onPointerUp: cancelPress,
		onPointerCancel: cancelPress,
		// 길게 누르면 iOS가 띄우는 글자 고르기·메뉴를 막는다
		onContextMenu: (event: { preventDefault: () => void }) => event.preventDefault(),
		onClick: (event: { detail: number }) => {
			if (longPressed.current) {
				longPressed.current = false;
				return;
			}
			clearTimeout(timer.current);
			// 손가락 탭: 잠깐 열고 닫기 (고정돼 있으면 푼다)
			if (event.detail > 0 && pointer.current !== 'mouse') {
				if (pinned) {
					setPinned(false);
					setPeek(false);
				} else setPeek((open) => !open);
				return;
			}
			// 마우스 클릭과 Enter·Space: 고정을 켜고 끈다. 풀면 마우스가 위에 있어도 닫는다
			setPinned(!pinned);
			setPeek(false);
		},
	};

	const onKeyDown = (event: KeyboardEvent) => {
		if (event.key !== 'Escape' || !(pinned || peek)) return;
		event.preventDefault();
		event.stopPropagation();
		setPinned(false);
		close();
	};

	return { open: pinned || peek, pinned, peek, close, hoverProps, toggleProps, onKeyDown };
}
