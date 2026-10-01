// 도구 막대와 표 손잡이가 함께 쓰는 작은 창 (단추 아래에 body로 그린다).
// 닫기와 자리 잡기는 공통 팝오버(shared/ui/popover)를 쓴다.
import type React from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import { placeBelow, placeRight } from '@/shared/ui/popover/placement';
import { useDismiss } from '@/shared/ui/popover/useDismiss';

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
		const size = { width: panelRef.current?.offsetWidth ?? 240, height: panelRef.current?.offsetHeight ?? 0 };
		setPosition(placement === 'right' ? placeRight(rect, size) : placeBelow(rect, size, { align: 'center', gap: 8 }));
	}, [open, fallback, placement, anchorKey]);

	useDismiss(open, () => setOpen(false), [panelRef, buttonRef], { keepOpenInside });

	return { open, setOpen, buttonRef, panelRef, position };
}
