import { useEffect, useState } from 'react';

/**
 * 이 폭 이하면 한 칸씩 보인다 (Memo.css의 [data-compact] 규칙이 이 값을 따른다).
 * 폴더·목록·본문 세 칸을 나란히 두기에 700px보다 좁으면 본문이 너무 좁아진다
 */
const COMPACT_WIDTH = 700;

/** 이 폭 이하면 폴더 사이드바를 처음에 닫아 둔다 (macOS 메모처럼). 목록과 본문에 자리를 준다 */
const NARROW_WIDTH = 860;

/** 메모 창의 폭으로 정하는 모양: 한 칸씩(compact), 사이드바를 닫아 둘 만큼 좁음(narrow) */
export function useShellSize(ref: React.RefObject<HTMLElement | null>) {
	const [width, setWidth] = useState(Infinity);
	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
		observer.observe(element);
		return () => observer.disconnect();
	}, [ref]);
	return { compact: width <= COMPACT_WIDTH, narrow: width <= NARROW_WIDTH };
}
