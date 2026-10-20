import { useEffect, useState } from 'react';
import { useIsMobile } from '@/shared/hooks/useIsMobile';

/** 날씨 칸이 이 폭 이하면 iOS 날씨 모양(날씨만, 아래 막대, 덮어 여는 목록)으로 (Weather.css의 [data-compact]) */
const COMPACT_WIDTH = 640;

/**
 * iOS 날씨 모양으로 볼지. 휴대폰 화면이면 폭과 상관없이 그렇게 본다:
 * 휴대폰 셸은 767px까지(눕힌 휴대폰은 더 넓다) 쓰는데, 폭만 보면 641~767px에서 넓은 창 모양이 휴대폰 화면 안에 그려졌다
 */
export function useCompact(ref: React.RefObject<HTMLElement | null>) {
	const phone = useIsMobile();
	const [width, setWidth] = useState(Infinity);
	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
		observer.observe(element);
		return () => observer.disconnect();
	}, [ref]);
	return phone || width <= COMPACT_WIDTH;
}
