// keynote 템플릿의 큰 숫자: "1,800명"을 앞말·숫자·뒷말로 나눠 숫자만 크게 그리고, 무대에 들어오면 0부터 한 번 세어 올라간다.
// 보조 기술과 시험은 처음부터 끝 값을 읽는다 (세는 글자는 장식). 움직임 줄이기면 세지 않고 끝 값을 보인다
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '@/apps/safari/project/reveal';
import { scrollParent } from '@/apps/safari/project/scroll';
import { partialFigure, splitFigure } from './count';

const DURATION = 1100;

export const Figure: React.FC<{ value: string; className?: string }> = ({ value, className }) => {
	const parts = splitFigure(value);
	const number = parts?.number;
	const ref = useRef<HTMLSpanElement>(null);
	const [shown, setShown] = useState<string | null>(null);

	useLayoutEffect(() => {
		// 숫자가 바뀌면 처음부터 다시 센다
		if (!number || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return;
		setShown(partialFigure(number, 0));
	}, [number]);

	useEffect(() => {
		const node = ref.current;
		if (!node || !number || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return;
		let frame = 0;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry.isIntersecting) return;
				observer.disconnect();
				const start = performance.now();
				frame = requestAnimationFrame(function tick(now) {
					const t = Math.min(1, (now - start) / DURATION);
					setShown(t < 1 ? partialFigure(number, 1 - (1 - t) ** 3) : null);
					if (t < 1) frame = requestAnimationFrame(tick);
				});
			},
			{ root: scrollParent(node), threshold: 0.6 }
		);
		observer.observe(node);
		return () => {
			observer.disconnect();
			cancelAnimationFrame(frame);
		};
	}, [number]);

	const cls = ['kn-figure', className].filter(Boolean).join(' ');
	if (!parts) return <strong className={cls}>{value}</strong>;
	return (
		<strong className={cls}>
			<span className="visually-hidden">{value}</span>
			<span aria-hidden="true" ref={ref}>
				{parts.before && <span className="kn-unit">{parts.before}</span>}
				<span className="kn-digits">{shown ?? parts.number}</span>
				{parts.after && <span className="kn-unit">{parts.after}</span>}
			</span>
		</strong>
	);
};
