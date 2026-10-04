// HYEONIVERSE의 더 들려줄 장마다 다른 짜임 (Apple 제품 페이지처럼 큰 제목·넉넉한 여백·둥근 타일).
// showcase: 묶음마다 큰 칸과 작은 칸 / stage: 데모마다 큰 무대 / bento: 글과 데모가 좌우로 엇갈린 줄
// dashboard: 계기판 숫자, 겹친 화면, 옆으로 넘기는 카드 / gauges: 점수 고리 / shield: 겹겹이 쌓인 방어
// palette: 읽는 항목에 따라 바뀌는 붙은 화면
import React, { useEffect, useRef, useState } from 'react';
import type { ProjectChapter, ProjectFact, ProjectPoint } from '@/shared/profile';
import { FactValue } from '@/apps/safari/project/parts';
import { Clip, ZoomImage } from '@/apps/safari/project/CreativeParts';
import { Demo } from '@/apps/safari/project/CreativeDemos';
import { scrollParent } from '@/apps/safari/project/scroll';
import '@/apps/safari/project/CreativeChapters.css';

/** 실제 화면 여러 장: 영상(.mp4)은 넓게 두고 화면에 보일 때만 돌리고, 그림은 눌러 크게 본다 */
export const Shots: React.FC<{ shots: NonNullable<ProjectPoint['shots']> }> = ({ shots }) => (
	<div className="cr-shots">
		<p>실제 화면</p>
		<ul>
			{shots.map((shot) => (
				<li key={shot.src} data-video={shot.src.endsWith('.mp4') || undefined}>
					{shot.src.endsWith('.mp4') ? (
						<Clip src={shot.src} label={shot.alt} />
					) : (
						<ZoomImage src={shot.src} alt={shot.alt} />
					)}
					<span>{shot.alt}</span>
				</li>
			))}
		</ul>
	</div>
);

/** 그 글 묶음에 붙는 화면: 데모(+실제 화면), 실제 화면 여러 장, 그림 한 장 가운데 있는 것 */
const PointMedia: React.FC<{ point: ProjectPoint }> = ({ point }) => {
	if (point.demo)
		return (
			<div className="cr-point-demo" data-demo={point.demo}>
				<Demo kind={point.demo} />
				{point.shots && <Shots shots={point.shots} />}
			</div>
		);
	if (point.shots)
		return (
			<div className="cr-point-demo">
				<Shots shots={point.shots} />
			</div>
		);
	if (point.image)
		return (
			<figure className="cr-point-shot">
				<ZoomImage src={point.image} alt={`${point.title} 화면`} />
			</figure>
		);
	return null;
};

/** 장 첫머리 숫자: 보통은 한 줄, 대시보드는 숫자 타일, 성능은 점수 고리 */
export const ChapterFacts: React.FC<{ facts: ProjectFact[]; look?: ProjectChapter['look'] }> = ({ facts, look }) => {
	if (look === 'gauges')
		return (
			<ul className="cr-gauges" data-reveal="">
				{facts.map((fact) => {
					const score = /^(\d+)점$/.exec(fact.value);
					return (
						<li key={fact.label} style={{ '--score': score ? Number(score[1]) : 100 } as React.CSSProperties}>
							<span className="cr-gauge" data-score={score ? '' : undefined}>
								<FactValue text={score ? score[1] : fact.value} />
							</span>
							<span>{fact.label}</span>
						</li>
					);
				})}
			</ul>
		);
	return (
		<ul className="cr-chapter-facts" data-look={look} data-reveal="">
			{facts.map((fact) => (
				<li key={fact.label}>
					<FactValue text={fact.value} />
					<span>{fact.label}</span>
				</li>
			))}
		</ul>
	);
};

/** 장 안의 항목을 group 이름이 같은 것끼리 차례대로 묶는다 */
const groupsOf = (points: ProjectPoint[]) =>
	points.reduce<{ name: string; points: ProjectPoint[] }[]>((groups, point) => {
		const name = point.group ?? '';
		const last = groups.at(-1);
		if (last && last.name === name) last.points.push(point);
		else groups.push({ name, points: [point] });
		return groups;
	}, []);

/** 항목의 화면 칸: 그림이 없으면 같은 자리를 아이콘으로 채워 칸 높이를 맞춘다 */
const ShotSlot: React.FC<{ point: ProjectPoint; className: string }> = ({ point, className }) => (
	<figure className={className} data-icon={point.image ? undefined : ''}>
		{point.image ? (
			<ZoomImage src={point.image} alt={`${point.title} 화면`} />
		) : (
			<i className={`fa-solid ${point.icon ?? 'fa-table-columns'}`} aria-hidden="true" />
		)}
	</figure>
);

/**
 * showcase (관리자와 CMS): 항목을 묶음(쓰기, 발행과 정리, 운영, 권한과 설정)으로 나누고, 묶음마다 첫 항목은 화면을 크게
 * 글 옆에 둔 큰 칸, 나머지는 화면이 위에 붙은 작은 칸으로 짠다. 묶음마다 큰 칸의 좌우를 바꾼다. 누를 필요 없이 다 보인다
 */
