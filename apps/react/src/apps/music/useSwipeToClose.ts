import { useRef, useState } from 'react';
import type React from 'react';
import { prefersReducedMotion } from '@/shared/lib/media';
import { shouldCloseSwipe, swipeVelocity, type SwipeSample } from './swipe';

/** 손가락이 이만큼(px) 움직이기 전에는 누른 것으로 본다 */
const TAP_SLOP = 6;

/**
 * iOS 시트처럼 아래로 쓸어내려 닫기. 돌려준 handlers(이벤트 처리기와 data-swipe-ignore)를 쓸어내리기를 시작할 수 있는 요소(손잡이, 표지·제목 머리)에 건다.
 * 끄는 동안 offset만큼 시트가 따라 내려가고, 놓을 때 거리나 속도가 기준을 넘으면 onClose, 아니면 offset이 null로 돌아가
 * CSS 전환으로 제자리에 돌아온다. 닫을 때는 offset을 그대로 두어 Sheet의 닫힘 움직임(sheet-out)이 그 자리에서 이어진다.
 * 움직임 줄이기면 따라 내려가지 않고(offset 없음) 기준을 넘으면 닫기만 한다.
 * dragged는 방금 끈 것인지(끈 뒤의 click을 누르기로 보지 않게)
 */
export function useSwipeToClose(onClose: () => void) {
	const [offset, setOffset] = useState<number | null>(null);
	const start = useRef<{ y: number; pointerId: number } | null>(null);
	const samples = useRef<SwipeSample[]>([]);
	const dragged = useRef(false);

	const distanceOf = (event: React.PointerEvent) => Math.max(0, event.clientY - (start.current?.y ?? event.clientY));

	const handlers = {
		// 셸의 '아래로 쓸면 제어 센터' 동작(desktop/mobile/useVerticalSwipe)이 이 쓸기를 가져가지 않게
		'data-swipe-ignore': true,
		onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
			if (event.button !== 0) return;
			start.current = { y: event.clientY, pointerId: event.pointerId };
			samples.current = [{ y: event.clientY, time: event.timeStamp }];
			dragged.current = false;
			event.currentTarget.setPointerCapture(event.pointerId);
		},
		onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
			if (start.current?.pointerId !== event.pointerId) return;
			const distance = distanceOf(event);
			samples.current.push({ y: event.clientY, time: event.timeStamp });
			if (!dragged.current && distance > TAP_SLOP) dragged.current = true;
			if (dragged.current && !prefersReducedMotion()) setOffset(distance);
		},
		onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
			if (start.current?.pointerId !== event.pointerId) return;
			const distance = distanceOf(event);
			samples.current.push({ y: event.clientY, time: event.timeStamp });
			start.current = null;
			if (dragged.current && shouldCloseSwipe(distance, swipeVelocity(samples.current))) onClose();
			else setOffset(null);
		},
		onPointerCancel: () => {
			start.current = null;
			dragged.current = false;
			setOffset(null);
		},
	};

	return { offset, handlers, dragged };
}
