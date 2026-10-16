// product 템플릿: Apple 제품 페이지의 스크롤 이야기처럼. 페이지는 한 화면씩의 장면이 이어진다.
// 첫 장면은 화면 가득 번지는 제품 화면과 그 바로 아래의 아주 큰 제목. 숫자는 한 장면에 숫자 하나를 폭 가득,
// 기능은 하나가 한 장면(큰 그림 또는 큰 아이콘 구성, 짧은 제목과 한 줄)이며 스크롤하면 무대가 머문 채 다음 장면으로 서서히 바뀐다.
// 화면 모음은 옆으로 넘기는 띠, 나머지(쓰는 법부터 출처까지)는 위에 차례 막대가 붙는 '사양' 장으로 모아 두 칸 사양 표로 그린다.
// 움직임 줄이기면 장면을 위아래로 늘어놓는다. 계약은 templates/README.md
import React, { useEffect, useRef, useState } from 'react';
import type { Project } from '@/shared/profile';
import { prefersReducedMotion, useReveal } from '@/apps/safari/project/reveal';
import { scrollParent } from '@/apps/safari/project/scroll';
import {
	DeployList,
	LandingLinks,
	LandingSections,
	TeamList,
	TroubleList,
	Media,
	iconOf,
	useLanding,
	useLandingAccent,
	type LandingHero,
	type LandingPoint,
	type LandingSection,
	type LandingSectionKind,
	type SectionRenderers,
} from '@/apps/safari/project/landing';
import { Gallery } from './Gallery';
import { ScrollStory } from './Scenes';
import { useStageHeight } from './stage';
import { productAccent } from './accent';
import './Page.css';

/** 구역마다 Apple 말투의 짧은 문장 */
const VOICE: Record<LandingSectionKind, string> = {
	stats: '숫자로 보면 더 분명합니다.',
	features: '한 번 보면 압니다.',
	screens: '화면이 먼저 말합니다.',
	steps: '시작은 간단합니다.',
	built: '보이지 않는 곳까지 다듬었습니다.',
	troubleshooting: '막힌 곳은 끝까지 풀었습니다.',
	stories: '만든 데에는 이유가 있습니다.',
	controls: '손에 금방 익습니다.',
	tech: '안쪽도 단단합니다.',
	team: '함께 만들었습니다.',
	role: '제가 맡은 일입니다.',
	timeline: '처음부터 끝까지의 기록입니다.',
	deployments: '어디서든 열어 볼 수 있습니다.',
	credits: '고마운 도움을 밝힙니다.',
};

/** 이야기 장면으로 그리는 구역 (나머지는 사양 장) */
const STORY_KINDS: readonly LandingSectionKind[] = ['stats', 'features', 'screens'];

/** "1,800명", "92%", "4주"를 앞말·숫자·뒷말로 (숫자는 크게, 단위는 작게) */
const splitValue = (text: string) => {
	const match = /^(\D*?)([\d.,]+)(\D*)$/.exec(text.trim());
	return match ? { before: match[1], value: match[2], after: match[3] } : null;
};

const Figure: React.FC<{ value: string; className?: string }> = ({ value, className }) => {
	const parts = splitValue(value);
	const cls = ['pd-figure', className].filter(Boolean).join(' ');
	if (!parts) return <strong className={cls}>{value}</strong>;
	return (
		<strong className={cls}>
			{parts.before && <span className="pd-unit">{parts.before}</span>}
			{parts.value}
			{parts.after && <span className="pd-unit">{parts.after}</span>}
		</strong>
	);
};

/** 강조색 아이콘 (장식) */
const Glyph: React.FC<{ point: LandingPoint; index: number }> = ({ point, index }) => (
	<span className="pd-glyph" aria-hidden="true">
		<i className={`fa-solid ${iconOf(point, index)}`} />
	</span>
);

/** 장면 앞의 머리: 작은 구역 이름과 아주 큰 한 문장 */
const Intro: React.FC<{ section: LandingSection }> = ({ section }) => (
	<header className="pd-intro" data-reveal="">
		<p className="pd-eyebrow">{section.label}</p>
		<h2>{VOICE[section.kind]}</h2>
	</header>
);

/** 기능 장면의 그림: 첫 장을 무대 가득, 나머지는 아래에 작게. 그림이 없으면 큰 아이콘 구성 */
const FeatureVisual: React.FC<{ point: LandingPoint; index: number }> = ({ point, index }) => {
	const [first, ...more] = point.media;
	if (!first)
		return (
			<div className="pd-art" aria-hidden="true">
				<span className="pd-art-rings">
					<i />
					<i />
					<i />
				</span>
				<span className="pd-art-icon">
					<i className={`fa-solid ${iconOf(point, index)}`} />
				</span>
			</div>
		);
	return (
		<div className="pd-shot-set">
			<div className="pd-shot">
				<Media media={first} className="pd-shot-media" />
			</div>
			{more.length > 0 && (
				<ul className="pd-thumbs" aria-label={`${point.title} 화면 더 보기`}>
					{more.map((media) => (
						<li key={media.src}>
							<Media media={media} className="pd-framed" />
						</li>
					))}
				</ul>
			)}
		</div>
	);
};

