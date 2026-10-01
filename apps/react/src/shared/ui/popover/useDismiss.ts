import { useEffect, useRef, type RefObject } from 'react';

/**
 * 떠 있는 창을 닫는 때: 바깥을 누르거나 Esc를 누르면 onDismiss.
 * inside: 눌러도 닫지 않을 요소들 (창 자신, 창을 여는 단추). 여는 단추를 넣어 두면 단추를 다시 눌렀을 때
 * "바깥 누름으로 닫혔다가 단추 click으로 다시 열리는" 일이 없다.
 * keepOpenInside: 이 선택자 안을 눌러도 닫지 않는다 (예: 표 손잡이 메뉴는 표의 다른 칸을 눌러도 열어 둔다).
 */
export function useDismiss(
	open: boolean,
	onDismiss: () => void,
	inside: RefObject<Element | null>[],
	{ keepOpenInside }: { keepOpenInside?: string } = {}
) {
	// 매번 새로 만드는 onDismiss·inside 배열로 리스너를 다시 달지 않게 최신 값만 기억한다
	const latest = useRef({ onDismiss, inside, keepOpenInside });
	useEffect(() => {
		latest.current = { onDismiss, inside, keepOpenInside };
	});

	useEffect(() => {
		if (!open) return;
		const onPointerDown = (event: PointerEvent) => {
			const { inside, keepOpenInside, onDismiss } = latest.current;
			const target = event.target as Element;
			if (inside.some((ref) => ref.current?.contains(target))) return;
			if (keepOpenInside && target.closest?.(keepOpenInside)) return;
			onDismiss();
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') latest.current.onDismiss();
		};
		document.addEventListener('pointerdown', onPointerDown);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('keydown', onKeyDown);
		};
	}, [open]);
}
