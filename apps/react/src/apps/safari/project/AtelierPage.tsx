// 아틀리에(atelier) 모양: 에이전시 포트폴리오처럼 아이보리 바탕·먹색 글·강조색 하나(테라코타).
// 거대한 세리프와 아주 작은 대문자 라벨의 대비, 넉넉한 여백, 1px 선. 글은 줄 마스크로, 그림은 커튼처럼 느리게 드러난다
import React, { useEffect, useRef, useState } from 'react';
import type { Project, ProjectChapter, ProjectPoint } from '@/shared/profile';
import { cssVars } from '@/shared/lib/cssVars';
import { FactValue, Links, Region } from '@/apps/safari/project/parts';
import { prefersReducedMotion, useReveal } from '@/apps/safari/project/reveal';
import { onScrollFrame, viewOf } from '@/apps/safari/project/scroll';
import { Bars, Compare, FeatureMedia } from '@/apps/safari/project/CreativeParts';
import { ChapterFacts, Shots } from '@/apps/safari/project/CreativeChapters';
import { Architecture } from '@/apps/safari/project/CreativeArchitecture';
import { Demo } from '@/apps/safari/project/creative/Demo';
import { Themes } from '@/apps/safari/project/creative/Themes';
import '@/apps/safari/project/AtelierPage.css';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;
const pad = (n: number) => String(n + 1).padStart(2, '0');

/** 줄 하나: 아래에서 밀려 올라온다 (overflow hidden 마스크 안의 translateY 100% → 0). i는 줄 순서, 줄마다 60ms 늦게 */
const Line: React.FC<{ i?: number; as?: 'span' | 'div'; className?: string; children: React.ReactNode }> = ({
	i = 0,
	as: Tag = 'span',
	className = '',
	children,
}) => (
	<Tag className={`at-mask ${className}`} style={cssVars({ i })}>
		<Tag className="at-rise">{children}</Tag>
	</Tag>
);

/** 글 묶음: 안의 줄(Line)이 화면에 들어오면 차례로 올라온다 */
const Lines: React.FC<{ as?: 'div' | 'header'; className?: string; children: React.ReactNode }> = ({
	as: Tag = 'div',
	className = '',
	children,
}) => (
	<Tag className={className} data-reveal="lines">
		{children}
	</Tag>
);

/** 그림 한 장: 커튼처럼 아래에서 열리며(clip-path inset 100% → 0) 1.1 → 1로 가라앉는다 */
const Curtain: React.FC<{ src: string; alt: string; className?: string; caption?: React.ReactNode }> = ({
	src,
	alt,
	className = '',
	caption,
}) => (
	<figure className={`at-curtain ${className}`} data-reveal="curtain">
		{src.endsWith('.mp4') ? (
			<video src={src} muted loop playsInline autoPlay aria-label={alt} />
		) : (
			<img src={src} alt={alt} loading="lazy" />
		)}
		{caption && <figcaption>{caption}</figcaption>}
	</figure>
);

/** 항목에 붙는 화면: 만져 보는 데모, 실제 화면 여러 장, 영상·갈래·라이트다크·그림(FeatureMedia) 중 있는 것 */
const PointMedia: React.FC<{ point: ProjectPoint }> = ({ point }) => {
	if (point.demo)
		return (
			<div className="at-demo" data-demo={point.demo}>
				<Demo kind={point.demo} />
				{point.shots && <Shots shots={point.shots} />}
			</div>
		);
	if (point.shots)
		return (
			<div className="at-demo">
				<Shots shots={point.shots} />
			</div>
		);
	if (point.image && !point.imageDark && !point.video && !point.variants)
		return <Curtain src={point.image} alt={`${point.title} 화면`} />;
	const media = <FeatureMedia point={point} />;
	return media ? <div className="at-media">{media}</div> : null;
};

/** 대표 화면: 화면 폭 가득, 스크롤하면 글보다 느리게 따라온다 (패럴랙스). 움직임 줄이기면 고정 */
const HeroShot: React.FC<{ project: Project }> = ({ project }) => {
	const frame = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const node = frame.current;
		if (!node || prefersReducedMotion()) return;
		return onScrollFrame(node, (scroller) => {
			const view = viewOf(scroller);
			const box = node.getBoundingClientRect();
			// 틀의 가운데가 화면 가운데에서 얼마나 떨어졌는지의 18%만큼 그림을 반대로 밀어, 글보다 느리게 보이게
			const offset = (box.top + box.height / 2 - (view.top + view.height / 2)) * 0.18;
			node.style.setProperty('--shift', `${offset.toFixed(1)}px`);
		});
	}, []);
	if (!project.image) return null;
	return (
		<div ref={frame} className="at-hero-shot">
			<Curtain src={project.image} alt={`${project.name} 화면`} />
		</div>
	);
};

