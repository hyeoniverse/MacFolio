// 브루탈리즘 모양(brutal): 흰·검·형광 세 색, 4px 선, 그림자 없는 블록을 12열 격자에 크기가 다르게 깐다.
// 맨 위는 화면을 넘치는 이름 두 줄과 반대로 흐르는 띠 둘, 마우스를 따라오는 반전 원 커서
import React, { useEffect, useRef, useState } from 'react';
import type { Project, ProjectPoint } from '@/shared/profile';
import { FactValue, Links, Region } from '@/apps/safari/project/parts';
import { prefersReducedMotion, useReveal } from '@/apps/safari/project/reveal';
import { onScrollFrame } from '@/apps/safari/project/scroll';
import { FeatureMedia } from '@/apps/safari/project/CreativeParts';
import { cssVars } from '@/shared/lib/cssVars';
import '@/apps/safari/project/BrutalPage.css';

const pad = (n: number) => String(n).padStart(2, '0');

/** 블록 하나: 왼쪽 위에 `[번호] 라벨`, 격자에서 span 칸을 차지한다 */
const Block: React.FC<
	{ n: number; tag: string; span: number; tone?: 'neon' | 'ink' } & React.HTMLAttributes<HTMLDivElement>
> = ({ n, tag, span, tone, className = '', children, ...rest }) => (
	<div
		className={`br-block ${tone ? `br-${tone}` : ''} ${className}`}
		style={cssVars({ span })}
		data-reveal=""
		{...rest}
	>
		<span className="br-tag" aria-hidden="true">
			[{pad(n)}] {tag}
		</span>
		{children}
	</div>
);

/** 빈 칸: 빗금 무늬로 채운다 */
const Hatch: React.FC<{ span: number }> = ({ span }) =>
	span > 0 ? <div className="br-hatch" style={cssVars({ span })} aria-hidden="true" /> : null;

/** 글 블록 묶음(기능, 만든 방식, 쓰는 법): 블록 크기가 번갈아 달라지고, 줄의 남는 칸은 빗금 */
const Points: React.FC<{ points: ProjectPoint[]; tag: string; from: number; spans: number[] }> = ({
	points,
	tag,
	from,
	spans,
}) => {
	let used = 0;
	const cells: React.ReactNode[] = [];
	points.forEach((point, index) => {
		let span = spans[index % spans.length];
		// 줄을 넘치면 남는 칸만큼 빗금을 먹이고 다음 줄에서 시작
		if (used + span > 12) {
			cells.push(<Hatch key={`h${index}`} span={12 - used} />);
			used = 0;
		}
		// 마지막 블록은 줄 끝까지
		if (index === points.length - 1) span = 12 - used;
		used = (used + span) % 12;
		cells.push(
			<Block key={point.title} n={from + index} tag={tag} span={span}>
				{point.icon && <i className={`fa-solid ${point.icon} br-icon`} aria-hidden="true" />}
				<h3>{point.title}</h3>
				<p>{point.body}</p>
				{point.detail && <p className="br-detail">{point.detail}</p>}
				<div className="br-media">
					<FeatureMedia point={point} />
				</div>
			</Block>
		);
	});
	return <>{cells}</>;
};

/** 흐르는 띠: 같은 글을 두 번 이어 끝없이 보이게. 움직임 줄이기에서는 멈춘 띠 */
const Marquee: React.FC<{ items: string[]; reverse?: boolean }> = ({ items, reverse }) => {
	const row = items.map((item, i) => (
		<span key={i}>
			{item}
			<b aria-hidden="true">■</b>
		</span>
	));
	return (
		<div className={`br-marquee ${reverse ? 'reverse' : ''}`} aria-hidden="true">
			<div className="br-marquee-track">
				<div>{row}</div>
				<div>{row}</div>
			</div>
		</div>
	);
};

/** 마우스를 따라오는 큰 원 (blend-mode: difference로 밑을 반전). 터치·움직임 줄이기에서는 없다 */
const Cursor: React.FC<{ root: React.RefObject<HTMLDivElement | null> }> = ({ root }) => {
	const dot = useRef<HTMLDivElement>(null);
	const [on, setOn] = useState(false);
	useEffect(() => {
		const el = root.current;
		if (!el || prefersReducedMotion() || !window.matchMedia?.('(pointer: fine)').matches) return;
		const move = (e: PointerEvent) => {
			const box = el.getBoundingClientRect();
			dot.current?.style.setProperty('transform', `translate(${e.clientX - box.left}px, ${e.clientY - box.top}px)`);
			setOn(true);
		};
		const leave = () => setOn(false);
		el.addEventListener('pointermove', move);
		el.addEventListener('pointerleave', leave);
		return () => {
			el.removeEventListener('pointermove', move);
			el.removeEventListener('pointerleave', leave);
		};
	}, [root]);
	return <div ref={dot} className={`br-cursor ${on ? 'on' : ''}`} aria-hidden="true" />;
};

