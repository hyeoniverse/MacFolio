// bento 템플릿: Framer·Raycast의 SaaS 템플릿처럼. 가운데 정렬한 첫 화면(작은 알림 알약, 촘촘한 큰 제목, 단추 둘, 창틀에 담은 큰 화면) 아래에
// 크기가 다른 타일을 12칸 격자에 빈칸 없이 짜 넣는다 (layout.ts). 주요 기능·숫자·화면 모음·쓴 기술·맡은 일이 한 격자에 섞이고,
// 나머지 구역은 그 아래에 작은 타일 모양으로 이어진다. 1px 선, 고정폭 작은 라벨, 글쇠 모양 표시. 계약은 templates/README.md
import React, { useMemo } from 'react';
import type { Project } from '@/shared/profile';
import { useReveal } from '@/apps/safari/project/reveal';
import {
	iconOf,
	LandingSections,
	Media,
	sectionTitle,
	useLanding,
	useLandingAccent,
	type Landing,
	type LandingHero,
	type LandingPoint,
	type LandingSection,
	type LandingSectionKind,
	type SectionOf,
	type SectionRenderers,
} from '@/apps/safari/project/landing';
import type { ProjectFact } from '@/shared/profile';
import { BentoLinks } from './Links';
import { bentoOf, packSizes, placementStyle, type Placement, type TileSize } from './layout';
import './Page.css';

/* ─── 격자 ─── */

/** 첫 격자의 자리: 같은 랜딩이면 한 번만 짠다 */
const layouts = new WeakMap<Landing, ReturnType<typeof bentoOf> & { numbers: Map<LandingSectionKind, number> }>();
function bentoLayout(landing: Landing) {
	const cached = layouts.get(landing);
	if (cached) return cached;
	const find = <K extends LandingSection['kind']>(kind: K) =>
		landing.sections.find((section): section is SectionOf<K> => section.kind === kind);
	const role = find('role');
	const tech = find('tech');
	// 보이는 구역 머리의 번호: 첫 격자의 머리(주요 기능)부터 아래 구역까지 차례로 (첫 격자에 녹아든 구역은 건너뛴다)
	const numbers = new Map<LandingSectionKind, number>();
	for (const section of landing.sections) {
		const inGrid =
			section.kind === 'stats' ||
			section.kind === 'screens' ||
			section.kind === 'role' ||
			(section.kind === 'tech' && !tech?.specs.length && !tech?.structure);
		if (!inGrid) numbers.set(section.kind, numbers.size + 1);
	}
	const layout = {
		numbers,
		...bentoOf({
			features: find('features')?.items ?? [],
			facts: find('stats')?.facts.length ?? 0,
			screens: Boolean(find('screens')),
			stack: tech?.stack.length ?? 0,
			role: role ? { contributions: role.contributions.length } : null,
		}),
	};
	layouts.set(landing, layout);
	return layout;
}

const placeOf = (landing: Landing, id: string): Placement | undefined => bentoLayout(landing).placements.get(id);

/** 첫 격자 아래에 놓이는 구역 덩어리의 차례 (첫 격자 타일 뒤) */
const blockOrder = (index: number) => ({ '--order': 100 + index }) as React.CSSProperties;

/** 크기 차례로 짠 안쪽 격자의 타일 자리 (중간 폭만 다른 크기로 짤 수 있다) */
const packed = (sizes: TileSize[], mdSizes: TileSize[] = sizes) => {
	const spans = packSizes(sizes);
	const md = packSizes(mdSizes).md;
	return sizes.map((_, i) => placementStyle({ lg: spans.lg[i], md: md[i], sm: spans.sm[i], rows: 1, order: 0 }));
};

/* ─── 작은 조각 ─── */

const Icon: React.FC<{ point: Pick<LandingPoint, 'icon'>; index: number; className?: string }> = ({
	point,
	index,
	className = 'bt-icon',
}) => (
	<span className={className} aria-hidden="true">
		<i className={`fa-solid ${iconOf(point, index)}`} />
	</span>
);

/** 숫자 값을 숫자와 단위로 (120개 → 120, 개). 숫자로 시작하지 않으면 통째로 */
function splitValue(value: string): { number: string; unit: string } {
	const match = /^([+\-−]?[\d.,]+)\s*(.*)$/.exec(value.trim());
	return match ? { number: match[1], unit: match[2] } : { number: value, unit: '' };
}