/**
 * 주요 기능: 왼쪽은 번호와 제목 목록(sticky, 지금 읽는 항목에 aria-current), 오른쪽은 글과 그림이 흐른다.
 * 스크롤 상자의 가운데 선을 지난 마지막 항목을 읽는 중으로 본다
 */
const Highlights: React.FC<{ points: ProjectPoint[] }> = ({ points }) => {
	const flow = useRef<HTMLOListElement>(null);
	const [current, setCurrent] = useState(0);
	useEffect(() => {
		const list = flow.current;
		if (!list) return;
		return onScrollFrame(list, (scroller) => {
			const view = viewOf(scroller);
			const mid = view.top + view.height * 0.5;
			const items = Array.from(list.children) as HTMLElement[];
			let index = 0;
			items.forEach((item, i) => {
				if (item.getBoundingClientRect().top <= mid) index = i;
			});
			// 끝까지 내려와 목록 아래가 화면 안이면 마지막 항목
			const bottom = list.getBoundingClientRect().bottom;
			if (bottom <= view.top + view.height) index = items.length - 1;
			setCurrent(index);
		});
	}, [points.length]);

	const jump = (i: number) =>
		flow.current?.children[i]?.scrollIntoView({
			behavior: prefersReducedMotion() ? 'auto' : 'smooth',
			block: 'start',
		});

	return (
		<div className="at-hl">
			<ol className="at-hl-index" aria-label="주요 기능 목록">
				{points.map((point, i) => (
					<li key={point.title} aria-current={i === current ? 'true' : undefined}>
						<button type="button" onClick={() => jump(i)}>
							<span className="at-num">{pad(i)}</span>
							<span className="at-hl-title">{point.title}</span>
						</button>
					</li>
				))}
			</ol>
			<ol ref={flow} className="at-hl-flow">
				{points.map((point, i) => (
					<li key={point.title} id={`at-hl-${i}`}>
						<Lines as="header">
							<Line className="at-label">
								{pad(i)} — {point.title}
							</Line>
							<h3>
								<Line i={1}>{point.title}</Line>
							</h3>
							<p className="at-body">
								<Line i={2}>{point.body}</Line>
							</p>
							{point.detail && (
								<p className="at-detail">
									<Line i={3}>{point.detail}</Line>
								</p>
							)}
						</Lines>
						<PointMedia point={point} />
					</li>
				))}
			</ol>
		</div>
	);
};

/** 장 하나: '01 — 제목' 큰 머리, 숫자, 항목이 세로 리듬으로, 끝에 그림·비교 막대·테마 */
const Chapter: React.FC<{ chapter: ProjectChapter; index: number }> = ({ chapter, index }) => (
	<Region label={chapter.title} className="at-chapter">
		<Lines as="header" className="at-chapter-head">
			<Line className="at-label">Chapter {pad(index)}</Line>
			<h2>
				<Line i={1}>
					<span className="at-chapter-num">{pad(index)}</span> — {chapter.title}
				</Line>
			</h2>
			{chapter.lead && (
				<p className="at-lead">
					<Line i={2}>{chapter.lead}</Line>
				</p>
			)}
		</Lines>
		{chapter.facts && chapter.facts.length > 0 && <ChapterFacts facts={chapter.facts} look={chapter.look} />}
		{chapter.look === 'architecture' && <Architecture />}
		<ol className="at-points">
			{chapter.points.map((point, i) => (
				<li key={point.title}>
					<Lines className="at-point-text">
						<Line className="at-num">{pad(i)}</Line>
						<h3>
							<Line i={1}>{point.title}</Line>
						</h3>
						<p className="at-body">
							<Line i={2}>{point.body}</Line>
						</p>
						{point.detail && (
							<p className="at-detail">
								<Line i={3}>{point.detail}</Line>
							</p>
						)}
					</Lines>
					<PointMedia point={point} />
				</li>
			))}
		</ol>
		{chapter.compare && <Bars rows={chapter.compare} />}
		{chapter.palette && <Themes palette={chapter.palette} />}
		{chapter.image &&
			(chapter.image.dark ? (
				<div className="at-media">
					<Compare light={chapter.image.src} dark={chapter.image.dark} alt={chapter.image.alt} />
				</div>
			) : (
				<Curtain src={chapter.image.src} alt={chapter.image.alt} caption={chapter.image.alt} />
			))}
	</Region>
);

