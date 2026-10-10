import { useState, useEffect, useRef } from 'react';
import { scrollParent } from '@/apps/safari/project/scroll';

/** 화면(페이지를 스크롤하는 칸)에 ratio만큼 들어와 있는지 */
export const useInView = <T extends HTMLElement>(ratio = 0.5) => {
	const ref = useRef<T>(null);
	// 관찰할 수 없는 곳(시험 환경 등)에서는 늘 보이는 것으로 둔다
	const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined');
	useEffect(() => {
		const node = ref.current;
		if (!node || typeof IntersectionObserver === 'undefined') return;
		const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
			root: scrollParent(node),
			threshold: ratio,
		});
		observer.observe(node);
		return () => observer.disconnect();
	}, [ratio]);
	return [ref, inView] as const;
};