const Value: React.FC<{ value: string; className?: string }> = ({ value, className = 'bt-value' }) => {
	const { number, unit } = splitValue(value);
	return (
		<strong className={className}>
			{number}
			{unit && <span className="bt-unit">{unit}</span>}
		</strong>
	);
};

/** 숫자 타일의 작은 그림: 퍼센트면 그만큼 찬 막대, 아니면 오르는 막대 묶음 (장식) */
const Spark: React.FC<{ value: string; index: number }> = ({ value, index }) => {
	const percent = /^(\d{1,3}(?:\.\d+)?)\s*%$/.exec(value.trim());
	if (percent)
		return (
			<span className="bt-meter" aria-hidden="true">
				<span style={{ width: `${Math.min(100, Number(percent[1]))}%` }} />
			</span>
		);
	const shapes = [
		[30, 42, 36, 54, 48, 66, 78, 100],
		[52, 40, 60, 46, 70, 64, 82, 100],
		[24, 30, 44, 40, 58, 72, 70, 100],
	];
	return (
		<span className="bt-bars" aria-hidden="true">
			{shapes[index % shapes.length].map((height, i) => (
				<span key={i} style={{ height: `${height}%` }} />
			))}
		</span>
	);
};

/** 그림이 없는 항목의 면: 1px 모눈 위에 큰 아이콘 하나 (장식) */
const Art: React.FC<{ point: LandingPoint; index: number }> = ({ point, index }) => (
	<div className="bt-art" aria-hidden="true">
		<span className="bt-art-icon">
			<i className={`fa-solid ${iconOf(point, index)}`} />
		</span>
	</div>
);

/** 그림 없는 타일의 남는 아래 칸: 옆 타일이 더 길어 자리가 남을 때만 큰 아이콘이 보인다 (CSS 컨테이너 높이) */
const Fill: React.FC<{ point: LandingPoint; index: number }> = ({ point, index }) => (
	<div className="bt-fill" aria-hidden="true">
		<i className={`fa-solid ${iconOf(point, index)}`} />
	</div>
);

/** 항목의 그림 전부: 첫 장은 크게, 나머지는 작은 줄 */
const PointMedia: React.FC<{ point: LandingPoint; frame?: boolean }> = ({ point, frame = true }) => {
	const [first, ...more] = point.media;
	if (!first) return null;
	return (
		<div className="bt-media">
			<div className={frame ? 'bt-shot' : 'bt-shot bt-shot-bare'}>
				<Media media={first} />
			</div>
			{more.length > 0 && (
				<ul className="bt-thumbs" aria-label={`${point.title} 화면 더 보기`}>
					{more.map((media) => (
						<li key={media.src} className="bt-shot">
							<Media media={media} />
						</li>
					))}
				</ul>
			)}
		</div>
	);
};

const PointText: React.FC<{ point: LandingPoint; index: number; icon?: boolean; mark?: React.ReactNode }> = ({
	point,
	index,
	icon = true,
	mark,
}) => (
	<div className="bt-text">
		{mark ?? (icon && <Icon point={point} index={index} />)}
		<h3>{point.title}</h3>
		<p className="bt-body">{point.body}</p>
		{point.detail && <p className="bt-detail">{point.detail}</p>}
	</div>
);

const Head: React.FC<{ section: LandingSection; landing: Landing; title?: string; level?: 2 | 3 }> = ({
	section,
	landing,
	title,
	level = 2,
}) => {
	const Heading = level === 2 ? 'h2' : 'h3';
	const number = bentoLayout(landing).numbers.get(section.kind) ?? 1;
	return (
		<header className="bt-head" data-reveal="">
			<p className="bt-eyebrow">
				<span className="bt-eyebrow-num">{String(number).padStart(2, '0')}</span>
				{section.label}
			</p>
			<Heading className="bt-title">{title ?? sectionTitle(section)}</Heading>
		</header>
	);
};

/* ─── 첫 격자의 타일 ─── */