const Showcase: React.FC<{ points: ProjectPoint[] }> = ({ points }) => {
	const groups = groupsOf(points);
	// 묶음마다 첫 항목의 번호 (1부터)
	const firsts = groups.map((_, g) => 1 + groups.slice(0, g).reduce((sum, group) => sum + group.points.length, 0));
	return (
		<div className="cr-showcase">
			{groups.map((group, g) => {
				const [lead, ...rest] = group.points;
				const first = firsts[g];
				const no = first + rest.length;
				return (
					<section key={group.name || g} className="cr-showcase-group" aria-label={group.name || undefined}>
						{group.name && (
							<h3 className="cr-showcase-name" data-reveal="">
								<span>
									{String(first).padStart(2, '0')}–{String(no).padStart(2, '0')}
								</span>
								{group.name}
							</h3>
						)}
						<article className="cr-tile cr-showcase-lead" data-flip={g % 2 === 1 || undefined} data-reveal="">
							<ShotSlot point={lead} className="cr-showcase-shot" />
							<div>
								<h4>{lead.title}</h4>
								<p>{lead.body}</p>
							</div>
						</article>
						<div className="cr-showcase-rest" data-count={rest.length}>
							{rest.map((point, i) => (
								<article
									key={point.title}
									className="cr-tile"
									data-reveal=""
									style={{ '--d': i } as React.CSSProperties}
								>
									<ShotSlot point={point} className="cr-showcase-shot" />
									<h4>{point.title}</h4>
									<p>{point.body}</p>
								</article>
							))}
						</div>
					</section>
				);
			})}
		</div>
	);
};

/** stage: 데모마다 큰 무대 타일. 작은 머리말, 큰 제목, 짧은 글 다음에 데모와 실제 화면 */
const Stage: React.FC<{ points: ProjectPoint[] }> = ({ points }) => (
	<div className="cr-stage">
		{points.map((point, i) => (
			<article key={point.title} className="cr-tile" data-reveal="">
				<header>
					<p className="cr-eyebrow">{String(i + 1).padStart(2, '0')}</p>
					<h3>{point.title}</h3>
					<p>{point.body}</p>
				</header>
				<PointMedia point={point} />
			</article>
		))}
	</div>
);

/** bento (AI 번역·요약·커버): 항목마다 글과 데모(또는 화면)가 좌우로 놓인 큰 줄. 줄마다 좌우를 바꾸고, 글은 줄 안에서 붙어 따라온다 */
const Bento: React.FC<{ points: ProjectPoint[] }> = ({ points }) => (
	<div className="cr-split">
		{points.map((point, i) => (
			<article
				key={point.title}
				className="cr-split-row"
				data-flip={i % 2 === 1 || undefined}
				data-kind={point.demo ? 'demo' : 'image'}
				data-reveal=""
			>
				<header>
					<p className="cr-eyebrow">{point.demo ? '직접 해 보기' : '실제 화면'}</p>
					<h3>{point.title}</h3>
					<p>{point.body}</p>
				</header>
				<div className="cr-split-media">
					<PointMedia point={point} />
				</div>
			</article>
		))}
	</div>
);

/** dashboard (트래픽 분석): 겹쳐 놓은 실제 화면 콜라주, 그 아래로 옆으로 넘기는 아이콘 카드 */
const Dashboard: React.FC<{ points: ProjectPoint[] }> = ({ points }) => {
	const [hero, ...rest] = points;
	const rail = useRef<HTMLOListElement>(null);
	const slide = (dir: number) =>
		rail.current?.scrollBy({ left: dir * rail.current.clientWidth * 0.8, behavior: 'smooth' });
	return (
		<div className="cr-dashboard">
			<header className="cr-dashboard-head" data-reveal="">
				<h3>{hero.title}</h3>
				<p>{hero.body}</p>
			</header>
			{hero.shots && (
				<div className="cr-collage" data-reveal="zoom">
					{hero.shots.map((shot, i) => (
						<figure key={shot.src} data-at={i}>
							<ZoomImage src={shot.src} alt={shot.alt} />
							<figcaption>{shot.alt}</figcaption>
						</figure>
					))}
				</div>
			)}
			<div className="cr-rail-wrap">
				<ol className="cr-rail" ref={rail}>
					{rest.map((point) => (
						<li key={point.title} className="cr-tile">
							{point.icon && <i className={`cr-tile-icon fa-solid ${point.icon}`} aria-hidden="true" />}
							<h3>{point.title}</h3>
							<p>{point.body}</p>
						</li>
					))}
				</ol>
				<div className="cr-rail-nav">
					<button type="button" aria-label="이전 카드" onClick={() => slide(-1)}>
						<i className="fa-solid fa-chevron-left" />
					</button>
					<button type="button" aria-label="다음 카드" onClick={() => slide(1)}>
						<i className="fa-solid fa-chevron-right" />
					</button>
				</div>
			</div>
		</div>
	);
};