/** 맨 위: 이름(화면을 넘치는 크기)과 큰 제목이 스크롤에 따라 서로 반대로 밀린다 */
const Hero: React.FC<{ project: Project }> = ({ project }) => {
	const head = useRef<HTMLElement>(null);
	useEffect(() => {
		const el = head.current;
		if (!el || prefersReducedMotion()) return;
		return onScrollFrame(el, (scroller) => {
			const y = scroller ? scroller.scrollTop : window.scrollY;
			el.style.setProperty('--br-shift', `${Math.min(y, 600) * 0.35}px`);
		});
	}, []);
	return (
		<header ref={head} className="br-hero">
			<p className="br-tag br-tag-top">
				[00] PROJECT <span>/ {project.context}</span>
				{project.period && <span>/ {project.period}</span>}
			</p>
			<h1 className="br-name">{project.name}</h1>
			<p className="br-tagline">{project.tagline}</p>
		</header>
	);
};

/**
 * brutal: 이름 두 줄 → 반대로 흐르는 띠 둘 → 12열 격자. 격자에는 소개, 숫자, 큰 그림, 주요 기능(크기 다른 블록),
 * 만든 방식, 쓰는 법, 더 들려줄 이야기, 화면 모음, 진행 과정(표), 폴더 구조(pre), 기술 사양(큰 두 열 표), 맡은 일(□■), 마무리.
 * 없는 자료는 그 블록이 통째로 빠지고, 줄의 남는 칸은 빗금이다
 */