const FeatureScene: React.FC<{ point: LandingPoint; index: number; total: number }> = ({ point, index, total }) => (
	<div className="pd-scene" data-art={point.media.length ? undefined : ''}>
		<div className="pd-scene-text">
			<p className="pd-scene-count" aria-hidden="true">
				{index + 1} / {total}
			</p>
			{point.group && <p className="pd-group">{point.group}</p>}
			<h3>{point.title}</h3>
			<p className="pd-scene-line">{point.body}</p>
			{point.detail && <p className="pd-scene-detail">{point.detail}</p>}
		</div>
		<div className="pd-scene-visual">
			<FeatureVisual point={point} index={index} />
		</div>
	</div>
);

/** 사양 장의 한 줄: 왼쪽에 구역 이름과 한 문장, 오른쪽에 내용 */
const Spec: React.FC<{ section: LandingSection; children: React.ReactNode }> = ({ section, children }) => (
	<div className="pd-spec-row">
		<header className="pd-spec-head">
			<h2>{section.label}</h2>
			<p>{VOICE[section.kind]}</p>
		</header>
		<div className="pd-spec-body">{children}</div>
	</div>
);

/** 사양 장의 항목 글: 제목, 설명, 이어 읽는 설명 */
const PointText: React.FC<{ point: LandingPoint }> = ({ point }) => (
	<>
		{point.group && <p className="pd-group">{point.group}</p>}
		<h3>{point.title}</h3>
		<p className="pd-body">{point.body}</p>
		{point.detail && <p className="pd-detail">{point.detail}</p>}
	</>
);

const PointMedia: React.FC<{ point: LandingPoint }> = ({ point }) =>
	point.media.length > 0 ? (
		<div className="pd-point-media">
			{point.media.map((media) => (
				<Media key={media.src} media={media} className="pd-framed" />
			))}
		</div>
	) : null;

/** 두 칸 사양 표 (이름 → 값) */
const SpecTable: React.FC<{ rows: [string, React.ReactNode][] }> = ({ rows }) =>
	rows.length > 0 ? (
		<dl className="pd-table">
			{rows.map(([label, value]) => (
				<div key={label}>
					<dt>{label}</dt>
					<dd>{value}</dd>
				</div>
			))}
		</dl>
	) : null;