/** gauges: 고친 일을 큰 번호와 함께 두 칸으로 */
const Numbered: React.FC<{ points: ProjectPoint[] }> = ({ points }) => (
	<ol className="cr-numbered">
		{points.map((point, i) => (
			<li key={point.title} data-reveal="" style={{ '--d': i % 2 } as React.CSSProperties}>
				<span className="cr-numbered-no">{i + 1}</span>
				<div>
					<h3>{point.title}</h3>
					<p>{point.body}</p>
				</div>
			</li>
		))}
	</ol>
);

/** shield: 요청이 들어와 DB까지 가는 동안 지나는 방어를 바깥부터 차례로 쌓는다 */
const Shield: React.FC<{ points: ProjectPoint[] }> = ({ points }) => (
	<ol className="cr-shield">
		{points.map((point, i) => (
			<li key={point.title} data-reveal="left" style={{ '--d': i, '--depth': i } as React.CSSProperties}>
				<span className="cr-shield-icon" aria-hidden="true">
					<i className={`fa-solid ${point.icon ?? 'fa-shield-halved'}`} />
				</span>
				<div>
					<h3>{point.title}</h3>
					<p>{point.body}</p>
				</div>
			</li>
		))}
	</ol>
);

/** 항목이 보여 줄 화면들: 그림 한 장, 실제 화면 여러 장, 없으면 장의 그림 */
const mediaOf = (point: ProjectPoint, fallback?: ProjectChapter['image']) =>
	point.image
		? [{ src: point.image, alt: `${point.title} 화면` }]
		: point.shots?.length
			? point.shots
			: fallback
				? [{ src: fallback.src, alt: fallback.alt }]
				: [];

/**
 * palette (테마): 왼쪽 글을 읽어 내려가면 오른쪽에 붙은 화면이 지금 읽는 항목의 화면으로 바뀐다 (누르지 않아도 글은 모두 보인다).
 * 좁은 창에서는 항목마다 화면을 글 아래에 둔다
 */
const Tiles: React.FC<{ points: ProjectPoint[]; fallback?: ProjectChapter['image'] }> = ({ points, fallback }) => {
	const list = useRef<HTMLOListElement>(null);
	const [active, setActive] = useState(0);
	useEffect(() => {
		const node = list.current;
		if (!node || typeof IntersectionObserver === 'undefined') return;
		const items = [...node.querySelectorAll<HTMLElement>(':scope > li')];
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) if (entry.isIntersecting) setActive(items.indexOf(entry.target as HTMLElement));
			},
			// 스크롤하는 칸 가운데 띠를 지나는 항목이 지금 읽는 항목
			{ root: scrollParent(node), rootMargin: '-45% 0px -45% 0px' }
		);
		items.forEach((item) => observer.observe(item));
		return () => observer.disconnect();
	}, []);
	return (
		<div className="cr-spot">
			<ol className="cr-spot-list" ref={list}>
				{points.map((point, i) => (
					<li key={point.title} data-active={i === active || undefined}>
						{point.icon && <i className={`cr-tile-icon fa-solid ${point.icon}`} aria-hidden="true" />}
						<h3>{point.title}</h3>
						<p>{point.body}</p>
						<div className="cr-spot-inline">
							{mediaOf(point, fallback).map((shot) => (
								<ZoomImage key={shot.src} src={shot.src} alt={shot.alt} />
							))}
						</div>
					</li>
				))}
			</ol>
			<div className="cr-spot-stage" aria-hidden="true">
				{points.map((point, i) => {
					const media = mediaOf(point, fallback);
					return (
						<figure key={point.title} data-active={i === active || undefined} data-count={media.length}>
							{media.map((shot) => (
								<img key={shot.src} src={shot.src} alt="" loading="lazy" />
							))}
						</figure>
					);
				})}
			</div>
		</div>
	);
};

/** 장의 글 묶음: 장 모양(look)마다 다른 짜임, 정하지 않았으면 두 칸 글 묶음 */
export const ChapterPoints: React.FC<{ chapter: ProjectChapter }> = ({ chapter }) => {
	const { points, look } = chapter;
	if (look === 'showcase') return <Showcase points={points} />;
	if (look === 'stage') return <Stage points={points} />;
	if (look === 'bento') return <Bento points={points} />;
	if (look === 'dashboard') return <Dashboard points={points} />;
	if (look === 'gauges') return <Numbered points={points} />;
	if (look === 'shield') return <Shield points={points} />;
	if (look === 'palette') return <Tiles points={points} fallback={chapter.image} />;
	return (
		<div className="cr-build">
			{points.map((point, i) => (
				<article
					key={point.title}
					data-reveal=""
					data-wide={point.image || point.demo || point.shots ? '' : undefined}
					data-demo={point.demo || point.shots ? '' : undefined}
					style={{ '--d': i % 2 } as React.CSSProperties}
				>
					<PointMedia point={point} />
					<div>
						<h3>{point.title}</h3>
						<p>{point.body}</p>
					</div>
				</article>
			))}
		</div>
	);
};
