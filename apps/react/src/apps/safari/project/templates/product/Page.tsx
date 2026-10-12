// product 템플릿: Apple 제품 페이지처럼. 흰(다크는 검정) 바탕, 가운데 정렬의 아주 큰 제목과 짧은 한 줄, 알약 단추 둘,
// 창 테두리에 담긴 큰 제품 화면. 기능은 옅은 회색 타일(그림이 타일 가장자리까지)로, 숫자는 크게, 화면 모음은 옆으로 넘기는 띠로,
// 기술 사양은 가는 선의 두 칸 표로 그린다. 그림이 없으면 강조색 아이콘 타일과 큰 글자로 채운다. 계약은 templates/README.md
import React from 'react';
import type { Project } from '@/shared/profile';
import { useReveal } from '@/apps/safari/project/reveal';
import {
	LandingLinks,
	LandingSections,
	Media,
	iconOf,
	sectionTitle,
	useLanding,
	useLandingAccent,
	type LandingHero,
	type LandingPoint,
	type LandingSection,
	type SectionRenderers,
} from '@/apps/safari/project/landing';
import { Gallery } from './Gallery';
import { productAccent } from './accent';
import './Page.css';

/** 나타나는 차례 (0부터): 목록 안에서 조금씩 늦게 */
const delay = (index: number) => ({ '--d': Math.min(index, 4) }) as React.CSSProperties;

/** 구역 머리: 가운데 큰 문장과 한 줄 설명. 구역 이름은 작은 글자로 위에 */
const Head: React.FC<{ section: LandingSection; title?: string; lead?: string }> = ({ section, title, lead }) => (
	<header className="pd-head" data-reveal="">
		<p className="pd-eyebrow">{section.label}</p>
		<h2>{title ?? sectionTitle(section)}</h2>
		{lead && <p className="pd-lead">{lead}</p>}
	</header>
);

/** "1,800명", "92%", "4주"를 앞말·숫자·뒷말로 (숫자는 크게, 단위는 작게) */
const splitValue = (text: string) => {
	const match = /^(\D*?)([\d.,]+)(\D*)$/.exec(text.trim());
	return match ? { before: match[1], value: match[2], after: match[3] } : null;
};

const Figure: React.FC<{ value: string }> = ({ value }) => {
	const parts = splitValue(value);
	if (!parts) return <strong className="pd-figure">{value}</strong>;
	return (
		<strong className="pd-figure">
			{parts.before && <span className="pd-unit">{parts.before}</span>}
			{parts.value}
			{parts.after && <span className="pd-unit">{parts.after}</span>}
		</strong>
	);
};

const Stats: React.FC<{ facts: { value: string; label: string }[]; small?: boolean }> = ({ facts, small }) => (
	<ul className="pd-stats" data-small={small ? '' : undefined} data-count={Math.min(facts.length, 4)}>
		{facts.map((fact, index) => (
			<li key={fact.label} data-reveal="" style={delay(index)}>
				<Figure value={fact.value} />
				<span className="pd-figure-label">{fact.label}</span>
			</li>
		))}
	</ul>
);

/** 강조색 아이콘 (장식) */
const Glyph: React.FC<{ point: LandingPoint; index: number; className?: string }> = ({ point, index, className }) => (
	<span className={['pd-glyph', className].filter(Boolean).join(' ')} aria-hidden="true">
		<i className={`fa-solid ${iconOf(point, index)}`} />
	</span>
);

/** 항목의 글: 제목, 설명, 이어 읽는 설명 */
const PointText: React.FC<{ point: LandingPoint }> = ({ point }) => (
	<>
		{point.group && <p className="pd-group">{point.group}</p>}
		<h3>{point.title}</h3>
		<p className="pd-body">{point.body}</p>
		{point.detail && <p className="pd-detail">{point.detail}</p>}
	</>
);

