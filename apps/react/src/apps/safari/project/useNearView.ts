import { useEffect, useState, type RefObject } from 'react';

/**
 * 요소가 화면 가까이(위아래 margin 안) 온 적이 있는지. 한 번 오면 계속 true.
 * 프로젝트 페이지의 영상은 이때 주소(src·poster)를 넣는다: 처음 연 Safari가 화면 밖 영상·첫 화면 그림까지
 * 한꺼번에 받아(수 MB) 첫 방문이 느려지던 것을 막는다. IntersectionObserver가 없으면 처음부터 true
 */
export function useNearView(ref: RefObject<Element | null>, margin = '400px'): boolean {
	const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined');
	useEffect(() => {
		const node = ref.current;
		if (near || !node) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry.isIntersecting) return;
				setNear(true);
				observer.disconnect();
			},
			{ rootMargin: `${margin} 0px` }
		);
		observer.observe(node);
		return () => observer.disconnect();
	}, [ref, margin, near]);
	return near;
}
