// 가로 모양: 세로 스크롤이 가로로 늘어선 패널들을 밀어 간다. Linear·Vercel 같은 어두운 제품 투어:
// 패널마다 빛이 번지는 바탕 위에 큰 제목과 제품 화면(기기 틀)이 놓이고, 글은 배경보다 느리게 따라온다
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Project, ProjectPoint } from '@/shared/profile';
import { Links, Region } from '@/apps/safari/project/parts';
import { prefersReducedMotion, useReveal } from '@/apps/safari/project/reveal';
import { onScrollFrame, viewOf } from '@/apps/safari/project/scroll';
import {
	CtaBand,
	DeviceFrame,
	GlowBackdrop,
	LogoStrip,
	MockScreen,
	SectionHeader,
	StatBand,
	iconOf,
	pickMockKind,
	useLandingAccent,
} from '@/apps/safari/project/landing';
import { cssVars } from '@/shared/lib/cssVars';
import '@/apps/safari/project/HorizontalPage.css';

/** 이보다 좁으면 가로 트랙을 풀고 세로로 쌓는다 */
const NARROW = 700;
/** 패널 바탕 두 가지가 번갈아 돈다 (CSS의 data-tone 0·1) */
const TONES = 2;

const pad = (n: number) => String(n).padStart(2, '0');

/** 칸 n개를 max열 이하 격자에 남는 칸 없이: 열 수와 마지막 칸이 차지할 열 수 */
function fitGrid(n: number, max: number): { cols: number; last: number } {
	const cols = n <= max ? Math.max(1, n) : n % max === 0 ? max : n % 3 === 0 && max >= 3 ? 3 : max;
	const rest = n % cols;
	return { cols, last: rest === 0 ? 1 : cols - rest + 1 };
}

/** '2024.07.01'처럼 해가 붙은 날짜는 해를 작게 위로 떼어 낸다 (좁은 칸에서 거대한 날짜가 넘치지 않게) */
const DateMark: React.FC<{ date: string }> = ({ date }) => {
	const match = /^(\d{4})[.\-/](.+)$/.exec(date);
	if (!match) return <time>{date}</time>;
	return (
		<time>
			<small>{match[1]}</small>
			{match[2]}
		</time>
	);
};

const pointImage = (point: ProjectPoint) =>
	point.video ?? point.image ?? point.shots?.[0]?.src ?? point.scrollFrames?.[0];

/** 패널 하나: 번호(i)에 따라 바탕이 번갈고, 글(.hz-text)은 트랙보다 느리게 움직인다 */
const Panel: React.FC<{
	index: number;
	label?: string;
	className?: string;
	dark?: boolean;
	children: React.ReactNode;
}> = ({ index, label, className = '', dark, children }) => (
	<section
		className={`hz-panel ${className}`}
		data-tone={index % TONES}
		data-panel={index}
		data-lk-tone={dark ? 'dark' : undefined}
		aria-label={label}
		style={cssVars({ i: index })}
	>
		{children}
	</section>
);

/** 표지(히어로): 왼쪽에 제품 이름·큰 한 줄·링크, 오른쪽에 화면 밖으로 걸친 브라우저 창. 아래에 기술 띠 */
const Cover: React.FC<{ project: Project; index: number }> = ({ project, index }) => {
	const ref = useRef<HTMLDivElement>(null);
	const tech =
		project.language && !project.stack.includes(project.language)
			? [project.language, ...project.stack]
			: project.stack;
	const tilt = (event: React.MouseEvent) => {
		const node = ref.current;
		if (!node || prefersReducedMotion()) return;
		const box = node.getBoundingClientRect();
		node.style.setProperty('--hz-mx', String((event.clientX - box.left) / box.width - 0.5));
		node.style.setProperty('--hz-my', String((event.clientY - box.top) / box.height - 0.5));
	};
	const meta = [project.context, project.contributions.length ? '' : project.role, project.period].filter(Boolean);
	return (
		<Panel index={index} className="hz-cover" label="표지" dark>
			<GlowBackdrop tone="dark" pattern="grid" focus="side" />
			<div ref={ref} className="hz-cover-inner" onMouseMove={tilt}>
				<div className="hz-text">
					{meta.length > 0 && (
						<p className="hz-badge">
							<span className="hz-badge-dot" aria-hidden="true" />
							{meta.join(' · ')}
						</p>
					)}
					<h1 className="hz-name">
						{project.icon && <img src={project.icon} alt="" />}
						{project.name}
					</h1>
					<p className="hz-tagline">{project.tagline}</p>
					{project.description && <p className="hz-lead">{project.description}</p>}
					<Links project={project} className="sp-links hz-links" />
					<p className="hz-hint" aria-hidden="true">
						아래로 스크롤하면 옆으로 넘어갑니다 <span>→</span>
					</p>
				</div>
				<div className="hz-cover-visual">
					<DeviceFrame
						kind="browser"
						url={project.demo ?? project.url}
						src={project.image}
						alt={project.image ? `${project.name} 화면` : undefined}
						glow
					>
						<MockScreen project={project} kind={pickMockKind(project)} tone="dark" decorative />
					</DeviceFrame>
				</div>
			</div>
			{tech.length > 0 && <LogoStrip items={tech} caption="만든 기술" className="hz-logos" />}
		</Panel>
	);
};

