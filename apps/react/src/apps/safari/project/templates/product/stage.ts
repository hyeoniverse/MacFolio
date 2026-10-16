// product 템플릿의 장면 높이: 스크롤 상자(Safari 탭 패널)의 높이를 재어 --pd-vh로 둔다
import { useEffect, type RefObject } from 'react';
import { scrollParent } from '@/apps/safari/project/scroll';

/** 스크롤 상자의 높이를 --pd-vh(px)로 둔다: 장면 하나가 Safari 페이지 한 화면을 채운다 */
export function useStageHeight(ref: RefObject<HTMLElement | null>) {
	useEffect(() => {
		const node = ref.current;
		if (!node) return;
		const scroller = scrollParent(node);
		const measure = () => {
			const height = scroller ? scroller.clientHeight : window.innerHeight;
			if (height > 0) node.style.setProperty('--pd-vh', `${height}px`);
		};
		measure();
		window.addEventListener('resize', measure);
		const observer = typeof ResizeObserver === 'undefined' || !scroller ? null : new ResizeObserver(measure);
		observer?.observe(scroller!);
		return () => {
			window.removeEventListener('resize', measure);
			observer?.disconnect();
		};
	}, [ref]);
}
