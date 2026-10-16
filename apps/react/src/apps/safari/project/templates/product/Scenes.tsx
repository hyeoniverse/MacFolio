// product 템플릿의 스크롤 장면: 무대(sticky) 하나에 장면을 겹쳐 두고, 무대 뒤의 보이지 않는 칸을 지나갈 때마다 다음 장면으로
// 서서히 바뀐다(IntersectionObserver). 오른쪽의 점 단추로 장면을 바로 고를 수 있다. 움직임 줄이기면 장면을 위아래로 늘어놓는다 (CSS)
import React, { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '@/apps/safari/project/reveal';
import { scrollParent } from '@/apps/safari/project/scroll';

export const ScrollStory: React.FC<{
	/** 장면마다의 이름 (점 단추가 읽는다) */
	names: string[];
	/** 점 단추 묶음의 이름 */
	navLabel: string;
	className?: string;
	children: (index: number, active: boolean) => React.ReactNode;
}> = ({ names, navLabel, className, children }) => {
	const track = useRef<HTMLDivElement>(null);
	const [active, setActive] = useState(0);
	const count = names.length;

	useEffect(() => {
		const node = track.current;
		if (!node || count < 2 || typeof IntersectionObserver === 'undefined') return;
		// 화면 가운데 줄을 지나는 칸이 지금 장면이다
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries)
					if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.step));
			},
			{ root: scrollParent(node), rootMargin: '-50% 0px -50% 0px', threshold: 0 }
		);
		node.querySelectorAll('[data-step]').forEach((step) => observer.observe(step));
		return () => observer.disconnect();
	}, [count]);

	const go = (index: number) => {
		const step = track.current?.querySelector(`[data-step="${index}"]`);
		step?.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
		setActive(index);
	};

	return (
		<div
			className={['pd-reel', className].filter(Boolean).join(' ')}
			data-single={count < 2 ? '' : undefined}
			style={{ '--n': count } as React.CSSProperties}
		>
			<div className="pd-reel-stage">
				<ol className="pd-reel-layers">
					{names.map((name, index) => (
						<li key={`${index}-${name}`} className="pd-reel-layer" data-active={index === active ? '' : undefined}>
							{children(index, index === active)}
						</li>
					))}
				</ol>
				{count > 1 && (
					<nav className="pd-reel-dots" aria-label={navLabel}>
						{names.map((name, index) => (
							<button
								key={`${index}-${name}`}
								type="button"
								aria-label={name}
								aria-current={index === active ? 'step' : undefined}
								onClick={() => go(index)}
							/>
						))}
					</nav>
				)}
			</div>
			{count > 1 && (
				<div ref={track} className="pd-reel-track" aria-hidden="true">
					{names.map((name, index) => (
						<div key={`${index}-${name}`} data-step={index} />
					))}
				</div>
			)}
		</div>
	);
};