/** 숫자 패널: 큰 숫자 띠 하나 */
const FactsPanel: React.FC<{ project: Project; index: number }> = ({ project, index }) => (
	<Panel index={index} className="hz-facts" label="한눈에 보는 숫자">
		<div className="hz-text">
			<SectionHeader eyebrow="한눈에 보는 숫자" title="숫자로 본 결과" lead={project.context} />
			<StatBand facts={project.facts} label="숫자" className="hz-stats" />
		</div>
	</Panel>
);

/** 주요 기능 하나에 패널 하나: 글과 제품 화면이 좌우로 번갈아 선다. 그림이 없으면 그 기능을 고른 가짜 화면 */
const HighlightPanel: React.FC<{
	project: Project;
	point: ProjectPoint;
	index: number;
	order: number;
	total: number;
}> = ({ project, point, index, order, total }) => {
	const image = pointImage(point);
	return (
		<Panel index={index} className={`hz-feature ${order % 2 ? 'flip' : ''}`}>
			<div className="hz-text">
				<p className="hz-eyebrow">
					<span className="hz-eyebrow-icon" aria-hidden="true">
						<i className={`fa-solid ${iconOf(point, order)}`} />
					</span>
					주요 기능 <strong>{pad(order + 1)}</strong>
					<span className="hz-eyebrow-total"> / {pad(total)}</span>
				</p>
				<h2>{point.title}</h2>
				<p className="hz-body">{point.body}</p>
				{point.detail && (
					<p className="hz-detail">
						<i className="fa-solid fa-circle-check" aria-hidden="true" />
						<span>{point.detail}</span>
					</p>
				)}
			</div>
			<div className="hz-feature-visual" data-reveal="zoom">
				<DeviceFrame
					kind="browser"
					url={project.demo ?? project.url}
					src={image}
					alt={image ? (point.shots?.[0]?.alt ?? `${point.title} 화면`) : undefined}
					tilt={order % 2 ? 'left' : 'right'}
					glow
				>
					<MockScreen project={project} kind={pickMockKind(project)} focus={order} decorative />
				</DeviceFrame>
			</div>
		</Panel>
	);
};

/** 단계·카드 하나 (쓰는 법·만든 방식이 함께 쓴다) */
const Card: React.FC<{ point: ProjectPoint; index: number; step?: boolean }> = ({ point, index, step }) => (
	<li data-reveal="" style={cssVars({ d: index })}>
		<span className="hz-card-mark" aria-hidden="true">
			{step ? index + 1 : <i className={`fa-solid ${iconOf(point, index)}`} />}
		</span>
		<h3>{point.title}</h3>
		<p>{point.body}</p>
		{point.detail && <p className="hz-card-detail">{point.detail}</p>}
	</li>
);

/** 만든 방식: 아이콘 타일이 달린 유리 카드 격자 */
const BuildPanel: React.FC<{ points: ProjectPoint[]; index: number }> = ({ points, index }) => (
	<Panel index={index} className="hz-build" label="만든 방식">
		<div className="hz-text">
			<SectionHeader eyebrow="만든 방식" title="속을 이렇게 짰습니다." align="start" />
			<ul className="hz-cards" style={cssVars(fitGrid(points.length, 3))}>
				{points.map((point, i) => (
					<Card key={point.title} point={point} index={i} />
				))}
			</ul>
		</div>
	</Panel>
);

