import { useEffect, useRef } from 'react';
import { canStartSwipe, classifyMove, type SwipeDirection } from '@/desktop/mobile/swipe';

interface Options {
	/** 켜져 있을 때만 듣는다 */
	enabled: boolean;
	direction: SwipeDirection;
	/** 쓰는 중인 거리 (그 방향으로, 0 이상) */
	onMove: (distance: number) => void;
	/** 손을 뗐다 */
	onEnd: (distance: number) => void;
	/** 쓰다가 취소되었다 (브라우저가 손가락을 가져갔다 등) */
	onCancel: () => void;
}

/** 쓸고 난 직후의 click은 버린다 (쓸기를 시작한 단추가 눌리지 않게) */
const CLICK_AFTER_SWIPE_MS = 500;

/**
 * 화면 어디서 시작하든 세로로 쓰는 동작을 듣는다 (제어 센터 여닫기).
 * - 마우스·펜은 Pointer Events, 손가락은 Touch Events로 듣는다.
 *   손가락은 브라우저가 스크롤로 가져가면 pointercancel이 나므로, 쓸기로 판단한 순간 touchmove를 막아 스크롤을 멈춘다.
 * - 입력 칸, 막대(slider), 홈 인디케이터처럼 스스로 끄는 요소와, 그 방향으로 스크롤할 내용이 남은 곳에서는 시작하지 않는다.
 */
export function useVerticalSwipe({ enabled, direction, onMove, onEnd, onCancel }: Options) {
	const handlers = useRef({ onMove, onEnd, onCancel });
	useEffect(() => {
		handlers.current = { onMove, onEnd, onCancel };
	});

	useEffect(() => {
		if (!enabled) return;
		let start: { x: number; y: number } | null = null;
		let state: 'undecided' | 'swipe' | 'other' = 'undecided';
		let ignoreClickUntil = 0;

		const distanceTo = (y: number) => Math.max(0, direction === 'down' ? y - start!.y : start!.y - y);

		const begin = (x: number, y: number, target: EventTarget | null) => {
			start = canStartSwipe(target, direction) ? { x, y } : null;
			state = 'undecided';
		};
		/** 쓸기로 판단했으면 true */
		const move = (x: number, y: number) => {
			if (!start || state === 'other') return false;
			if (state === 'undecided') state = classifyMove(x - start.x, y - start.y, direction);
			if (state !== 'swipe') return false;
			handlers.current.onMove(distanceTo(y));
			return true;
		};
		const end = (y: number) => {
			if (start && state === 'swipe') {
				handlers.current.onEnd(distanceTo(y));
				ignoreClickUntil = Date.now() + CLICK_AFTER_SWIPE_MS;
			}
			start = null;
			state = 'undecided';
		};
		const cancel = () => {
			if (start && state === 'swipe') handlers.current.onCancel();
			start = null;
			state = 'undecided';
		};

		// 마우스·펜 (손가락은 아래 Touch Events에서)
		const pointerDown = (event: PointerEvent) => {
			if (event.pointerType !== 'touch' && event.button === 0) begin(event.clientX, event.clientY, event.target);
		};
		const pointerMove = (event: PointerEvent) => {
			if (event.pointerType !== 'touch') move(event.clientX, event.clientY);
		};
		const pointerUp = (event: PointerEvent) => {
			if (event.pointerType !== 'touch') end(event.clientY);
		};
		const pointerCancel = (event: PointerEvent) => {
			if (event.pointerType !== 'touch') cancel();
		};

		const touchStart = (event: TouchEvent) => {
			if (event.touches.length !== 1) return cancel();
			begin(event.touches[0].clientX, event.touches[0].clientY, event.target);
		};
		const touchMove = (event: TouchEvent) => {
			const touch = event.touches[0];
			// 쓸기로 판단했으면 브라우저 스크롤을 막는다
			if (touch && move(touch.clientX, touch.clientY) && event.cancelable) event.preventDefault();
		};
		const touchEnd = (event: TouchEvent) => end(event.changedTouches[0].clientY);

		const click = (event: MouseEvent) => {
			if (Date.now() > ignoreClickUntil) return;
			ignoreClickUntil = 0;
			event.preventDefault();
			event.stopPropagation();
		};

		// 캡처 단계에서 들어야 요소가 setPointerCapture를 해도, 이벤트를 멈춰도 놓치지 않는다
		const listeners: [string, EventListener, AddEventListenerOptions][] = [
			['pointerdown', pointerDown as EventListener, { capture: true }],
			['pointermove', pointerMove as EventListener, { capture: true }],
			['pointerup', pointerUp as EventListener, { capture: true }],
			['pointercancel', pointerCancel as EventListener, { capture: true }],
			['touchstart', touchStart as EventListener, { capture: true, passive: true }],
			['touchmove', touchMove as EventListener, { capture: true, passive: false }],
			['touchend', touchEnd as EventListener, { capture: true }],
			['touchcancel', cancel, { capture: true }],
			['click', click as EventListener, { capture: true }],
		];
		listeners.forEach(([type, listener, options]) => document.addEventListener(type, listener, options));
		return () =>
			listeners.forEach(([type, listener, options]) => document.removeEventListener(type, listener, options));
	}, [enabled, direction]);
}