/** 화면 모음: 큰 그림이 하나씩, 가로 스크롤 스냅. 단추로도 넘긴다 (움직임 줄이기에서도 닿을 수 있게) */
const Gallery: React.FC<{ shots: NonNullable<Project['gallery']> }> = ({ shots }) => {
	const track = useRef<HTMLUListElement>(null);
	const [at, setAt] = useState(0);
	const go = (i: number) => {
		const next = Math.max(0, Math.min(shots.length - 1, i));
		setAt(next);
		track.current?.children[next]?.scrollIntoView({
			behavior: prefersReducedMotion() ? 'auto' : 'smooth',
			inline: 'start',
			block: 'nearest',
		});
	};
	return (
		<div className="at-gallery">
			<ul ref={track}>
				{shots.map((shot, i) => (
					<li key={shot.src}>
						<Curtain
							src={shot.src}
							alt={shot.caption}
							caption={
								<>
									<span className="at-num">{pad(i)}</span> {shot.caption}
								</>
							}
						/>
					</li>
				))}
			</ul>
			<div className="at-gallery-nav">
				<span className="at-label">
					{pad(at)} / {pad(shots.length - 1)}
				</span>
				<button type="button" aria-label="이전 화면" onClick={() => go(at - 1)} disabled={at === 0}>
					←
				</button>
				<button type="button" aria-label="다음 화면" onClick={() => go(at + 1)} disabled={at === shots.length - 1}>
					→
				</button>
			</div>
		</div>
	);
};

/**
 * 아틀리에: 작은 라벨 → 로고(또는 거대한 세리프 이름) → 이탤릭 tagline → 화면 폭 가득한 대표 화면(패럴랙스) → 얇은 세리프 숫자 한 줄 →
 * 주요 기능(왼쪽 sticky 목차 / 오른쪽 흐르는 글) → 장들 → 화면 모음(가로 스냅) → 만든 방식·쓰는 법(괘선) → 진행 과정(세로 선) →
 * 기술 사양·맡은 일(괘선 표) → 큰 GitHub 링크. 없는 묶음은 통째로 빠진다
 */