/** 쓰는 법: 빛나는 선으로 이어진 단계 카드 */
const UsagePanel: React.FC<{ points: ProjectPoint[]; index: number }> = ({ points, index }) => (
	<Panel index={index} className="hz-usage" label="쓰는 법">
		<div className="hz-text">
			<SectionHeader eyebrow="쓰는 법" title={`${points.length}단계면 시작할 수 있습니다.`} align="start" />
			<ol className="hz-cards hz-steps" style={cssVars(fitGrid(points.length, 4))}>
				{points.map((point, i) => (
					<Card key={point.title} point={point} index={i} step />
				))}
			</ol>
		</div>
	</Panel>
);

/** 진행 과정: 가로 선 위에 빛나는 점과 날짜 */
const TimelinePanel: React.FC<{ project: Project; items: { date: string; label: string }[]; index: number }> = ({
	project,
	items,
	index,
}) => (
	<Panel index={index} className="hz-timeline" label="진행 과정">
		<div className="hz-text">
			<SectionHeader eyebrow="진행 과정" title={project.period || '걸어온 길'} align="start" />
			<ol className="hz-rail">
				{items.map((item, i) => (
					<li key={`${item.date}-${item.label}`} data-reveal="" style={cssVars({ d: i })}>
						<DateMark date={item.date} />
						<span>{item.label}</span>
					</li>
				))}
			</ol>
		</div>
	</Panel>
);

/** 기술 사양(표 카드)과 맡은 일(체크 카드)을 나란히 */
const SpecsPanel: React.FC<{ project: Project; index: number }> = ({ project, index }) => (
	<Panel index={index} className="hz-specs">
		<div className="hz-text">
			{project.specs.length > 0 && (
				<Region label="기술 사양" className="hz-col">
					<p className="hz-col-eyebrow">기술 사양</p>
					<h2 className="hz-col-title">무엇으로 만들었나</h2>
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
					<p className="hz-col-eyebrow">맡은 일</p>
					<h2 className="hz-col-title">{project.role || '직접 한 일'}</h2>
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

/** 끝: 빛나는 행동 유도 띠 */
const EndPanel: React.FC<{ project: Project; index: number }> = ({ project, index }) => (
	<Panel index={index} className="hz-end" label="마무리" dark>
		<CtaBand project={project} title={project.tagline || project.name} className="hz-cta" />
	</Panel>
);

/**
 * 짜임: 바깥(.hz) 높이 = 패널 수 × 뷰 높이. 안쪽(.hz-view)은 sticky로 붙어 있고 그 안의 트랙(.hz-track)이 스크롤 진행도만큼
 * translateX로 밀린다. 패널 폭은 모두 뷰 폭이라 세로로 뷰 높이만큼 내리면 패널 하나가 넘어간다.
 * 좁은 창이거나 움직임 줄이기면 트랙을 풀고 패널을 세로로 쌓는다(stacked). 그때 단추는 scrollIntoView
 */
const HorizontalPage: React.FC<{ project: Project }> = ({ project }) => {
	const root = useReveal<HTMLDivElement>();
	const accent = useLandingAccent(project.icon);
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
		const usage = project.usage?.length ? next() : null;
		const build = project.build.length ? next() : null;
		const timeline = project.timeline?.length ? next() : null;
		const specs = project.specs.length || project.contributions.length ? next() : null;
		const end = next();
		return { cover, facts, highlights, usage, build, timeline, specs, end, count: n };
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
		<div
			ref={root}
			className="hz"
			data-mode={mode}
			style={{ ...accent, ...cssVars({ n: count }) }}
			tabIndex={0}
			onKeyDown={onKeyDown}
		>
			<div className="hz-bar" aria-label="패널 이동">
				<div className="hz-bar-pill">
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
			</div>
			<div className="hz-view">
				<div className="hz-track">
					<Cover project={project} index={sections.cover} />
					{sections.facts !== null && <FactsPanel project={project} index={sections.facts} />}
					{project.highlights.length > 0 && (
						<Region label="주요 기능" className="hz-group">
							{project.highlights.map((point, i) => (
								<HighlightPanel
									project={project}
									key={point.title}
									point={point}
									index={sections.highlights[i]}
									order={i}
									total={project.highlights.length}
								/>
							))}
						</Region>
					)}
					{sections.usage !== null && project.usage && <UsagePanel points={project.usage} index={sections.usage} />}
					{sections.build !== null && <BuildPanel points={project.build} index={sections.build} />}
					{sections.timeline !== null && project.timeline && (
						<TimelinePanel project={project} items={project.timeline} index={sections.timeline} />
					)}
					{sections.specs !== null && <SpecsPanel project={project} index={sections.specs} />}
					<EndPanel project={project} index={sections.end} />
				</div>
			</div>
		</div>
	);
};

export default HorizontalPage;