const BrutalPage: React.FC<{ project: Project }> = ({ project }) => {
	const root = useReveal<HTMLDivElement>();
	// 화면 모음은 6·3·3 칸씩 한 줄. 영상은 뺀다
	const gallery = (project.gallery ?? []).filter((shot) => !shot.src.endsWith('.mp4'));
	const image = project.image || gallery[0]?.src;
	const facts = project.facts;
	// 블록 번호는 격자 순서대로 이어진다
	let n = 0;
	const next = () => ++n;
	// 블록 여럿을 한 번에 번호 매길 때: 첫 번호를 돌려주고 그만큼 건너뛴다
	const take = (count: number) => {
		const start = n + 1;
		n += count;
		return start;
	};

	const topRow = [...project.stack, project.language, 'OPEN SOURCE'].filter(Boolean);
	const bottomRow = [
		...facts.map((fact) => `${fact.value} ${fact.label}`),
		project.context,
		project.role ?? '',
		'OPEN SOURCE',
	].filter(Boolean);

	return (
		<div ref={root} className="br">
			<Cursor root={root} />
			<Hero project={project} />
			<Marquee items={topRow} />
			<Marquee items={bottomRow} reverse />

			<div className="br-grid">
				{/* 소개 */}
				<Block n={next()} tag="INTRO" span={facts.length ? 7 : 12} className="br-intro">
					<p className="br-lead">{project.description}</p>
					<dl className="br-meta">
						<div>
							<dt>CONTEXT</dt>
							<dd>{project.context}</dd>
						</div>
						{project.role && (
							<div>
								<dt>ROLE</dt>
								<dd>{project.role}</dd>
							</div>
						)}
						{project.period && (
							<div>
								<dt>PERIOD</dt>
								<dd>{project.period}</dd>
							</div>
						)}
					</dl>
					<Links project={project} className="br-links" />
				</Block>

				{/* 숫자 */}
				{facts.length > 0 && (
					<Region label="한눈에 보기" className="br-sub br-facts" style={cssVars({ span: 5 })}>
						{facts.map((fact, index) => (
							<Block key={fact.label} n={next()} tag="FACT" span={12} tone={index === 0 ? 'neon' : undefined}>
								<FactValue text={fact.value} />
								<span className="br-fact-label">{fact.label}</span>
							</Block>
						))}
					</Region>
				)}

				{/* 큰 그림 */}
				{image && (
					<Block n={next()} tag="SCREEN" span={8} className="br-shot">
						<img src={image} alt={`${project.name} 화면`} loading="lazy" />
					</Block>
				)}
				{image && (
					<Block n={next()} tag="STACK" span={4} tone="ink" className="br-stack">
						<ul aria-label="기술">
							{project.stack.map((item) => (
								<li key={item}>{item}</li>
							))}
						</ul>
					</Block>
				)}

				{/* 주요 기능: 7·5·5·7 … 크기가 다른 블록 */}
				{project.highlights.length > 0 && (
					<Region label="주요 기능" className="br-sub">
						<h2 className="br-h2" style={cssVars({ span: 12 })}>
							주요 기능 <span>/ FEATURES</span>
						</h2>
						<Points
							points={project.highlights}
							tag="FEATURE"
							from={take(project.highlights.length)}
							spans={[7, 5, 5, 7, 4, 8]}
						/>
					</Region>
				)}

				{/* 만든 방식: 세 칸씩 */}
				{project.build.length > 0 && (
					<Region label="만든 방식" className="br-sub">
						<h2 className="br-h2" style={cssVars({ span: 12 })}>
							만든 방식 <span>/ BUILD</span>
						</h2>
						<Points points={project.build} tag="BUILD" from={take(project.build.length)} spans={[4, 4, 4]} />
					</Region>
				)}

				{/* 쓰는 법: 두 칸씩 */}
				{project.usage && project.usage.length > 0 && (
					<Region label="쓰는 법" className="br-sub">
						<h2 className="br-h2" style={cssVars({ span: 12 })}>
							쓰는 법 <span>/ USAGE</span>
						</h2>
						<Points points={project.usage} tag="USAGE" from={take(project.usage.length)} spans={[6, 6]} />
					</Region>
				)}

				{/* 더 들려줄 이야기: 장마다 제목 블록(형광) 하나와 글 블록들 */}
				{project.chapters?.map((chapter) => (
					<Region key={chapter.title} label={chapter.title} className="br-sub">
						<Block n={next()} tag="CHAPTER" span={4} tone="neon" className="br-chapter">
							<h2>{chapter.title}</h2>
							{chapter.lead && <p>{chapter.lead}</p>}
						</Block>
						<Points points={chapter.points} tag="NOTE" from={take(chapter.points.length)} spans={[4, 4, 4, 4]} />
					</Region>
				))}

				{/* 화면 모음 */}
				{gallery.length > 1 && (
					<Region label="화면 모음" className="br-sub">
						<h2 className="br-h2" style={cssVars({ span: 12 })}>
							화면 모음 <span>/ SCREENS</span>
						</h2>
						{gallery.map((shot, index) => (
							<Block
								key={shot.src}
								n={next()}
								tag="SCREEN"
								span={index % 3 === 0 ? 6 : 3}
								className="br-shot br-gallery-shot"
							>
								<img src={shot.src} alt={shot.caption} loading="lazy" />
								<figcaption>{shot.caption}</figcaption>
							</Block>
						))}
						<Hatch span={[0, 6, 3][gallery.length % 3]} />
					</Region>
				)}

				{/* 진행 과정: 표 */}
				{project.timeline && project.timeline.length > 0 && (
					<Region label="진행 과정" className="br-sub">
						<Block n={next()} tag="TIMELINE" span={project.structure ? 5 : 12} className="br-table-block">
							<h2>진행 과정</h2>
							<table className="br-table">
								<thead>
									<tr>
										<th scope="col">#</th>
										<th scope="col">DATE</th>
										<th scope="col">WHAT</th>
									</tr>
								</thead>
								<tbody>
									{project.timeline.map((entry, index) => (
										<tr key={`${entry.date}-${entry.label}`}>
											<td>{pad(index + 1)}</td>
											<td>
												<time>{entry.date}</time>
											</td>
											<td>{entry.label}</td>
										</tr>
									))}
								</tbody>
							</table>
						</Block>
						{project.structure && (
							<Block n={next()} tag="TREE" span={7} tone="ink" className="br-tree">
								<h2>폴더 구조</h2>
								<pre>{project.structure}</pre>
							</Block>
						)}
					</Region>
				)}
				{!project.timeline?.length && project.structure && (
					<Block n={next()} tag="TREE" span={12} tone="ink" className="br-tree">
						<h2>폴더 구조</h2>
						<pre>{project.structure}</pre>
					</Block>
				)}

				{/* 기술 사양: 거대한 두 열 표 */}
				{project.specs.length > 0 && (
					<Region label="기술 사양" className="br-sub">
						<Block n={next()} tag="SPECS" span={12} className="br-specs">
							<h2>
								기술 사양 <span>/ SPECS</span>
							</h2>
							<table className="br-table br-table-big">
								<tbody>
									{project.specs.map((spec) => (
										<tr key={spec.label}>
											<th scope="row">{spec.label}</th>
											<td>{spec.value}</td>
										</tr>
									))}
								</tbody>
							</table>
						</Block>
					</Region>
				)}

				{/* 맡은 일: 체크박스 □ → 화면에 들어오면 ■ */}
				{project.contributions.length > 0 && (
					<Region label="맡은 일" className="br-sub">
						<Block n={next()} tag="ROLE" span={project.credits?.length ? 7 : 12} className="br-checks-block">
							<h2>맡은 일</h2>
							<ul className="br-checks">
								{project.contributions.map((item, index) => (
									<li key={item} data-reveal="" style={cssVars({ d: index })}>
										{item}
									</li>
								))}
							</ul>
						</Block>
						{project.credits && project.credits.length > 0 && (
							<Block n={next()} tag="CREDITS" span={5} className="br-credits">
								<h2>출처</h2>
								<ul>
									{project.credits.map((credit) => (
										<li key={`${credit.role}-${credit.name}`}>
											<span>{credit.role}</span>
											{credit.href ? (
												<a href={credit.href} target="_blank" rel="noopener noreferrer" className="br-inv">
													{credit.name}
												</a>
											) : (
												<strong>{credit.name}</strong>
											)}{' '}
											<em>{credit.by}</em>
										</li>
									))}
								</ul>
							</Block>
						)}
					</Region>
				)}

				{/* 마무리 */}
				<Block n={next()} tag="END" span={12} tone="neon" className="br-end">
					<p className="br-end-name">{project.name}</p>
					<Links project={project} className="br-links" />
				</Block>
			</div>
		</div>
	);
};

export default BrutalPage;
