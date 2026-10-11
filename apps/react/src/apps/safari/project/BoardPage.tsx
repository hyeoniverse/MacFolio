// playful (할 일 관리 WTD가 기본): 스티커 포스터. 파스텔 바탕에 두꺼운 테두리와 종이 그림자의 둥근 카드, 기울어진 스티커.
// 머리(아이콘 타일·손글씨 제목·링크·테이프로 붙인 대표 화면·배지 숫자) → 세 열 보드(주요 기능·만든 방식·맡은 일이 같은 줄에서 시작)
// → 사용 설명서(usage) → 더 들려줄 이야기(chapters) → 날짜 스티커 띠(timeline) → 접착 메모의 폴더 구조 → 폴라로이드(gallery) → 라벨 스티커(specs) → 출처
import React, { useState } from 'react';
import type { Project, ProjectPoint } from '@/shared/profile';
import { cssVars } from '@/shared/lib/cssVars';
import { FactValue, Favicon, Links, Region } from '@/apps/safari/project/parts';
import { useReveal } from '@/apps/safari/project/reveal';
import '@/apps/safari/project/BoardPage.css';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** 파스텔 네 가지(CSS의 --stk-c0 … --stk-c3)를 돌려 쓴다: 카드의 --tone 으로 넘긴다 */
const tone = (i: number) => `var(--stk-c${i % 4})`;

/** 살짝 기울어진 스티커: 번갈아 왼쪽·오른쪽으로 */
const tilt = (i: number) => ((i % 3) - 1) * 1.6;

/** 색 띠가 붙은 열 머리 (라벨 스티커) */
const Label: React.FC<{ text: string; tone: number; note?: string }> = ({ text, tone: c, note }) => (
	<h2 className="stk-label" style={cssVars({ tone: tone(c) })}>
		<span>{text}</span>
		{note && <small>{note}</small>}
	</h2>
);

/** 제목·설명 카드 (주요 기능, 만든 방식, 장의 글). 보드의 카드는 kb-card 로도 찾는다 (시험) */
const PointCard: React.FC<{ point: ProjectPoint; i: number; className?: string; children?: React.ReactNode }> = ({
	point,
	i,
	className = 'stk-card',
	children,
}) => (
	<li className={className} data-reveal="drop" style={cssVars({ d: i % 4, tone: tone(i), r: tilt(i) })}>
		{point.icon && <i className={`fa-solid ${point.icon} stk-card-icon`} aria-hidden="true" />}
		<h3>{point.title}</h3>
		<p>{point.body}</p>
		{point.detail && <p className="stk-card-detail">{point.detail}</p>}
		{children}
	</li>
);

/* ─── 세 열 보드: 할 일 관리 앱답게 카드를 다음 열로 옮겨 볼 수 있다 ─── */
type Lane = 'todo' | 'doing' | 'done';
const LANES: { id: Lane; label: string; status: string; tone: number }[] = [
	{ id: 'todo', label: '주요 기능', status: '할 일', tone: 0 },
	{ id: 'doing', label: '만든 방식', status: '진행 중', tone: 1 },
	{ id: 'done', label: '맡은 일', status: '끝', tone: 2 },
];
const NEXT: Record<Lane, Lane> = { todo: 'doing', doing: 'done', done: 'todo' };

/** 옮길 수 있는 카드: 처음 자리는 기능이 할 일, 만든 방식이 진행 중 */
const movableOf = (project: Project): { id: string; point: ProjectPoint; home: Lane }[] => [
	...project.highlights.map((point) => ({ id: `todo:${point.title}`, point, home: 'todo' as const })),
	...project.build.map((point) => ({ id: `doing:${point.title}`, point, home: 'doing' as const })),
];

/**
 * 세 구역(주요 기능·만든 방식·맡은 일)이 같은 줄에서 시작하는 세 열 (시험이 y를 비교한다).
 * 카드의 화살표 단추로 다음 열 아래로 옮기고, 하나라도 옮겼으면 "처음대로"가 나타난다. 옮긴 자리는 이 페이지에서만 기억한다
 */