const FeatureTile: React.FC<{ point: LandingPoint; index: number; place?: Placement; lead: boolean; art: boolean }> = ({
	point,
	index,
	place,
	lead,
	art,
}) => {
	const isLead = lead && index === 0;
	const hasMedia = point.media.length > 0;
	return (
		<li
			className="bt-tile bt-cell bt-feature"
			data-lead={isLead ? '' : undefined}
			data-media={hasMedia ? '' : undefined}
			style={place && placementStyle(place)}
			data-reveal=""
		>
			<PointText point={point} index={index} />
			{hasMedia ? (
				<PointMedia point={point} />
			) : isLead || art ? (
				<Art point={point} index={index} />
			) : (
				<Fill point={point} index={index} />
			)}
		</li>
	);
};

const StatTile: React.FC<{ fact: ProjectFact; index: number; place?: Placement }> = ({ fact, index, place }) => (
	<li className="bt-tile bt-cell bt-stat" style={place && placementStyle(place)} data-reveal="">
		<span className="bt-label">{fact.label}</span>
		<Value value={fact.value} />
		<Spark value={fact.value} index={index} />
	</li>
);

/* ─── 구역 ─── */

const RENDERERS: SectionRenderers = {
	stats: ({ section, landing }) => {
		const { placements } = bentoLayout(landing);
		return (
			<>
				<h2 className="visually-hidden">{section.label}</h2>
				{/* 숫자 타일은 첫 격자에 바로 놓인다: 목록 하나로 묶을 수 없어 각 타일이 목록 항목 역할을 한다 */}
				<ul className="bt-contents" aria-label={section.label}>
					{section.facts.map((fact, i) => (
						<StatTile key={fact.label} fact={fact} index={i} place={placements.get(`stat-${i}`)} />
					))}
				</ul>
			</>
		);
	},
	features: ({ section, landing }) => {
		const { placements, lead } = bentoLayout(landing);
		return (
			<>
				<div className="bt-cell bt-bento-head" style={placementStyle({ lg: 12, md: 12, sm: 12, rows: 1, order: 0 })}>
					<Head section={section} landing={landing} />
				</div>
				<ul className="bt-contents" aria-label={section.label}>
					{section.items.map((point, i) => (
						<FeatureTile
							key={point.title}
							point={point}
							index={i}
							lead={lead}
							// 기능이 셋 이하로 적고 머리 타일이 없으면 타일마다 큰 아이콘 면을 달아 격자가 비어 보이지 않게
							art={!lead && section.items.length <= 3}
							place={placements.get(`feature-${i}`)}
						/>
					))}
				</ul>
			</>
		);
	},
	screens: ({ section, landing }) => {
		const place = placeOf(landing, 'screens');
		return (
			<div className="bt-tile bt-cell bt-screens" style={place && placementStyle(place)} data-reveal="">
				<div className="bt-tile-head">
					<div>
						<p className="bt-label">{section.label}</p>
						<h2 className="bt-tile-title">{sectionTitle(section)}</h2>
					</div>
					<span className="bt-count" aria-hidden="true">
						{String(section.shots.length).padStart(2, '0')}
					</span>
				</div>
				<ul className="bt-strip" data-count={section.shots.length > 4 ? 'many' : section.shots.length}>
					{section.shots.map((shot, i) => (
						<li key={shot.src}>
							<figure>
								<div className="bt-shot">
									<Media media={shot} />
								</div>
								<figcaption>
									<span className="bt-num">{String(i + 1).padStart(2, '0')}</span>
									{shot.caption}
								</figcaption>
							</figure>
						</li>
					))}
				</ul>
			</div>
		);
	},
	steps: ({ section, landing, index }) => {
		// 단계는 한 줄에 나란히: 넓은 폭은 넷까지, 중간 폭은 셋까지
		const places = packed(
			section.items.map(() => (section.items.length > 3 ? 'stat' : 'item')),
			section.items.map(() => 'stat')
		);
		return (
			<div className="bt-block" style={blockOrder(index)}>
				<Head section={section} landing={landing} />
				<ol className="bt-grid bt-steps">
					{section.items.map((point, i) => (
						<li key={point.title} className="bt-tile bt-cell bt-step" style={places[i]} data-reveal="">
							<div className="bt-step-top" aria-hidden="true">
								<span className="bt-step-num">{String(i + 1).padStart(2, '0')}</span>
								<Icon point={point} index={i} className="bt-icon bt-icon-quiet" />
							</div>
							<PointText point={point} index={i} icon={false} />
							<PointMedia point={point} />
						</li>
					))}
				</ol>
			</div>
		);
	},
	built: ({ section, landing, index }) => {
		// 그림 있는 항목은 한 줄 전체에 글과 그림을 나란히, 나머지는 아이콘 타일
		const places = packed(section.items.map((point) => (point.media.length ? 'full' : 'item')));
		return (
			<div className="bt-block" style={blockOrder(index)}>
				<Head section={section} landing={landing} />
				<ul className="bt-grid">
					{section.items.map((point, i) => (
						<li
							key={point.title}
							className="bt-tile bt-cell bt-feature"
							data-media={point.media.length ? '' : undefined}
							data-side={point.media.length ? '' : undefined}
							style={places[i]}
							data-reveal=""
						>
							<PointText point={point} index={i + 2} />
							{point.media.length ? <PointMedia point={point} /> : <Fill point={point} index={i + 2} />}
						</li>
					))}
				</ul>
			</div>
		);
	},
	stories: ({ section, landing, index }) => (
		<div className="bt-block" style={blockOrder(index)}>
			<Head section={section} landing={landing} />
			<div className="bt-stories">
				{section.stories.map((story, n) => {
					const side = Boolean(story.image || story.points.length);
					return (
						<article key={story.title} className="bt-grid bt-story" aria-label={story.title}>
							<div className="bt-tile bt-cell bt-story-main" style={side ? undefined : WHOLE} data-reveal="">
								<p className="bt-label">이야기 {String(n + 1).padStart(2, '0')}</p>
								<h3 className="bt-story-title">{story.title}</h3>
								{story.lead && <p className="bt-body">{story.lead}</p>}
								{story.facts.length > 0 && (
									<dl className="bt-story-facts">
										{story.facts.map((fact) => (
											<div key={fact.label}>
												<dt className="bt-label">{fact.label}</dt>
												<dd>
													<Value value={fact.value} className="bt-value bt-value-sm" />
												</dd>
											</div>
										))}
									</dl>
								)}
							</div>
							{side && (
								<div className="bt-tile bt-cell bt-story-side" data-reveal="">
									{story.image && (
										<div className="bt-shot">
											<Media media={story.image} />
										</div>
									)}
									{story.points.length > 0 && (
										<ul className="bt-story-points">
											{story.points.map((point, i) => (
												<li key={point.title}>
													<Icon point={point} index={i} className="bt-icon bt-icon-sm" />
													<div>
														<h4>{point.title}</h4>
														<p>{point.body}</p>
														{point.detail && <p className="bt-detail">{point.detail}</p>}
														{point.media.length > 0 && <PointMedia point={point} />}
													</div>
												</li>
											))}
										</ul>
									)}
								</div>
							)}
						</article>
					);
				})}
			</div>
		</div>
	),
	controls: ({ section, landing, index }) => {
		const places = packed(section.controls.map(() => 'stat'));
		return (
			<div className="bt-block" style={blockOrder(index)}>
				<Head section={section} landing={landing} />
				<dl className="bt-grid bt-controls">
					{section.controls.map((control, i) => (
						<div key={control.label} className="bt-tile bt-cell bt-control" style={places[i]} data-reveal="">
							<dt>
								{control.keys.map((key, k) => (
									<kbd key={`${key}-${k}`} className="bt-kbd bt-kbd-lg">
										{key}
									</kbd>
								))}
							</dt>
							<dd>{control.label}</dd>
						</div>
					))}
				</dl>
			</div>
		);
	},
	timeline: ({ section, landing, index }) => {
		const first = section.entries[0];
		const last = section.entries[section.entries.length - 1];
		return (
			<div className="bt-block" style={blockOrder(index)}>
				<Head section={section} landing={landing} />
				<div className="bt-grid">
					<ol className="bt-tile bt-cell bt-rail" style={RAIL} data-reveal="">
						{section.entries.map((entry, i) => (
							<li key={`${entry.date}-${entry.label}`} data-last={i === section.entries.length - 1 ? '' : undefined}>
								<time>{entry.date}</time>
								<span>{entry.label}</span>
							</li>
						))}
					</ol>
					<div className="bt-tile bt-cell bt-span" style={RAIL_SIDE} data-reveal="" aria-hidden="true">
						<span className="bt-label">처음과 끝</span>
						<span className="bt-span-dates">
							<span>{first.date}</span>
							{last !== first && <span>{last.date}</span>}
						</span>
						<span className="bt-span-count">
							<strong className="bt-value">{String(section.entries.length).padStart(2, '0')}</strong>
							<span className="bt-label">걸음</span>
						</span>
						<span className="bt-span-ticks">
							{section.entries.map((entry, i) => (
								<span key={`${entry.date}-${i}`} />
							))}
						</span>
					</div>
				</div>
			</div>
		);
	},
	tech: ({ section, landing, index }) => {
		const place = placeOf(landing, 'tech');
		const hasStack = section.stack.length > 0;
		const hasBlock = section.specs.length > 0 || Boolean(section.structure);
		const both = section.specs.length > 0 && Boolean(section.structure);
		return (
			<>
				{hasStack && (
					<div className="bt-tile bt-cell bt-stack" style={place && placementStyle(place)} data-reveal="">
						<span className="bt-icon" aria-hidden="true">
							<i className="fa-solid fa-layer-group" />
						</span>
						<h2 className="bt-tile-title">{sectionTitle(section)}</h2>
						<ul className="bt-stack-list" aria-label="쓴 기술">
							{section.stack.map((item, i) => (
								<li key={item}>
									<span className="bt-num" aria-hidden="true">
										{String(i + 1).padStart(2, '0')}
									</span>
									{item}
								</li>
							))}
						</ul>
					</div>
				)}
				{hasBlock && (
					<div className="bt-block" style={blockOrder(index)}>
						<Head
							section={section}
							landing={landing}
							level={hasStack ? 3 : 2}
							title="사양과 구조를 한눈에 정리했습니다."
						/>
						<div className="bt-grid">
							{section.specs.length > 0 && (
								<dl className="bt-tile bt-cell bt-specs" style={both ? SPECS : WHOLE} data-reveal="">
									{section.specs.map((spec) => (
										<div key={spec.label}>
											<dt>{spec.label}</dt>
											<dd>{spec.value}</dd>
										</div>
									))}
								</dl>
							)}
							{section.structure && (
								<figure className="bt-tile bt-cell bt-tree" style={both ? TREE : WHOLE} data-reveal="">
									<figcaption className="bt-label">폴더 구조</figcaption>
									<pre>{section.structure}</pre>
								</figure>
							)}
						</div>
					</div>
				)}
			</>
		);
	},
	role: ({ section, landing }) => {
		const place = placeOf(landing, 'role');
		return (
			<div className="bt-tile bt-cell bt-role" style={place && placementStyle(place)} data-reveal="">
				<span className="bt-icon" aria-hidden="true">
					<i className="fa-solid fa-user-pen" />
				</span>
				<h2 className="bt-tile-title">{sectionTitle(section)}</h2>
				{(section.role || section.period || section.context) && (
					<dl className="bt-role-meta">
						{section.role && (
							<div>
								<dt className="bt-label">역할</dt>
								<dd>{section.role}</dd>
							</div>
						)}
						{section.context && (
							<div>
								<dt className="bt-label">프로젝트</dt>
								<dd>{section.context}</dd>
							</div>
						)}
						{section.period && (
							<div>
								<dt className="bt-label">기간</dt>
								<dd className="bt-mono">{section.period}</dd>
							</div>
						)}
					</dl>
				)}
				{section.contributions.length > 0 && (
					<ul className="bt-checks">
						{section.contributions.map((item) => (
							<li key={item}>
								<i className="fa-solid fa-check" aria-hidden="true" />
								{item}
							</li>
						))}
					</ul>
				)}
			</div>
		);
	},
	credits: ({ section, landing, index }) => {
		const places = packed(section.credits.map(() => 'item'));
		return (
			<div className="bt-block" style={blockOrder(index)}>
				<Head section={section} landing={landing} />
				<ul className="bt-grid bt-credits">
					{section.credits.map((credit, i) => (
						<li
							key={`${credit.role}-${credit.name}`}
							className="bt-tile bt-cell bt-credit"
							style={places[i]}
							data-reveal=""
						>
							<span className="bt-label">{credit.role}</span>
							<strong>
								{credit.href ? (
									<a href={credit.href} target="_blank" rel="noopener noreferrer">
										{credit.name}
										<i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
									</a>
								) : (
									credit.name
								)}
							</strong>
							<span className="bt-muted">{credit.by}</span>
							{credit.note && <span className="bt-muted">{credit.note}</span>}
						</li>
					))}
				</ul>
			</div>
		);
	},
};

