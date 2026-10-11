// 가로 모양: 세로 스크롤이 가로로 늘어선 패널들을 밀어 간다. 패널마다 바탕색이 뚜렷하게 바뀌고 글자는 배경보다 느리게 따라온다
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Project, ProjectPoint } from '@/shared/profile';
import { FactValue, Links, Region } from '@/apps/safari/project/parts';
import { prefersReducedMotion, useReveal } from '@/apps/safari/project/reveal';
import { onScrollFrame, viewOf } from '@/apps/safari/project/scroll';
import { cssVars } from '@/shared/lib/cssVars';
import '@/apps/safari/project/HorizontalPage.css';

/** 이보다 좁으면 가로 트랙을 풀고 세로로 쌓는다 */
const NARROW = 700;
/** 패널 바탕 네 가지가 차례로 돈다 (CSS의 --hz-bg-0 … --hz-bg-3) */
const TONES = 4;

const pad = (n: number) => String(n).padStart(2, '0');

/** 그림이나 짧은 영상 한 장 (트랙이 가로로 밀려 와서 보이므로 lazy로 두면 패널이 닿았을 때 아직 안 떠 있다) */
const Media: React.FC<{ src: string; alt: string; className?: string }> = ({ src, alt, className }) =>
	src.endsWith('.mp4') ? (
		<video className={className} src={src} muted loop playsInline autoPlay aria-label={alt} />
	) : (
		<img className={className} src={src} alt={alt} />
	);

const pointImage = (point: ProjectPoint) =>
	point.image ?? point.video ?? point.shots?.[0]?.src ?? point.scrollFrames?.[0];

/** 패널 하나: 번호(i)에 따라 바탕색이 돌고, 글(.hz-text)은 트랙보다 느리게 움직인다 */
const Panel: React.FC<{ index: number; label?: string; className?: string; children: React.ReactNode }> = ({
	index,
	label,
	className = '',
	children,
}) => (
	<section
		className={`hz-panel ${className}`}
		data-tone={index % TONES}
		data-panel={index}
		data-no={pad(index + 1)}
		aria-label={label}
		style={cssVars({ i: index })}
	>
		{children}
	</section>
);

/** 표지: 거대한 이름, 한 줄 제목, 링크. 대표 화면은 기울어져 오른쪽 밖으로 걸친다 (마우스를 따라 살짝 기운다) */
const Cover: React.FC<{ project: Project; index: number }> = ({ project, index }) => {
	const ref = useRef<HTMLDivElement>(null);
	const tilt = (event: React.MouseEvent) => {
		const node = ref.current;
		if (!node || prefersReducedMotion()) return;
		const box = node.getBoundingClientRect();
		node.style.setProperty('--hz-mx', String((event.clientX - box.left) / box.width - 0.5));
		node.style.setProperty('--hz-my', String((event.clientY - box.top) / box.height - 0.5));
	};
	return (
		<Panel index={index} className="hz-cover" label="표지">
			<div ref={ref} className="hz-cover-inner" onMouseMove={tilt}>
				<div className="hz-text">
					<p className="hz-kicker">
						{project.icon && <img src={project.icon} alt="" />}
						<span>{[project.context, project.period].filter(Boolean).join(' · ')}</span>
					</p>
					<h1 className="hz-name">{project.name}</h1>
					<p className="hz-tagline">{project.tagline}</p>
					{project.description && <p className="hz-lead">{project.description}</p>}
					<Links project={project} className="sp-links hz-links" />
					<p className="hz-hint" aria-hidden="true">
						아래로 스크롤 <span>→</span>
					</p>
				</div>
				{project.image && (
					<figure className="hz-cover-shot" aria-hidden="true">
						<Media src={project.image} alt="" />
					</figure>
				)}
			</div>
		</Panel>
	);
};

/** 숫자 패널: 값이 패널을 꽉 채우듯 거대하다 */
const FactsPanel: React.FC<{ project: Project; index: number }> = ({ project, index }) => (
	<Panel index={index} className="hz-facts" label="한눈에 보는 숫자">
		<ul className="hz-text">
			{project.facts.map((fact, i) => (
				<li key={fact.label} data-reveal="left" style={cssVars({ d: i })}>
					<FactValue text={fact.value} />
					<span>{fact.label}</span>
				</li>
			))}
		</ul>
	</Panel>
);