const Board: React.FC<{ project: Project }> = ({ project }) => {
	const cards = movableOf(project);
	const [moved, setMoved] = useState<Record<string, Lane>>({});
	const laneOf = (id: string, home: Lane) => moved[id] ?? home;
	const changed = cards.some((card) => laneOf(card.id, card.home) !== card.home);

	return (
		<div className="stk-board-wrap">
			<p className="stk-hint">
				<i className="fa-solid fa-hand-pointer" aria-hidden="true" /> 카드의 화살표로 다음 열에 옮겨 보세요
				{changed && (
					<button type="button" className="stk-reset" onClick={() => setMoved({})}>
						<i className="fa-solid fa-rotate-left" aria-hidden="true" /> 처음대로
					</button>
				)}
			</p>
			<div className="stk-board">
				{LANES.map((lane) => {
					const list = cards.filter((card) => laneOf(card.id, card.home) === lane.id);
					const next = LANES.find((item) => item.id === NEXT[lane.id])!;
					const count = list.length + (lane.id === 'done' ? project.contributions.length : 0);
					return (
						<Region key={lane.id} label={lane.label} className="stk-col">
							<h2 className="stk-label" style={cssVars({ tone: tone(lane.tone) })}>
								<span>{lane.label}</span>
								<small>
									{lane.status} <b className="kb-count">{count}</b>
								</small>
							</h2>
							{lane.id === 'done' && (
								<ul className="stk-checks">
									{project.contributions.map((item, i) => (
										<li key={item} data-reveal="left" style={cssVars({ d: i % 4, tone: tone(i + 2) })}>
											<span className="stk-check" aria-hidden="true">
												<i className="fa-solid fa-check" />
											</span>
											{item}
										</li>
									))}
								</ul>
							)}
							{list.length > 0 && (
								<ul className="stk-stack">
									{list.map((card, i) => (
										<PointCard key={card.id} point={card.point} i={i + lane.tone} className="stk-card kb-card">
											<button
												type="button"
												className="stk-move"
												aria-label={`${card.point.title}: ${next.status}(으)로 옮기기`}
												onClick={() => setMoved((now) => ({ ...now, [card.id]: next.id }))}
											>
												<i
													className={lane.id === 'done' ? 'fa-solid fa-rotate-left' : 'fa-solid fa-arrow-right'}
													aria-hidden="true"
												/>
											</button>
										</PointCard>
									))}
								</ul>
							)}
						</Region>
					);
				})}
			</div>
		</div>
	);
};

