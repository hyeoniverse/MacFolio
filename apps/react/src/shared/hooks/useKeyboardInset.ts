import { useEffect, useState } from 'react';

/** 이보다 작게 줄면 화면 키보드가 아니라 주소창이 접히고 펴진 것으로 본다 */
const MIN_KEYBOARD_PX = 120;

/**
 * 화면 키보드가 화면 아래를 가린 높이 (px, 없으면 0).
 * iOS Safari는 키보드가 올라와도 화면(레이아웃 뷰포트)을 줄이지 않고, 보이는 곳(visualViewport)만 줄인다.
 * 그래서 화면 맨 아래에 붙인 것은 키보드 뒤에 깔린다. 키보드 위에 띄울 것은 이 높이만큼 올린다
 */
export function keyboardInset(): number {
	const viewport = window.visualViewport;
	if (!viewport) return 0;
	const hidden = window.innerHeight - (viewport.height + viewport.offsetTop);
	return hidden >= MIN_KEYBOARD_PX ? Math.round(hidden) : 0;
}

/** keyboardInset()을 키보드가 오르내릴 때마다 다시 읽는다 */
export function useKeyboardInset(enabled = true): number {
	const [inset, setInset] = useState(0);
	useEffect(() => {
		const viewport = window.visualViewport;
		if (!enabled || !viewport) return;
		const update = () => setInset(keyboardInset());
		update();
		viewport.addEventListener('resize', update);
		viewport.addEventListener('scroll', update);
		return () => {
			viewport.removeEventListener('resize', update);
			viewport.removeEventListener('scroll', update);
			setInset(0);
		};
	}, [enabled]);
	return enabled ? inset : 0;
}

/** 화면 키보드가 올라와 있는 동안 보이는 곳: 레이아웃 뷰포트 맨 위에서 떨어진 거리(top)와 높이(px) */
export interface KeyboardViewport {
	top: number;
	height: number;
}

/**
 * 화면 키보드가 올라와 있으면 보이는 곳(visualViewport)의 위치와 높이, 아니면 null.
 * iOS Safari는 아래쪽 입력 칸에 초점이 가면 레이아웃 뷰포트를 줄이지 않고, 보이는 곳을 아래로 옮겨(offsetTop) 입력 칸을 키보드 위에 맞춘다.
 * 그래서 화면에 고정한 머리도 offsetTop만큼 화면 밖으로 밀려 올라간다. keyboardInset()은 offsetTop을 빼고 재므로
 * 보이는 곳이 다 옮겨 가면 0이 된다. 여기서는 키보드 높이를 innerHeight - visualViewport.height로 재어 옮겨 간 정도와 상관없이 판정한다
 */
export function keyboardViewport(): KeyboardViewport | null {
	const viewport = window.visualViewport;
	if (!viewport) return null;
	if (window.innerHeight - viewport.height < MIN_KEYBOARD_PX) return null;
	return { top: Math.round(viewport.offsetTop), height: Math.round(viewport.height) };
}

/** keyboardViewport()를 키보드가 오르내리거나 보이는 곳이 옮겨 갈 때마다 다시 읽는다 */
export function useKeyboardViewport(enabled = true): KeyboardViewport | null {
	const [box, setBox] = useState<KeyboardViewport | null>(null);
	useEffect(() => {
		const viewport = window.visualViewport;
		if (!enabled || !viewport) return;
		const update = () =>
			setBox((previous) => {
				const next = keyboardViewport();
				return previous && next && previous.top === next.top && previous.height === next.height ? previous : next;
			});
		update();
		viewport.addEventListener('resize', update);
		viewport.addEventListener('scroll', update);
		return () => {
			viewport.removeEventListener('resize', update);
			viewport.removeEventListener('scroll', update);
			setBox(null);
		};
	}, [enabled]);
	return enabled ? box : null;
}