/** 그림이 있는 기능: 타일 가득 넓게, 글과 그림이 좌우로 번갈아 놓이고 그림은 타일 가장자리까지 닿는다 */
const WideTile: React.FC<{ point: LandingPoint; index: number; flip: boolean }> = ({ point, index, flip }) => {
	const [first, ...more] = point.media;
	return (
		<li className="pd-tile pd-tile-wide" data-flip={flip ? '' : undefined} data-art={first ? undefined : ''}>
			<div className="pd-tile-text" data-reveal="">
				{first && <Glyph point={point} index={index} className="pd-tile-glyph" />}
				<PointText point={point} />
				{more.length > 0 && (
					<ul className="pd-thumbs" aria-label={`${point.title} 화면 더 보기`}>
						{more.map((media) => (
							<li key={media.src}>
								<Media media={media} />
							</li>
						))}
					</ul>
				)}
			</div>
			<div className="pd-tile-visual">
				{first ? (
					<Media media={first} className="pd-bleed" />
				) : (
					<span className="pd-art" aria-hidden="true">
						<i className={`fa-solid ${iconOf(point, index)}`} />
					</span>
				)}
			</div>
		</li>
	);
};

/** 그림이 없는 기능: 큰 강조색 아이콘을 얹은 타일 (두세 개씩 한 줄) */
const IconTile: React.FC<{ point: LandingPoint; index: number; order: number }> = ({ point, index, order }) => (
	<li className="pd-tile pd-tile-icon" data-reveal="" style={delay(order)}>
		<Glyph point={point} index={index} />
		<div>
			<PointText point={point} />
		</div>
	</li>
);

type Run =
	| { kind: 'wide'; point: LandingPoint; index: number }
	| { kind: 'grid'; items: { point: LandingPoint; index: number }[] };

/**
 * 기능을 줄로 나눈다: 그림이 있는 것은 넓은 타일 하나씩, 그림이 없는 것이 이어지면 아이콘 타일 격자로.
 * 격자 칸이 홀수로 남으면(3의 배수가 아니면) 첫 하나를 넓은 아이콘 타일로 꺼내 줄이 비지 않게 한다
 */
function runsOf(items: LandingPoint[]): Run[] {
	const runs: Run[] = [];
	let plain: { point: LandingPoint; index: number }[] = [];
	const flush = () => {
		if (plain.length === 0) return;
		const n = plain.length;
		if (n === 1 || (n % 2 === 1 && n % 3 !== 0)) {
			const [head, ...rest] = plain;
			runs.push({ kind: 'wide', ...head });
			if (rest.length) runs.push({ kind: 'grid', items: rest });
		} else runs.push({ kind: 'grid', items: plain });
		plain = [];
	};
	items.forEach((point, index) => {
		if (point.media.length) {
			flush();
			runs.push({ kind: 'wide', point, index });
		} else plain.push({ point, index });
	});
	flush();
	return runs;
}

const Features: React.FC<{ items: LandingPoint[] }> = ({ items }) => {
	let wide = 0;
	return (
		<div className="pd-features">
			{runsOf(items).map((run) =>
				run.kind === 'wide' ? (
					<ul key={run.point.title} className="pd-tiles">
						<WideTile point={run.point} index={run.index} flip={wide++ % 2 === 1} />
					</ul>
				) : (
					<ul
						key={run.items[0].point.title}
						className="pd-tiles pd-tiles-grid"
						data-cols={run.items.length % 3 === 0 ? 3 : 2}
					>
						{run.items.map(({ point, index }, order) => (
							<IconTile key={point.title} point={point} index={index} order={order} />
						))}
					</ul>
				)
			)}
		</div>
	);
};

/** 단계·만든 방식의 그림들 (가는 테두리의 둥근 화면) */
const PointMedia: React.FC<{ point: LandingPoint }> = ({ point }) =>
	point.media.length > 0 ? (
		<div className="pd-point-media">
			{point.media.map((media) => (
				<Media key={media.src} media={media} className="pd-framed" />
			))}
		</div>
	) : null;

