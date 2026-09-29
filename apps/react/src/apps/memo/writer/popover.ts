// 도구 막대와 표 손잡이가 함께 쓰는 작은 창 (단추 아래에 body로 그린다)
import type React from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** 누를 때 편집기의 커서를 빼앗지 않는다 (서식을 커서 자리에 바로 적용하도록) */
export const keepFocus = (event: React.MouseEvent | React.PointerEvent) => event.preventDefault();

/** 단추 아래에 여는 작은 창. 바깥을 누르거나 Esc를 누르면 닫힌다 */
export function usePopover(
	fallback?: React.RefObject<HTMLElement | null>,
	keepOpenInside?: string,
	/** below: 단추 아래 가운데, right: 단추 오른쪽 위 (표 손잡이 메뉴) */
	placement: 'below' | 'right' = 'below',
	/** 바뀌면 자리를 다시 잰다 (단추가 움직이거나 커진 뒤) */
	anchorKey?: unknown
) {
	const [open, setOpen] = useState(false);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState({ left: 0, top: 0 });

	useLayoutEffect(() => {
		// 단추가 숨어 있으면(좁은 도구 막대) 대신 fallback 단추 아래에 연다
		const anchor = buttonRef.current?.offsetParent ? buttonRef.current : fallback?.current;
		if (!open || !anchor) return;
		const rect = anchor.getBoundingClientRect();
		const width = panelRef.current?.offsetWidth ?? 240;
		setPosition(
			placement === 'right'
				? { left: Math.min(rect.right + 6, window.innerWidth - width - 8), top: rect.top }
				: {
						left: Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 8)),
						top: rect.bottom + 8,
					}
		);
	}, [open, fallback, placement, anchorKey]);

	useEffect(() => {
		if (!open) return;
		const close = (event: Event) => {
			const target = event.target as Element;
			const inside =
				panelRef.current?.contains(target) ||
				buttonRef.current?.contains(target) ||
				Boolean(keepOpenInside && target.closest?.(keepOpenInside));
			if (event instanceof KeyboardEvent ? event.key === 'Escape' : !inside) setOpen(false);
		};
		document.addEventListener('pointerdown', close);
		document.addEventListener('keydown', close);
		return () => {
			document.removeEventListener('pointerdown', close);
			document.removeEventListener('keydown', close);
		};
	}, [open, keepOpenInside]);

	return { open, setOpen, buttonRef, panelRef, position };
}