const AtelierPage: React.FC<{ project: Project }> = ({ project }) => {
	const root = useReveal<HTMLDivElement>();
	const meta = [project.context, project.period].filter(Boolean).join(' · ');
	const repo = project.url.replace(/^https?:\/\//, '');

	return (
		<div ref={root} className="at">
			<header className="at-hero">
				<Lines className="at-hero-text">
					{meta && <Line className="at-label">{meta}</Line>}
					{project.logo ? (
						<Line i={1} as="div" className="at-logo">
							<img src={project.logo} alt={project.name} />
						</Line>
					) : (
						<p className="at-name">
							<Line i={1}>{project.name}</Line>
						</p>
					)}
					<h1 className="at-tagline">
						<Line i={2}>{project.tagline || project.name}</Line>
					</h1>
					{project.description && (
						<p className="at-desc">
							<Line i={3}>{project.description}</Line>
						</p>
					)}
					<Line i={4} as="div" className="at-hero-links">
						<Links project={project} className="at-links" />
					</Line>
				</Lines>
				<HeroShot project={project} />
			</header>

			{project.facts.length > 0 && (
				<ul className="at-facts" aria-label="한눈에" data-reveal="lines">
					{project.facts.map((fact, i) => (
						<li key={fact.label}>
							<Line i={i} className="at-fact-value">
								<FactValue text={fact.value} />
							</Line>
							<Line i={i + 1} className="at-label">
								{fact.label}
							</Line>
						</li>
					))}
				</ul>
			)}

			{project.highlights.length > 0 && (
				<Region label="주요 기능" className="at-section">
					<Lines as="header" className="at-section-head">
						<Line className="at-label">Selected work</Line>
						<h2>
							<Line i={1}>주요 기능</Line>
						</h2>
					</Lines>
					<Highlights points={project.highlights} />
				</Region>
			)}

			{project.chapters?.map((chapter, i) => (
				<Chapter key={chapter.title} chapter={chapter} index={i} />
			))}

			{project.gallery && project.gallery.length > 0 && (
				<Region label="화면 모음" className="at-section at-wide">
					<Lines as="header" className="at-section-head">
						<Line className="at-label">Gallery</Line>
						<h2>
							<Line i={1}>화면 모음</Line>
						</h2>
					</Lines>
					<Gallery shots={project.gallery} />
				</Region>
			)}

			{project.build.length > 0 && (
				<Region label="만든 방식" className="at-section">
					<Lines as="header" className="at-section-head">
						<Line className="at-label">Process</Line>
						<h2>
							<Line i={1}>만든 방식</Line>
						</h2>
					</Lines>
					<ol className="at-rules">
						{project.build.map((point, i) => (
							<li key={point.title} data-reveal="lines">
								<Line className="at-num">{pad(i)}</Line>
								<h3>
									<Line i={1}>{point.title}</Line>
								</h3>
								<p className="at-body">
									<Line i={2}>{point.body}</Line>
								</p>
							</li>
						))}
					</ol>
				</Region>
			)}

			{project.usage && project.usage.length > 0 && (
				<Region label="쓰는 법" className="at-section">
					<Lines as="header" className="at-section-head">
						<Line className="at-label">How to use</Line>
						<h2>
							<Line i={1}>쓰는 법</Line>
						</h2>
					</Lines>
					<ol className="at-rules">
						{project.usage.map((point, i) => (
							<li key={point.title} data-reveal="lines">
								<Line className="at-num">{pad(i)}</Line>
								<h3>
									<Line i={1}>{point.title}</Line>
								</h3>
								<p className="at-body">
									<Line i={2}>{point.body}</Line>
								</p>
							</li>
						))}
					</ol>
				</Region>
			)}

			{project.timeline && project.timeline.length > 0 && (
				<Region label="진행 과정" className="at-section">
					<Lines as="header" className="at-section-head">
						<Line className="at-label">Timeline</Line>
						<h2>
							<Line i={1}>진행 과정</Line>
						</h2>
					</Lines>
					<ol className="at-timeline">
						{project.timeline.map((entry, i) => (
							<li key={`${entry.date}-${entry.label}`} data-reveal="lines" style={cssVars({ i })}>
								<time>
									<Line>{entry.date}</Line>
								</time>
								<span>
									<Line i={1}>{entry.label}</Line>
								</span>
							</li>
						))}
					</ol>
				</Region>
			)}

			{(project.specs.length > 0 || project.contributions.length > 0) && (
				<div className="at-section at-tables">
					{project.specs.length > 0 && (
						<Region label="기술 사양" className="at-table">
							<Lines as="header" className="at-section-head">
								<Line className="at-label">Specifications</Line>
								<h2>
									<Line i={1}>기술 사양</Line>
								</h2>
							</Lines>
							<dl data-reveal="lines">
								{project.specs.map((spec, i) => (
									<div key={spec.label}>
										<dt>
											<Line i={i}>{spec.label}</Line>
										</dt>
										<dd>
											<Line i={i}>{spec.value}</Line>
										</dd>
									</div>
								))}
							</dl>
						</Region>
					)}
					{project.contributions.length > 0 && (
						<Region label="맡은 일" className="at-table">
							<Lines as="header" className="at-section-head">
								<Line className="at-label">{project.role ? 'Role' : 'Contributions'}</Line>
								<h2>
									<Line i={1}>맡은 일</Line>
								</h2>
								{project.role && (
									<p className="at-lead">
										<Line i={2}>{project.role}</Line>
									</p>
								)}
							</Lines>
							<ul data-reveal="lines">
								{project.contributions.map((item, i) => (
									<li key={item}>
										<Line i={i} className="at-num">
											{pad(i)}
										</Line>
										<Line i={i}>{item}</Line>
									</li>
								))}
							</ul>
						</Region>
					)}
				</div>
			)}

			<footer className="at-foot">
				<Lines>
					<Line className="at-label">Next</Line>
					<a className="at-next" href={project.url} {...external}>
						<Line i={1}>
							저장소 보기 <span aria-hidden="true">→</span>
						</Line>
					</a>
					<Line i={2} className="at-foot-repo">
						{repo}
					</Line>
				</Lines>
			</footer>
		</div>
	);
};

export default AtelierPage;