/** 주요 기능 하나에 패널 하나: 그림 크게, 글은 옆에. 홀수 번째는 그림이 오른쪽 */
const HighlightPanel: React.FC<{ point: ProjectPoint; index: number; order: number; total: number }> = ({
	point,
	index,
	order,
	total,
}) => {
	const image = pointImage(point);
	return (
		<Panel index={index} className={`hz-feature ${order % 2 ? 'flip' : ''} ${image ? '' : 'bare'}`}>
			<div className="hz-text">
				<p className="hz-eyebrow">
					주요 기능 <strong>{pad(order + 1)}</strong>
					<span> / {pad(total)}</span>
				</p>
				<h2>{point.title}</h2>
				<p className="hz-body">{point.body}</p>
				{point.detail && <p className="hz-detail">{point.detail}</p>}
			</div>
			{image && (
				<figure className="hz-feature-media" data-reveal="zoom">
					<Media src={image} alt={point.shots?.[0]?.alt ?? `${point.title} 화면`} />
				</figure>
			)}
		</Panel>
	);
};

/** 만든 방식: 카드가 가로로 한 줄 */
const BuildPanel: React.FC<{ points: ProjectPoint[]; index: number }> = ({ points, index }) => (
	<Panel index={index} className="hz-build" label="만든 방식">
		<div className="hz-text">
			<h2 className="hz-title">
				만든 방식<span>.</span>
			</h2>
			<ul className="hz-cards">
				{points.map((point, i) => (
					<li key={point.title} data-reveal="" style={cssVars({ d: i })}>
						<span className="hz-card-no">{pad(i + 1)}</span>
						<h3>{point.title}</h3>
						<p>{point.body}</p>
					</li>
				))}
			</ul>
		</div>
	</Panel>
);

/** 진행 과정: 가로 선 위에 날짜가 늘어선다 */
const TimelinePanel: React.FC<{ items: { date: string; label: string }[]; index: number }> = ({ items, index }) => (
	<Panel index={index} className="hz-timeline" label="진행 과정">
		<div className="hz-text">
			<h2 className="hz-title">
				진행 과정<span>.</span>
			</h2>
			<ol className="hz-rail">
				{items.map((item, i) => (
					<li key={`${item.date}-${item.label}`} data-reveal="" style={cssVars({ d: i })}>
						<time>{item.date}</time>
						<span>{item.label}</span>
					</li>
				))}
			</ol>
		</div>
	</Panel>
);

/** 기술 사양과 맡은 일을 나란히 */
const SpecsPanel: React.FC<{ project: Project; index: number }> = ({ project, index }) => (
	<Panel index={index} className="hz-specs">
		<div className="hz-text">
			{project.specs.length > 0 && (
				<Region label="기술 사양" className="hz-col">
					<h2 className="hz-title">
						기술 사양<span>.</span>
					</h2>
					<dl>
						{project.specs.map((spec) => (
							<div key={spec.label}>
								<dt>{spec.label}</dt>
								<dd>{spec.value}</dd>
							</div>
						))}
					</dl>
				</Region>
			)}
			{project.contributions.length > 0 && (
				<Region label="맡은 일" className="hz-col">
					<h2 className="hz-title">
						맡은 일<span>.</span>
					</h2>
					{project.role && <p className="hz-role">{project.role}</p>}
					<ul className="hz-checks">
						{project.contributions.map((item, i) => (
							<li key={item} data-reveal="left" style={cssVars({ d: i })}>
								<i className="fa-solid fa-check" aria-hidden="true" />
								{item}
							</li>
						))}
					</ul>
				</Region>
			)}
		</div>
	</Panel>
);

/** 끝: 큰 마침표와 링크 */
const EndPanel: React.FC<{ project: Project; index: number }> = ({ project, index }) => (
	<Panel index={index} className="hz-end" label="마무리">
		<div className="hz-text">
			<p className="hz-end-word">
				끝<span>.</span>
			</p>
			<p className="hz-lead">{project.tagline}</p>
			<Links project={project} className="sp-links hz-links" />
		</div>
	</Panel>
);

/**
 * 짜임: 바깥(.hz) 높이 = 패널 수 × 뷰 높이. 안쪽(.hz-view)은 sticky로 붙어 있고 그 안의 트랙(.hz-track)이 스크롤 진행도만큼
 * translateX로 밀린다. 패널 폭은 모두 뷰 폭이라 세로로 뷰 높이만큼 내리면 패널 하나가 넘어간다.
 * 좁은 창이거나 움직임 줄이기면 트랙을 풀고 패널을 세로로 쌓는다(stacked). 그때 단추는 scrollIntoView
 */