const WHOLE = placementStyle({ lg: 12, md: 12, sm: 12, rows: 1, order: 0 });
const RAIL = placementStyle({ lg: 8, md: 12, sm: 12, rows: 1, order: 0 });
const RAIL_SIDE = placementStyle({ lg: 4, md: 12, sm: 12, rows: 1, order: 0 });
const SPECS = placementStyle({ lg: 7, md: 12, sm: 12, rows: 1, order: 0 });
const TREE = placementStyle({ lg: 5, md: 12, sm: 12, rows: 1, order: 0 });

/* ─── 첫 화면 ─── */

/** 그림이 없을 때 첫 화면의 창: 명령 팔레트처럼 주요 기능을 줄지어 보인다 (장식) */
const Palette: React.FC<{ hero: LandingHero; items: LandingPoint[] }> = ({ hero, items }) => (
	<div className="bt-palette" aria-hidden="true">
		<div className="bt-palette-search">
			<i className="fa-solid fa-magnifying-glass" />
			<span>{hero.name}</span>
			<kbd className="bt-kbd">⌘</kbd>
			<kbd className="bt-kbd">K</kbd>
		</div>
		<p className="bt-palette-group">주요 기능</p>
		<ul>
			{items.slice(0, 5).map((point, i) => (
				<li key={point.title} data-active={i === 0 ? '' : undefined}>
					<Icon point={point} index={i} className="bt-icon bt-icon-sm" />
					<span className="bt-palette-title">{point.title}</span>
					<span className="bt-palette-body">{point.body}</span>
					{i === 0 && <kbd className="bt-kbd">↵</kbd>}
				</li>
			))}
		</ul>
	</div>
);