const RENDERERS: SectionRenderers = {
	stats: ({ section }) => (
		<>
			<h2 className="pd-stats-title">{VOICE.stats}</h2>
			<ScrollStory names={section.facts.map((fact) => fact.label)} navLabel="숫자 고르기" className="pd-numbers">
				{(index) => {
					const fact = section.facts[index];
					return (
						<div className="pd-number">
							<Figure value={fact.value} className="pd-giant" />
							<p className="pd-number-label">{fact.label}</p>
						</div>
					);
				}}
			</ScrollStory>
		</>
	),
	features: ({ section }) => (
		<>
			<Intro section={section} />
			<ScrollStory names={section.items.map((point) => point.title)} navLabel="기능 고르기" className="pd-features">
				{(index) => <FeatureScene point={section.items[index]} index={index} total={section.items.length} />}
			</ScrollStory>
		</>
	),
	screens: ({ section }) => (
		<>
			<Intro section={section} />
			<Gallery shots={section.shots} />
		</>
	),
	steps: ({ section }) => (
		<Spec section={section}>
			<ol className="pd-rows">
				{section.items.map((point, index) => (
					<li key={point.title}>
						<span className="pd-row-mark" aria-hidden="true">
							{index + 1}
						</span>
						<div>
							<PointText point={point} />
							<PointMedia point={point} />
						</div>
					</li>
				))}
			</ol>
		</Spec>
	),
	built: ({ section }) => (
		<Spec section={section}>
			<ul className="pd-rows">
				{section.items.map((point, index) => (
					<li key={point.title}>
						<Glyph point={point} index={index} />
						<div>
							<PointText point={point} />
							<PointMedia point={point} />
						</div>
					</li>
				))}
			</ul>
		</Spec>
	),
	troubleshooting: ({ section }) => (
		<Spec section={section}>
			<TroubleList items={section.items} prefix="pd" reveal={false} />
		</Spec>
	),
	stories: ({ section }) => (
		<Spec section={section}>
			<div className="pd-stories">
				{section.stories.map((story) => (
					<article key={story.title} className="pd-story" aria-label={story.title}>
						<h3>{story.title}</h3>
						{story.lead && <p className="pd-body">{story.lead}</p>}
						{story.facts.length > 0 && (
							<ul className="pd-story-facts">
								{story.facts.map((fact) => (
									<li key={fact.label}>
										<Figure value={fact.value} />
										<span>{fact.label}</span>
									</li>
								))}
							</ul>
						)}
						{story.points.length > 0 && (
							<ul className="pd-story-points">
								{story.points.map((point) => (
									<li key={point.title}>
										<h4>{point.title}</h4>
										<p className="pd-body">{point.body}</p>
										{point.detail && <p className="pd-detail">{point.detail}</p>}
										<PointMedia point={point} />
									</li>
								))}
							</ul>
						)}
						{story.image && (
							<figure className="pd-story-image">
								<Media media={story.image} className="pd-framed" />
							</figure>
						)}
					</article>
				))}
			</div>
		</Spec>
	),
	controls: ({ section }) => (
		<Spec section={section}>
			<SpecTable
				rows={section.controls.map((control) => [
					control.label,
					<span key={control.label} className="pd-keys">
						{control.keys.map((key) => (
							<kbd key={key}>{key}</kbd>
						))}
					</span>,
				])}
			/>
		</Spec>
	),
	tech: ({ section }) => (
		<Spec section={section}>
			<SpecTable
				rows={[
					...(section.stack.length > 0
						? ([
								[
									'쓴 기술',
									<ul key="stack" className="pd-stack" aria-label="쓴 기술">
										{section.stack.map((item) => (
											<li key={item}>{item}</li>
										))}
									</ul>,
								],
							] as [string, React.ReactNode][])
						: []),
					...section.specs.map((spec): [string, React.ReactNode] => [spec.label, spec.value]),
					...(section.structure
						? ([
								[
									'폴더 구조',
									<pre key="tree" className="pd-structure">
										{section.structure}
									</pre>,
								],
							] as [string, React.ReactNode][])
						: []),
				]}
			/>
		</Spec>
	),
	team: ({ section }) => (
		<Spec section={section}>
			<TeamList members={section.members} prefix="pd" reveal={false} />
		</Spec>
	),
	role: ({ section }) => (
		<Spec section={section}>
			<SpecTable
				rows={(
					[
						['역할', section.role],
						['프로젝트', section.context],
						['기간', section.period],
					] as [string, string | undefined][]
				).filter((row): row is [string, string] => Boolean(row[1]))}
			/>
			{section.contributions.length > 0 && (
				<ul className="pd-contributions">
					{section.contributions.map((item) => (
						<li key={item}>
							<i className="fa-solid fa-check" aria-hidden="true" />
							<span>{item}</span>
						</li>
					))}
				</ul>
			)}
		</Spec>
	),
	timeline: ({ section }) => (
		<Spec section={section}>
			<ol className="pd-table pd-timeline">
				{section.entries.map((entry) => (
					<li key={`${entry.date}-${entry.label}`}>
						<time>{entry.date}</time>
						<span>{entry.label}</span>
					</li>
				))}
			</ol>
		</Spec>
	),
	deployments: ({ section }) => (
		<Spec section={section}>
			<DeployList items={section.items} prefix="pd" reveal={false} />
		</Spec>
	),
	credits: ({ section }) => (
		<Spec section={section}>
			<ul className="pd-table pd-credits">
				{section.credits.map((credit) => (
					<li key={`${credit.role}-${credit.name}`}>
						<span className="pd-credit-role">{credit.role}</span>
						<span className="pd-credit-name">
							{credit.href ? (
								<a href={credit.href} target="_blank" rel="noopener noreferrer">
									{credit.name}
								</a>
							) : (
								credit.name
							)}
							<span className="pd-credit-by">{credit.by}</span>
							{credit.note && <span className="pd-credit-note">{credit.note}</span>}
						</span>
					</li>
				))}
			</ul>
		</Spec>
	),
};

/** 첫 장면의 그림: 대표 화면을 장면 가득, 없으면 앱 아이콘(또는 첫 기능의 아이콘)을 가는 동심원 위에 크게 */
const HeroVisual: React.FC<{ hero: LandingHero; first?: LandingPoint }> = ({ hero, first }) => {
	if (hero.image)
		return (
			<figure className="pd-hero-visual">
				<Media media={hero.image} eager className="pd-hero-shot" />
			</figure>
		);
	if (!hero.icon && !first) return null;
	return (
		<div className="pd-hero-visual" aria-hidden="true">
			<div className="pd-art pd-hero-art">
				<span className="pd-art-rings">
					<i />
					<i />
					<i />
				</span>
				{hero.icon ? (
					<img className="pd-hero-icon" src={hero.icon} alt="" />
				) : (
					first && (
						<span className="pd-art-icon">
							<i className={`fa-solid ${iconOf(first, 0)}`} />
						</span>
					)
				)}
			</div>
		</div>
	);
};

