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
