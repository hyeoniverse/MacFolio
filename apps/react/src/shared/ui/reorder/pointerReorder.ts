import type React from 'react';

/**
 * ≡ 손잡이로 끄는 순서 바꾸기 (iOS처럼). 손잡이의 pointerdown에서 부른다.
 * 잡은 줄(손잡이를 감싼 li)은 손가락을 따라 움직이고, 지나간 줄은 그 자리만큼 비켜 준다.
 * 끄는 동안 잡은 줄에 .reordering을 붙인다. 놓으면 onDrop(원래 자리, 새 자리, 줄 목록)을 부른다 (자리가 같으면 부르지 않는다).
 * isItem: 같은 목록 안에서 함께 움직일 줄 (기본: li 전부)
 */
export function startPointerReorder(
	event: React.PointerEvent<HTMLElement>,
	onDrop: (from: number, to: number, items: HTMLElement[]) => void,
	isItem: (el: HTMLElement) => boolean = (el) => el.tagName === 'LI'
) {
	event.preventDefault();
	const li = event.currentTarget.closest('li');
	const list = li?.parentElement;
	if (!li || !list) return;
	const items = [...list.children].filter((el): el is HTMLElement => el instanceof HTMLElement && isItem(el));
	const rects = items.map((el) => el.getBoundingClientRect());
	const from = items.indexOf(li);
	if (from === -1) return;
	const height = rects[from].height;
	const startY = event.clientY;
	let to = from;
	li.classList.add('reordering');
	const move = (moveEvent: PointerEvent) => {
		const dy = moveEvent.clientY - startY;
		const center = rects[from].top + height / 2 + dy;
		const found = rects.findIndex((rect) => center < rect.top + rect.height / 2);
		to = found === -1 ? rects.length - 1 : found > from ? found - 1 : found;
		li.style.transform = `translateY(${dy}px)`;
		items.forEach((el, index) => {
			if (index === from) return;
			const shift =
				from < to && index > from && index <= to ? -height : from > to && index >= to && index < from ? height : 0;
			el.style.transform = shift ? `translateY(${shift}px)` : '';
		});
	};
	const end = () => {
		window.removeEventListener('pointermove', move);
		window.removeEventListener('pointerup', end);
		window.removeEventListener('pointercancel', end);
		li.classList.remove('reordering');
		items.forEach((el) => (el.style.transform = ''));
		if (to !== from) onDrop(from, to, items);
	};
	window.addEventListener('pointermove', move);
	window.addEventListener('pointerup', end);
	window.addEventListener('pointercancel', end);
}

/** 손잡이의 ↑·↓ 키 → -1·1 (다른 키는 0) */
export const reorderKeyDelta = (key: string) => (key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0);