/** 사양 장 위의 차례 막대: 누르면 그 구역으로 내려가고, 지금 읽는 구역에 표시가 붙는다 */
const SpecNav: React.FC<{ sections: LandingSection[]; name: string }> = ({ sections, name }) => {
	const ref = useRef<HTMLElement>(null);
	const [current, setCurrent] = useState<LandingSectionKind | null>(null);
	const kinds = sections.map((section) => section.kind).join(',');

	useEffect(() => {
		const chapter = ref.current?.parentElement;
		if (!chapter || typeof IntersectionObserver === 'undefined') return;
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries)
					if (entry.isIntersecting) setCurrent((entry.target as HTMLElement).dataset.section as LandingSectionKind);
			},
			{ root: scrollParent(chapter), rootMargin: '-30% 0px -60% 0px', threshold: 0 }
		);
		chapter.querySelectorAll('section[data-section]').forEach((node) => observer.observe(node));
		return () => observer.disconnect();
	}, [kinds]);

	const go = (kind: LandingSectionKind) => {
		setCurrent(kind);
		const target = ref.current?.parentElement?.querySelector<HTMLElement>(`section[data-section="${kind}"]`);
		const scroller = target && scrollParent(target);
		if (!target || !scroller) return target?.scrollIntoView();
		const bar = ref.current?.offsetHeight ?? 0;
		const top = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
		scroller.scrollTo({ top: top - bar, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
	};

	return (
		<nav ref={ref} className="pd-subnav" aria-label="사양 차례">
			<span className="pd-subnav-name">{name}</span>
			<ul>
				{sections.map((section) => (
					<li key={section.kind}>
						<button
							type="button"
							aria-current={current === section.kind ? 'location' : undefined}
							onClick={() => go(section.kind)}
						>
							{section.label}
						</button>
					</li>
				))}
			</ul>
		</nav>
	);
};

const ProductPage: React.FC<{ project: Project }> = ({ project }) => {
	const landing = useLanding(project);
	const root = useReveal<HTMLDivElement>();
	useStageHeight(root);
	const accent = productAccent(useLandingAccent(project.icon));
	const { hero, closing } = landing;
	const meta = [hero.meta.context, hero.meta.role, hero.meta.period].filter(Boolean);
	const features = landing.sections.find((section) => section.kind === 'features');
	const firstPoint = features?.kind === 'features' ? features.items[0] : undefined;
	const story = landing.sections.filter((section) => STORY_KINDS.includes(section.kind));
	const specs = landing.sections.filter((section) => !STORY_KINDS.includes(section.kind));
	const visual = hero.image ? 'shot' : hero.icon || firstPoint ? 'art' : 'plain';

	return (
		<div ref={root} className="tpl tpl-product" style={accent} data-hero={visual}>
			<header className="pd-hero">
				<HeroVisual hero={hero} first={firstPoint} />
				<div className="pd-hero-copy">
					<div className="pd-hero-title">
						<p className="pd-brand">
							{hero.icon && hero.image && <img className="pd-icon" src={hero.icon} alt="" />}
							{hero.logo ? <img className="pd-logo" src={hero.logo} alt={hero.name} /> : <span>{hero.name}</span>}
						</p>
						<h1>{hero.headline}</h1>
					</div>
					<div className="pd-hero-side">
						{hero.subhead && <p className="pd-subhead">{hero.subhead}</p>}
						<LandingLinks links={hero.links} className="pd-links" />
						{meta.length > 0 && (
							<ul className="pd-meta" aria-label="프로젝트 정보">
								{meta.map((item) => (
									<li key={item}>{item}</li>
								))}
							</ul>
						)}
					</div>
				</div>
			</header>

			{story.length > 0 && (
				<LandingSections landing={{ ...landing, sections: story }} renderers={RENDERERS} className="pd-chapter" />
			)}

			{specs.length > 0 && (
				<div className="pd-specs">
					<header className="pd-specs-head" data-reveal="">
						<p className="pd-eyebrow">사양</p>
						<h2>자세한 내용을 모두 담았습니다.</h2>
					</header>
					<SpecNav sections={specs} name={hero.name} />
					<LandingSections landing={{ ...landing, sections: specs }} renderers={RENDERERS} className="pd-spec" />
				</div>
			)}

			<footer className="pd-closing">
				<div data-reveal="">
					{hero.icon && <img className="pd-closing-icon" src={hero.icon} alt="" />}
					<h2>{closing.title}</h2>
					{closing.lead && <p className="pd-closing-lead">{closing.lead}</p>}
					<LandingLinks links={closing.links} className="pd-links" />
				</div>
			</footer>
		</div>
	);
};

export default ProductPage;
