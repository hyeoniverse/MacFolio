import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/**
 * 요소의 폭(px). 재기 전에는 Infinity.
 * 앱 창을 최소화하면 창 안의 요소만 빠지고 앱 컴포넌트(이 훅)는 남는다. 다시 열 때 새로 생긴 요소를 재야 하므로
 * ref 객체가 아니라 붙이는 함수(attach)로 요소를 받는다. 요소를 쓸 곳이 있으면 ref로 읽는다
 */
export function useElementWidth<T extends HTMLElement>() {
	const ref = useRef<T | null>(null);
	const [element, setElement] = useState<T | null>(null);
	const attach = useCallback((node: T | null) => {
		ref.current = node;
		setElement(node);
	}, []);
	const [width, setWidth] = useState(Infinity);
	useLayoutEffect(() => {
		if (!element) return;
		// 관찰을 시작하면 곧바로 지금 폭을 한 번 알려 준다 (그리기 전에).
		// 문서에서 빠지는 순간의 0은 재지 않는다 (그대로 두면 다시 열었을 때 좁은 창 모양으로 남는다)
		const observer = new ResizeObserver(([entry]) => {
			if (entry.contentRect.width > 0) setWidth(entry.contentRect.width);
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, [element]);
	return { ref, attach, width };
}
