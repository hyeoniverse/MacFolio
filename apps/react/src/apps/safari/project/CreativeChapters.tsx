// HYEONIVERSE의 더 들려줄 장마다 다른 짜임 (Apple 제품 페이지처럼 큰 제목·넉넉한 여백·둥근 타일).
// showcase: 모든 기능을 화면이 붙은 타일로 펼친다 / stage: 데모마다 큰 무대 / bento: 크기가 다른 타일
// dashboard: 숫자 타일과 큰 화면 / gauges: 점수 고리 / shield: 겹겹이 쌓인 방어 / palette: 짧은 글 타일
import React from 'react';
import type { ProjectChapter, ProjectFact, ProjectPoint } from '@/shared/profile';
import { FactValue } from '@/apps/safari/project/parts';
import { Clip, ZoomImage } from '@/apps/safari/project/CreativeParts';
import { Demo } from '@/apps/safari/project/CreativeDemos';
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

/** showcase: 기능을 한눈에 훑도록 모든 항목을 화면과 글이 함께 붙은 타일로 펼쳐 둔다 (누를 필요 없이 다 보인다) */
const Showcase: React.FC<{ points: ProjectPoint[] }> = ({ points }) => (
	<ol className="cr-showcase">
		{points.map((point, i) => (
			<li key={point.title} className="cr-tile" data-reveal="" style={{ '--d': i % 2 } as React.CSSProperties}>
				{/* 화면이 없는 항목도 같은 자리를 아이콘으로 채워 타일 높이를 맞춘다 */}
				<figure className="cr-showcase-shot" data-icon={point.image ? undefined : ''}>
					{point.image ? (
						<ZoomImage src={point.image} alt={`${point.title} 화면`} />
					) : (
						<i className={`fa-solid ${point.icon ?? 'fa-table-columns'}`} aria-hidden="true" />
					)}
				</figure>
				<p className="cr-eyebrow">{String(i + 1).padStart(2, '0')}</p>
				<h3>{point.title}</h3>
				<p>{point.body}</p>
			</li>
		))}
	</ol>
);

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

/** bento: 데모와 그림이 있는 항목은 큰 타일, 글만 있는 항목은 작은 타일 */
const Bento: React.FC<{ points: ProjectPoint[] }> = ({ points }) => (
	<div className="cr-bento">
		{points.map((point) => (
			<article
				key={point.title}
				className="cr-tile"
				data-size={point.demo ? 'demo' : point.image || point.shots ? 'image' : 'text'}
				data-reveal=""
			>
				<header>
					<h3>{point.title}</h3>
					<p>{point.body}</p>
				</header>
				<PointMedia point={point} />
			</article>
		))}
	</div>
);

/** dashboard: 큰 화면은 첫 줄을 다 쓰고, 나머지는 아이콘이 붙은 작은 카드 */
const Dashboard: React.FC<{ points: ProjectPoint[] }> = ({ points }) => {
	const [hero, ...rest] = points;
	return (
		<div className="cr-dashboard">
			<article className="cr-tile cr-dashboard-hero" data-reveal="">
				<header>
					<h3>{hero.title}</h3>
					<p>{hero.body}</p>
				</header>
				<PointMedia point={hero} />
			</article>
			<div className="cr-dashboard-cards">
				{rest.map((point, i) => (
					<article key={point.title} className="cr-tile" data-reveal="" style={{ '--d': i % 3 } as React.CSSProperties}>
						{point.icon && <i className={`cr-tile-icon fa-solid ${point.icon}`} aria-hidden="true" />}
						<h3>{point.title}</h3>
						<p>{point.body}</p>
					</article>
				))}
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

/** palette: 짧은 글을 작은 타일 세 줄로 */
const Tiles: React.FC<{ points: ProjectPoint[] }> = ({ points }) => (
	<div className="cr-tiles">
		{points.map((point, i) => (
			<article key={point.title} className="cr-tile" data-reveal="" style={{ '--d': i % 3 } as React.CSSProperties}>
				{point.icon && <i className={`cr-tile-icon fa-solid ${point.icon}`} aria-hidden="true" />}
				<h3>{point.title}</h3>
				<p>{point.body}</p>
				<PointMedia point={point} />
			</article>
		))}
	</div>
);

/** 장의 글 묶음: 장 모양(look)마다 다른 짜임, 정하지 않았으면 두 칸 글 묶음 */
export const ChapterPoints: React.FC<{ chapter: ProjectChapter }> = ({ chapter }) => {
	const { points, look } = chapter;
	if (look === 'showcase') return <Showcase points={points} />;
	if (look === 'stage') return <Stage points={points} />;
	if (look === 'bento') return <Bento points={points} />;
	if (look === 'dashboard') return <Dashboard points={points} />;
	if (look === 'gauges') return <Numbered points={points} />;
	if (look === 'shield') return <Shield points={points} />;
	if (look === 'palette') return <Tiles points={points} />;
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