/** 스티커 포스터 */
const BoardPage: React.FC<{ project: Project }> = ({ project }) => {
	const root = useReveal<HTMLDivElement>();
	const gallery = project.gallery ?? [];
	const meta = [project.context, project.period].filter(Boolean);

	return (
		<div ref={root} className="stk">
			{/* ─── 머리: 아이콘 타일, 손글씨 제목, 테이프로 붙인 대표 화면 ─── */}
			<header className="stk-head">
				<div className="stk-intro">
					<Favicon project={project} className="stk-icon" />
					<p className="stk-name">
						{project.name}
						{meta.length > 0 && <span className="stk-meta">{meta.join(' · ')}</span>}
					</p>
					<h1 className="stk-title">{project.tagline}</h1>
					<p className="stk-desc">{project.description}</p>
					{project.role && (
						<p className="stk-role">
							<span className="stk-role-tag">맡은 일</span> {project.role}
						</p>
					)}
					<Links project={project} className="stk-links" />
				</div>
				{project.image && (
					<figure className="stk-photo" data-reveal="zoom">
						<img src={project.image} alt={`${project.name} 화면`} />
						{project.logo && <img src={project.logo} alt="" className="stk-photo-logo" />}
					</figure>
				)}
			</header>

			{/* 알록달록한 배지 숫자 */}
			{project.facts.length > 0 && (
				<ul className="stk-badges" aria-label="한눈에 보는 숫자">
					{project.facts.map((fact, i) => (
						<li key={fact.label} data-reveal="" style={cssVars({ d: i, tone: tone(i), r: tilt(i + 1) })}>
							<FactValue text={fact.value} />
							<span>{fact.label}</span>
						</li>
					))}
				</ul>
			)}

			<Board project={project} />

			{/* ─── 사용 설명서: 번호 스티커 목록 ─── */}
			{project.usage && project.usage.length > 0 && (
				<Region label="쓰는 법" className="stk-sheet stk-manual">
					<Label text="사용 설명서" tone={3} />
					<ol className="stk-steps">
						{project.usage.map((step, i) => (
							<li key={step.title} data-reveal="" style={cssVars({ d: i, tone: tone(i + 3), r: tilt(i) })}>
								<span className="stk-num" aria-hidden="true">
									{i + 1}
								</span>
								<div>
									<h3>{step.title}</h3>
									<p>{step.body}</p>
								</div>
							</li>
						))}
					</ol>
				</Region>
			)}

			{/* ─── 더 들려줄 이야기: 장마다 스티커 묶음 ─── */}
			{project.chapters?.map((chapter, c) => (
				<Region key={chapter.title} label={chapter.title} className="stk-sheet stk-chapter">
					<Label text={chapter.title} tone={c + 1} />
					{chapter.lead && (
						<p className="stk-lead" data-reveal="">
							{chapter.lead}
						</p>
					)}
					{chapter.facts && chapter.facts.length > 0 && (
						<ul className="stk-badges small">
							{chapter.facts.map((fact, i) => (
								<li key={fact.label} data-reveal="" style={cssVars({ d: i, tone: tone(i + c), r: tilt(i) })}>
									<FactValue text={fact.value} />
									<span>{fact.label}</span>
								</li>
							))}
						</ul>
					)}
					<ul className="stk-grid">
						{chapter.points.map((point, i) => (
							<PointCard key={point.title} point={point} i={i + c} />
						))}
					</ul>
					{chapter.image && (
						<figure className="stk-photo wide" data-reveal="zoom">
							<img src={chapter.image.src} alt={chapter.image.alt} />
						</figure>
					)}
				</Region>
			))}

			{/* ─── 진행 과정: 날짜 스티커 가로 띠 ─── */}
			{project.timeline && project.timeline.length > 0 && (
				<Region label="진행 과정" className="stk-sheet stk-dates">
					<Label text="진행 과정" tone={1} note={project.period} />
					<ol className="stk-tape">
						{project.timeline.map((step, i) => (
							<li
								key={`${step.date}:${step.label}`}
								data-reveal="drop"
								style={cssVars({ d: i % 5, tone: tone(i), r: tilt(i) })}
							>
								<time>{step.date}</time>
								<span>{step.label}</span>
							</li>
						))}
					</ol>
				</Region>
			)}

			{/* ─── 폴더 구조: 접착 메모 ─── */}
			{project.structure && (
				<Region label="폴더 구조" className="stk-sheet stk-memo">
					<Label text="폴더 구조" tone={2} />
					<pre data-reveal="">{project.structure}</pre>
				</Region>
			)}

			{/* ─── 화면 모음: 폴라로이드 줄 ─── */}
			{gallery.length > 0 && (
				<Region label="화면 모음" className="stk-sheet stk-polaroids">
					<Label text="화면 모음" tone={3} note={`${gallery.length}장`} />
					<ul>
						{gallery.map((shot, i) => (
							<li key={shot.src} data-reveal="zoom" style={cssVars({ d: i % 4, r: tilt(i) })}>
								<figure>
									<img src={shot.src} alt={shot.caption} loading="lazy" />
									<figcaption>{shot.caption}</figcaption>
								</figure>
							</li>
						))}
					</ul>
				</Region>
			)}

			{/* ─── 기술 사양: 라벨 스티커 ─── */}
			<Region label="기술 사양" className="stk-sheet stk-specs">
				<Label text="기술 사양" tone={0} note={project.language} />
				<dl>
					{project.specs.map((spec, i) => (
						<div key={spec.label} data-reveal="" style={cssVars({ d: i % 4, tone: tone(i) })}>
							<dt>{spec.label}</dt>
							<dd>{spec.value}</dd>
						</div>
					))}
				</dl>
				{project.stack.length > 0 && (
					<ul className="stk-chips" aria-label="기술">
						{project.stack.map((name, i) => (
							<li key={name} style={cssVars({ tone: tone(i + 1), r: tilt(i) })}>
								{name}
							</li>
						))}
					</ul>
				)}
			</Region>

			{/* ─── 출처 ─── */}
			{project.credits && project.credits.length > 0 && (
				<Region label="출처" className="stk-sheet stk-credits">
					<Label text="고마운 분들" tone={2} />
					<ul>
						{project.credits.map((credit) => (
							<li key={`${credit.role}:${credit.name}`}>
								<span className="stk-credit-role">{credit.role}</span>
								{credit.href ? (
									<a href={credit.href} {...external}>
										{credit.name}
									</a>
								) : (
									<strong>{credit.name}</strong>
								)}
								<span className="stk-credit-by">by {credit.by}</span>
								{credit.note && <small>{credit.note}</small>}
							</li>
						))}
					</ul>
				</Region>
			)}

			<footer className="stk-foot">
				<p>{project.name}</p>
				<Links project={project} className="stk-links" />
			</footer>
		</div>
	);
};

export default BoardPage;
