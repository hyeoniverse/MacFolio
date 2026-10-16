// friendly의 기능 탐색기: 왼쪽에 기능 목록(아이콘, 제목, 한 줄), 고른 기능은 펼쳐 자세한 설명을 보이고, 오른쪽 큰 창은 그 기능의 화면으로 바뀐다.
// 그림이 없는 기능은 기능 내용으로 그린 앱 화면 모형을 보인다. 천천히 다음 기능으로 넘어가며 고른 항목에 진행 선을 긋고,
// 마우스를 올리거나 초점이 들어오면 멈춘다. 직접 고르면 그 뒤로는 넘어가지 않고, 움직임 줄이기면 처음부터 넘어가지 않는다.
// 모든 기능의 화면은 늘 그려 두고 고른 것만 보인다 (그림이 미리 읽히고, 바뀔 때 창의 높이가 흔들리지 않는다)
import React, { useEffect, useId, useRef, useState } from 'react';
import { prefersReducedMotion } from '@/apps/safari/project/reveal';
import { scrollParent } from '@/apps/safari/project/scroll';
import { iconOf, Media, type LandingPoint } from '@/apps/safari/project/landing';
import { Frame } from './Frame';
import { seeded } from './seeded';

/** 한 기능에 머무는 시간 (진행 선이 끝까지 차는 시간, ms) */
const DWELL = 7000;

/** 그림이 없는 기능의 앱 화면 모형: 옆 막대는 기능 목록, 본문은 고른 기능의 제목·설명·자세한 설명과 고정된 막대그래프 (장식) */
const PointMock: React.FC<{ items: LandingPoint[]; index: number; name: string }> = ({ items, index, name }) => {
	const point = items[index];
	const rand = seeded(point.title);
	const bars = Array.from({ length: 10 }, (_, i) => Math.round(28 + (i / 9) * 50 + (rand() - 0.5) * 30));
	return (
		<div className="fr-pm" aria-hidden="true">
			<div className="fr-pm-side">
				<span className="fr-pm-brand">
					<b>{Array.from(name.trim())[0] ?? '·'}</b>
					<span>{name}</span>
				</span>
				<ul>
					{items.slice(0, 6).map((item, i) => (
						<li key={item.title} data-active={i === index ? '' : undefined}>
							<i className={`fa-solid ${iconOf(item, i)}`} />
							<span>{item.title}</span>
						</li>
					))}
				</ul>
			</div>
			<div className="fr-pm-main">
				<div className="fr-pm-head">
					<span className="fr-pm-icon">
						<i className={`fa-solid ${iconOf(point, index)}`} />
					</span>
					<div>
						<strong>{point.title}</strong>
						<span className="fr-pm-skel" style={{ width: '46%' }} />
					</div>
					<span className="fr-pm-button" />
				</div>
				<div className="fr-pm-card">
					<p>{point.body}</p>
					{point.detail && <p className="fr-pm-detail">{point.detail}</p>}
				</div>
				<div className="fr-pm-grid">
					<div className="fr-pm-chart">
						<span className="fr-pm-skel" style={{ width: '38%' }} />
						<span className="fr-pm-bars">
							{bars.map((height, i) => (
								<i key={i} style={{ height: `${Math.min(100, height)}%` }} />
							))}
						</span>
					</div>
					<div className="fr-pm-rows">
						{[72, 54, 64, 40].map((width, i) => (
							<span key={i} className="fr-pm-row">
								<i />
								<span className="fr-pm-skel" style={{ width: `${width}%` }} />
							</span>
						))}
					</div>
				</div>
			</div>
		</div>
	);
};

/** 고른 기능의 화면: 그림이 한 장이면 창 가득, 여러 장이면 첫 장을 크게 두고 나머지를 옆 칸에 차례로 쌓는다 */
const PointScreen: React.FC<{ point: LandingPoint }> = ({ point }) => (
	<div className="fr-ex-media" data-count={Math.min(point.media.length, 3)}>
		{point.media.map((media) => (
			<Media key={media.src} media={media} />
		))}
	</div>
);

export const Explorer: React.FC<{ items: LandingPoint[]; address: string; name: string }> = ({
	items,
	address,
	name,
}) => {
	const id = useId();
	const root = useRef<HTMLDivElement>(null);
	const [active, setActive] = useState(0);
	const [chosen, setChosen] = useState(false);
	const [hovered, setHovered] = useState(false);
	const [focused, setFocused] = useState(false);
	const [inView, setInView] = useState(false);
	const [reduced] = useState(prefersReducedMotion);
	const auto = items.length > 1 && !reduced && !chosen;
	const running = auto && inView && !hovered && !focused;

	// 화면에 들어와 있을 때만 넘어간다
	useEffect(() => {
		const node = root.current;
		if (!node || !auto || typeof IntersectionObserver === 'undefined') return;
		const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
			root: scrollParent(node),
			threshold: 0.35,
		});
		observer.observe(node);
		return () => observer.disconnect();
	}, [auto]);

	const choose = (index: number) => {
		setChosen(true);
		setActive(index);
	};
	const current = Math.min(active, items.length - 1);

	return (
		<div
			ref={root}
			className="fr-ex"
			data-auto={auto ? '' : undefined}
			data-count={items.length}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			onFocus={() => setFocused(true)}
			onBlur={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
			}}
		>
			<ol className="fr-ex-list">
				{items.map((point, i) => {
					const on = i === current;
					return (
						<li key={point.title} data-active={on ? '' : undefined} onClick={() => choose(i)}>
							<span className="fr-ex-track" aria-hidden="true">
								{on && auto && (
									<span
										className="fr-ex-progress"
										style={{ animationDuration: `${DWELL}ms`, animationPlayState: running ? 'running' : 'paused' }}
										onAnimationEnd={() => setActive((value) => (value + 1) % items.length)}
									/>
								)}
							</span>
							<h3 className="fr-ex-title">
								<button
									type="button"
									aria-expanded={on}
									aria-controls={`${id}-stage`}
									onClick={(event) => {
										event.stopPropagation();
										choose(i);
									}}
								>
									<span className="fr-icon" aria-hidden="true">
										<i className={`fa-solid ${iconOf(point, i)}`} />
									</span>
									{point.title}
								</button>
							</h3>
							<p className="fr-ex-body">{point.body}</p>
							{point.detail && (
								<p className="fr-ex-detail" hidden={!on}>
									{point.detail}
								</p>
							)}
						</li>
					);
				})}
			</ol>
			<div className="fr-ex-stage" id={`${id}-stage`} data-reveal="zoom">
				<Frame address={address} className="fr-ex-window">
					<div className="fr-ex-views">
						{items.map((point, i) => (
							<div
								key={point.title}
								className="fr-ex-view"
								data-active={i === current ? '' : undefined}
								aria-hidden={i === current ? undefined : true}
							>
								{point.media.length ? <PointScreen point={point} /> : <PointMock items={items} index={i} name={name} />}
							</div>
						))}
					</div>
				</Frame>
				<p className="fr-ex-caption">
					<span className="fr-num">
						{String(current + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
					</span>
					{items[current].title}
				</p>
			</div>
		</div>
	);
};