const RENDERERS: SectionRenderers = {
	stats: ({ section }) => (
		<>
			<h2 className="visually-hidden">{section.label}</h2>
			<Stats facts={section.facts} />
		</>
	),
	features: ({ section }) => (
		<>
			<Head section={section} />
			<Features items={section.items} />
		</>
	),
	screens: ({ section }) => (
		<>
			<Head section={section} />
			<Gallery shots={section.shots} />
		</>
	),
	steps: ({ section }) => (
		<>
			<Head section={section} />
			<ol className="pd-steps" data-count={Math.min(section.items.length, 4)}>
				{section.items.map((point, index) => (
					<li key={point.title} data-reveal="" style={delay(index)}>
						<Glyph point={point} index={index} />
						<p className="pd-step-num">{index + 1}단계</p>
						<PointText point={point} />
						<PointMedia point={point} />
					</li>
				))}
			</ol>
		</>
	),
	built: ({ section }) => (
		<>
			<Head section={section} />
			<ol className="pd-built">
				{section.items.map((point, index) => (
					<li key={point.title} data-reveal="" style={delay(index % 2)}>
						<Glyph point={point} index={index} />
						<div>
							<PointText point={point} />
							<PointMedia point={point} />
						</div>
					</li>
				))}
			</ol>
		</>
	),
	stories: ({ section }) => (
		<div className="pd-stories">
			{section.stories.map((story, number) => (
				<article key={story.title} className="pd-story" aria-label={story.title}>
					<header className="pd-head" data-reveal="">
						<p className="pd-eyebrow">
							{section.label} {String(number + 1).padStart(2, '0')}
						</p>
						<h2>{story.title}</h2>
						{story.lead && <p className="pd-lead">{story.lead}</p>}
					</header>
					{story.facts.length > 0 && <Stats facts={story.facts} small />}
					{story.points.length > 0 && (
						<ul className="pd-story-points">
							{story.points.map((point, index) => (
								<li key={point.title} data-reveal="" style={delay(index)}>
									<PointText point={point} />
									<PointMedia point={point} />
								</li>
							))}
						</ul>
					)}
					{story.image && (
						<figure className="pd-story-image" data-reveal="">
							<Media media={story.image} className="pd-framed" />
						</figure>
					)}
				</article>
			))}
		</div>
	),
	controls: ({ section }) => (
		<>
			<Head section={section} />
			<dl className="pd-controls" data-count={Math.min(section.controls.length, 4)}>
				{section.controls.map((control, index) => (
					<div key={control.label} data-reveal="" style={delay(index)}>
						<dt>
							{control.keys.map((key) => (
								<kbd key={key}>{key}</kbd>
							))}
						</dt>
						<dd>{control.label}</dd>
					</div>
				))}
			</dl>
		</>
	),
	timeline: ({ section }) => (
		<>
			<Head section={section} />
			<ol className="pd-timeline">
				{section.entries.map((entry, index) => (
					<li key={`${entry.date}-${entry.label}`}>
						<span className="pd-timeline-step" aria-hidden="true">
							{String(index + 1).padStart(2, '0')}
						</span>
						<time>{entry.date}</time>
						<span className="pd-timeline-label">{entry.label}</span>
					</li>
				))}
			</ol>
		</>
	),
	tech: ({ section }) => (
		<>
			<header className="pd-specs-head" data-reveal="">
				<h2>{section.label}</h2>
				<p>{sectionTitle(section)}</p>
			</header>
			<dl className="pd-specs">
				{section.stack.length > 0 && (
					<div>
						<dt>쓴 기술</dt>
						<dd>
							<ul className="pd-stack" aria-label="쓴 기술">
								{section.stack.map((item) => (
									<li key={item}>{item}</li>
								))}
							</ul>
						</dd>
					</div>
				)}
				{section.specs.map((spec) => (
					<div key={spec.label}>
						<dt>{spec.label}</dt>
						<dd>{spec.value}</dd>
					</div>
				))}
				{section.structure && (
					<div>
						<dt>폴더 구조</dt>
						<dd>
							<pre className="pd-structure">{section.structure}</pre>
						</dd>
					</div>
				)}
			</dl>
		</>
	),
	role: ({ section }) => (
		<>
			<Head section={section} />
			{(section.context || section.role || section.period) && (
				<dl className="pd-role-meta">
					{section.role && (
						<div>
							<dt>역할</dt>
							<dd>{section.role}</dd>
						</div>
					)}
					{section.context && (
						<div>
							<dt>프로젝트</dt>
							<dd>{section.context}</dd>
						</div>
					)}
					{section.period && (
						<div>
							<dt>기간</dt>
							<dd>{section.period}</dd>
						</div>
					)}
				</dl>
			)}
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
		</>
	),
	credits: ({ section }) => (
		<>
			<Head section={section} />
			<ul className="pd-credits">
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
						</span>
						{credit.note && <span className="pd-credit-note">{credit.note}</span>}
					</li>
				))}
			</ul>
		</>
	),
};