const HorizontalPage: React.FC<{ project: Project }> = ({ project }) => {
	const root = useReveal<HTMLDivElement>();
	const [mode, setMode] = useState<'track' | 'stacked'>('stacked');
	const [current, setCurrent] = useState(0);
	const stateRef = useRef({ viewH: 0, mode: 'stacked' as 'track' | 'stacked' });

	// 패널 차례 (없는 자료는 패널을 통째로 뺀다). 주요 기능 패널들은 '주요 기능' 구역으로 묶는다
	const sections = useMemo(() => {
		let n = 0;
		const next = () => n++;
		const cover = next();
		const facts = project.facts.length ? next() : null;
		const highlights = project.highlights.map(() => next());
		const build = project.build.length ? next() : null;
		const timeline = project.timeline?.length ? next() : null;
		const specs = project.specs.length || project.contributions.length ? next() : null;
		const end = next();
		return { cover, facts, highlights, build, timeline, specs, end, count: n };
	}, [project]);
	const { count } = sections;

	// 스크롤·크기마다: 모드 판단, 뷰 높이와 진행도를 CSS 변수로, 지금 패널 번호
	useEffect(() => {
		const node = root.current;
		if (!node) return;
		return onScrollFrame(node, (scroller) => {
			const { top: viewTop, height: viewH } = viewOf(scroller);
			const viewW = scroller ? scroller.clientWidth : window.innerWidth;
			const nextMode = prefersReducedMotion() || viewW < NARROW ? 'stacked' : 'track';
			stateRef.current = { viewH, mode: nextMode };
			setMode(nextMode);
			node.style.setProperty('--hz-view', `${viewH}px`);
			node.style.setProperty('--hz-w', `${viewW}px`);
			// 이 페이지 맨 위가 뷰 맨 위보다 얼마나 올라갔는지(px) → 패널 단위 진행도
			const scrolled = viewTop - node.getBoundingClientRect().top;
			const progress = Math.max(0, Math.min(count - 1, scrolled / Math.max(1, viewH)));
			node.style.setProperty('--hz-p', progress.toFixed(4));
			if (nextMode === 'track') {
				setCurrent(Math.round(progress));
				return;
			}
			// 쌓임 모드: 뷰 가운데 선을 지난 마지막 패널
			let index = 0;
			for (const panel of node.querySelectorAll<HTMLElement>('[data-panel]'))
				if (panel.getBoundingClientRect().top - viewTop <= viewH * 0.5) index = Number(panel.dataset.panel);
			setCurrent(index);
		});
	}, [root, count]);

	/** 단추·키: 트랙 모드는 그만큼 scrollTop을 옮기고, 쌓임 모드는 그 패널로 scrollIntoView */
	const go = useCallback(
		(index: number) => {
			const node = root.current;
			const target = Math.max(0, Math.min(count - 1, index));
			if (!node) return;
			const panel = node.querySelector<HTMLElement>(`[data-panel="${target}"]`);
			const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
			if (stateRef.current.mode === 'stacked') {
				panel?.scrollIntoView({ behavior, block: 'start' });
				return;
			}
			const scroller = node.closest<HTMLElement>('.safari-page') ?? node.parentElement;
			if (!scroller) return;
			const base = node.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
			scroller.scrollTo({ top: base + target * stateRef.current.viewH, behavior });
		},
		[root, count]
	);

	const onKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === 'ArrowRight') go(current + 1);
		else if (event.key === 'ArrowLeft') go(current - 1);
		else return;
		event.preventDefault();
	};

	return (
		<div ref={root} className="hz" data-mode={mode} style={cssVars({ n: count })} tabIndex={0} onKeyDown={onKeyDown}>
			<div className="hz-bar" aria-label="패널 이동">
				<button
					type="button"
					className="hz-nav"
					aria-label="이전"
					onClick={() => go(current - 1)}
					disabled={current === 0}
				>
					<i className="fa-solid fa-arrow-left" aria-hidden="true" />
				</button>
				<span className="hz-count" aria-live="polite">
					{pad(current + 1)} / {pad(count)}
				</span>
				<span className="hz-progress" aria-hidden="true">
					<span style={cssVars({ fill: `${((current + 1) / count) * 100}%` })} />
				</span>
				<button
					type="button"
					className="hz-nav"
					aria-label="다음"
					onClick={() => go(current + 1)}
					disabled={current === count - 1}
				>
					<i className="fa-solid fa-arrow-right" aria-hidden="true" />
				</button>
			</div>
			<div className="hz-view">
				<div className="hz-track">
					<Cover project={project} index={sections.cover} />
					{sections.facts !== null && <FactsPanel project={project} index={sections.facts} />}
					{project.highlights.length > 0 && (
						<Region label="주요 기능" className="hz-group">
							{project.highlights.map((point, i) => (
								<HighlightPanel
									key={point.title}
									point={point}
									index={sections.highlights[i]}
									order={i}
									total={project.highlights.length}
								/>
							))}
						</Region>
					)}
					{sections.build !== null && <BuildPanel points={project.build} index={sections.build} />}
					{sections.timeline !== null && project.timeline && (
						<TimelinePanel items={project.timeline} index={sections.timeline} />
					)}
					{sections.specs !== null && <SpecsPanel project={project} index={sections.specs} />}
					<EndPanel project={project} index={sections.end} />
				</div>
			</div>
		</div>
	);
};

export default HorizontalPage;