const Window: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
	<figure className="bt-window" data-reveal="zoom">
		<div className="bt-window-bar" aria-hidden="true">
			<span className="bt-dots">
				<span />
				<span />
				<span />
			</span>
			<span className="bt-window-title">{title}</span>
		</div>
		<div className="bt-window-body">{children}</div>
	</figure>
);

const BentoPage: React.FC<{ project: Project }> = ({ project }) => {
	const landing = useLanding(project);
	const root = useReveal<HTMLDivElement>();
	const accent = useLandingAccent(project.icon);
	const { hero, closing } = landing;
	const features = useMemo(
		() => landing.sections.find((s): s is SectionOf<'features'> => s.kind === 'features')?.items ?? [],
		[landing]
	);
	const badge = hero.meta.context ?? hero.meta.role;

	return (
		<div ref={root} className="tpl tpl-bento" style={accent}>
			<header className="bt-hero">
				<p className="bt-brand">
					{hero.icon ? (
						<img className="bt-app-icon" src={hero.icon} alt="" />
					) : (
						<span className="bt-app-icon bt-app-icon-blank" aria-hidden="true">
							{hero.name.slice(0, 1)}
						</span>
					)}
					{hero.logo ? <img className="bt-logo" src={hero.logo} alt={hero.name} /> : <span>{hero.name}</span>}
				</p>
				{(badge || hero.meta.period) && (
					<p className="bt-badge">
						{hero.meta.period && <span className="bt-badge-tag">{hero.meta.period}</span>}
						{badge && <span>{badge}</span>}
					</p>
				)}
				<h1>{hero.headline}</h1>
				{hero.subhead && <p className="bt-subhead">{hero.subhead}</p>}
				<BentoLinks links={hero.links} />
				{hero.image ? (
					<Window title={hero.name}>
						<Media media={hero.image} eager />
					</Window>
				) : (
					features.length > 0 && (
						<Window title={hero.name}>
							<Palette hero={hero} items={features} />
						</Window>
					)
				)}
			</header>

			{landing.sections.length > 0 && (
				<div className="bt-flow">
					<LandingSections landing={landing} renderers={RENDERERS} className="bt-section" />
				</div>
			)}

			<footer className="bt-closing">
				<div className="bt-closing-tile" data-reveal="">
					<div className="bt-art bt-closing-art" aria-hidden="true" />
					{hero.icon && <img className="bt-app-icon bt-app-icon-lg" src={hero.icon} alt="" />}
					<h2>{closing.title}</h2>
					{closing.lead && <p className="bt-subhead">{closing.lead}</p>}
					<BentoLinks links={closing.links} />
				</div>
			</footer>
		</div>
	);
};

export default BentoPage;