/** 창 머리의 주소: 데모 주소가 있으면 그 호스트, 없으면 이름 */
const addressOf = (hero: LandingHero) => {
	const demo = hero.links.find((link) => link.kind === 'demo');
	if (demo && demo.kind === 'demo') {
		try {
			return new URL(demo.href).host;
		} catch {
			// 주소가 아니면 이름으로
		}
	}
	return hero.name;
};

/** 첫 화면의 큰 화면: 얇은 창 테두리와 한 벌의 그림자 */
const HeroShot: React.FC<{ hero: LandingHero }> = ({ hero }) =>
	hero.image ? (
		<figure className="pd-window" data-reveal="">
			<div className="pd-window-bar" aria-hidden="true">
				<span className="pd-window-dots">
					<i />
					<i />
					<i />
				</span>
				<span className="pd-window-address">
					<i className="fa-solid fa-lock" />
					{addressOf(hero)}
				</span>
			</div>
			<Media media={hero.image} eager className="pd-window-screen" />
		</figure>
	) : null;

/** 그림이 없는 첫 화면: 앱 아이콘(없으면 첫 기능의 아이콘)을 가는 동심원 위에 크게 */
const HeroArt: React.FC<{ hero: LandingHero; first?: LandingPoint }> = ({ hero, first }) => {
	if (!hero.icon && !first) return null;
	return (
		<div className="pd-hero-art" data-reveal="" aria-hidden="true">
			<span className="pd-rings">
				<i />
				<i />
				<i />
			</span>
			{hero.icon ? (
				<img className="pd-hero-icon" src={hero.icon} alt="" />
			) : (
				first && (
					<span className="pd-hero-glyph">
						<i className={`fa-solid ${iconOf(first, 0)}`} />
					</span>
				)
			)}
		</div>
	);
};

const ProductPage: React.FC<{ project: Project }> = ({ project }) => {
	const landing = useLanding(project);
	const root = useReveal<HTMLDivElement>();
	const accent = productAccent(useLandingAccent(project.icon));
	const { hero, closing } = landing;
	const meta = [hero.meta.context, hero.meta.role, hero.meta.period].filter(Boolean);
	const features = landing.sections.find((section) => section.kind === 'features');
	const firstPoint = features?.kind === 'features' ? features.items[0] : undefined;

	return (
		<div ref={root} className="tpl tpl-product" style={accent} data-hero={hero.image ? 'shot' : 'art'}>
			<header className="pd-hero">
				<div className="pd-hero-text" data-reveal="">
					<p className="pd-brand">
						{hero.icon && hero.image && <img className="pd-icon" src={hero.icon} alt="" />}
						{hero.logo ? <img className="pd-logo" src={hero.logo} alt={hero.name} /> : <span>{hero.name}</span>}
					</p>
					<h1>{hero.headline}</h1>
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
				{hero.image ? <HeroShot hero={hero} /> : <HeroArt hero={hero} first={firstPoint} />}
			</header>

			<LandingSections landing={landing} renderers={RENDERERS} className="pd-section" />

			<footer className="pd-closing" data-reveal="">
				{hero.icon && <img className="pd-closing-icon" src={hero.icon} alt="" />}
				<h2>{closing.title}</h2>
				{closing.lead && <p className="pd-subhead">{closing.lead}</p>}
				<LandingLinks links={closing.links} className="pd-links" />
			</footer>
		</div>
	);
};

export default ProductPage;
