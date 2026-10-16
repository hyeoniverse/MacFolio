// product 템플릿의 화면 모음: 옆으로 넘기는 큰 화면 띠. 한 장씩 맞춰 멈추고(scroll snap), 아래 오른쪽의 둥근 단추로 앞뒤로 넘긴다
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '@/apps/safari/project/reveal';
import { Media, type LandingShot } from '@/apps/safari/project/landing';

export const Gallery: React.FC<{ shots: LandingShot[] }> = ({ shots }) => {
	const track = useRef<HTMLUListElement>(null);
	const [edge, setEdge] = useState({ start: true, end: shots.length < 2 });

	const measure = useCallback(() => {
		const node = track.current;
		if (!node) return;
		setEdge({
			start: node.scrollLeft <= 4,
			end: node.scrollLeft + node.clientWidth >= node.scrollWidth - 4,
		});
	}, []);

	useEffect(() => {
		const node = track.current;
		if (!node) return;
		measure();
		node.addEventListener('scroll', measure, { passive: true });
		const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
		resize?.observe(node);
		return () => {
			node.removeEventListener('scroll', measure);
			resize?.disconnect();
		};
	}, [measure]);

	const move = (direction: 1 | -1) => {
		const node = track.current;
		const item = node?.querySelector('li');
		if (!node || !item) return;
		node.scrollBy({
			left: direction * (item.getBoundingClientRect().width + 24),
			behavior: prefersReducedMotion() ? 'auto' : 'smooth',
		});
	};

	return (
		<div className="pd-gallery">
			<ul ref={track} className="pd-gallery-track">
				{shots.map((shot, index) => (
					<li key={shot.src}>
						<figure>
							<Media media={shot} className="pd-framed" />
							<figcaption>
								<span className="pd-gallery-index">
									{index + 1} / {shots.length}
								</span>
								{shot.caption}
							</figcaption>
						</figure>
					</li>
				))}
			</ul>
			{shots.length > 1 && (
				<div className="pd-paddles">
					<button type="button" aria-label="이전 화면" disabled={edge.start} onClick={() => move(-1)}>
						<i className="fa-solid fa-chevron-left" aria-hidden="true" />
					</button>
					<button type="button" aria-label="다음 화면" disabled={edge.end} onClick={() => move(1)}>
						<i className="fa-solid fa-chevron-right" aria-hidden="true" />
					</button>
				</div>
			)}
		</div>
	);
};
