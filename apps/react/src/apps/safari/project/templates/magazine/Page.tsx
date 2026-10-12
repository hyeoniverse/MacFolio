// magazine 템플릿: 잡지의 사례 연구 기사처럼(NYT 특집, Stripe Press). 따뜻한 종이와 검은 잉크, 붉은 잉크 하나, 명조 제목과 고딕 본문.
// 제호와 겹줄, 작은 머리말, 아주 큰 명조 제목과 리드 문장, 바이라인, 판 위의 큰 사진과 설명으로 열고, 구역은 기사의 꼭지로 읽힌다:
// 번호 붙은 기능 꼭지(사진은 넓게와 안쪽을 번갈아, 그림이 없으면 큰 숫자와 인용구), 숫자 상자, 번호 붙은 곁글, 두 단 본문, 연표, 각주와 미주.
// 계약은 templates/README.md
import React from 'react';
import type { Project, ProjectFact } from '@/shared/profile';
import { useReveal } from '@/apps/safari/project/reveal';
import {
	iconOf,
	LandingLinks,
	LandingSections,
	Media,
	sectionTitle,
	useLanding,
	useLandingAccent,
	type LandingMedia,
	type LandingPoint,
	type LandingSection,
	type SectionRenderers,
} from '@/apps/safari/project/landing';
import { magazineAccent } from './accent';
import './Page.css';

const pad = (n: number) => String(n).padStart(2, '0');

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const roman = (n: number) => ROMAN[n - 1] ?? String(n);

/** 꼭지 머리: 붉은 짧은 줄과 구역 이름(머리말), 명조 h2 */
const Head: React.FC<{ section: LandingSection; title?: string }> = ({ section, title }) => (
	<header className="mg-head" data-reveal="ink">
		<p className="mg-rubric">{section.label}</p>
		<h2>{title ?? sectionTitle(section)}</h2>
	</header>
);

/** 사진 한 장: 옅은 판 위의 그림과 번호 붙은 설명 (번호는 CSS 카운터) */
const Figure: React.FC<{ media: LandingMedia; caption?: string; size?: 'bleed' | 'wide' | 'inset' | 'small' }> = ({
	media,
	caption,
	size = 'wide',
}) => (
	<figure className="mg-figure" data-size={size} data-reveal="">
		<div className="mg-plate">
			<Media media={media} />
		</div>
		{caption && <figcaption>{caption}</figcaption>}
	</figure>
);

/** 큰 숫자 묶음 (숫자 상자, 이야기의 숫자) */
const Numbers: React.FC<{ facts: ProjectFact[]; className?: string }> = ({ facts, className }) => (
	<dl className={['mg-numbers', className].filter(Boolean).join(' ')} data-count={Math.min(facts.length, 4)}>
		{facts.map((fact) => (
			<div key={`${fact.value}-${fact.label}`}>
				<dt>{fact.label}</dt>
				<dd>{fact.value}</dd>
			</div>
		))}
	</dl>
);

/** 항목의 나머지 그림 (첫 장 뒤의 것) */
const MoreFigures: React.FC<{ media: LandingMedia[] }> = ({ media }) =>
	media.length > 0 ? (
		<div className="mg-figs" data-count={Math.min(media.length, 3)}>
			{media.map((item) => (
				<Figure key={item.src} media={item} caption={item.alt} size="small" />
			))}
		</div>
	) : null;

/**
 * 기능 꼭지 하나: 큰 번호와 아이콘, h3, 리드 문장, 이어 읽는 글. 그림이 있으면 넓게(짝수)와 글 옆 안쪽(홀수)을 번갈아,
 * 없으면 리드 문장을 큰 인용구로 세운다. 첫 꼭지의 첫 문단은 머리글자를 크게 내린다
 */
const Feature: React.FC<{ point: LandingPoint; index: number; mediaIndex: number }> = ({
	point,
	index,
	mediaIndex,
}) => {
	const [lead, ...rest] = point.media;
	const layout = !lead ? 'quote' : mediaIndex % 2 === 0 ? 'wide' : 'inset';
	return (
		<li className="mg-feature" data-layout={layout}>
			<span className="mg-feature-big" aria-hidden="true">
				{pad(index + 1)}
				<i className={`fa-solid ${iconOf(point, index)}`} />
			</span>
			<div className="mg-feature-text" data-reveal="ink">
				{point.group && <p className="mg-feature-group">{point.group}</p>}
				<h3>{point.title}</h3>
				{layout === 'quote' ? (
					<blockquote className="mg-pull">
						<p>{point.body}</p>
					</blockquote>
				) : (
					<p className="mg-standfirst" data-dropcap={index === 0 ? '' : undefined}>
						{point.body}
					</p>
				)}
				{point.detail && (
					<p className="mg-prose" data-dropcap={index === 0 && layout === 'quote' ? '' : undefined}>
						{point.detail}
					</p>
				)}
			</div>
			{lead && <Figure media={lead} caption={lead.alt} size={layout === 'wide' ? 'bleed' : 'inset'} />}
			<MoreFigures media={rest} />
		</li>
	);
};

/** 머리 제목이 붙은 짧은 글 한 덩어리 (두 단 본문, 이야기의 항목) */
const RunIn: React.FC<{ point: LandingPoint; icon?: string }> = ({ point, icon }) => (
	<div className="mg-runin">
		<h3>
			{icon && <i className={`fa-solid ${icon}`} aria-hidden="true" />}
			{point.title}
		</h3>
		<p>{point.body}</p>
		{point.detail && <p className="mg-runin-more">{point.detail}</p>}
		{point.media.map((item) => (
			<Figure key={item.src} media={item} caption={item.alt} size="small" />
		))}
	</div>
);

const RENDERERS: SectionRenderers = {
	stats: ({ section }) => (
		<div className="mg-box mg-stats" data-reveal="">
			<h2 className="mg-box-title">{section.label}</h2>
			<Numbers facts={section.facts} />
		</div>
	),
	features: ({ section }) => {
		let seen = 0;
		return (
			<>
				<Head section={section} />
				<ol className="mg-features">
					{section.items.map((point, index) => {
						const mediaIndex = point.media.length ? seen++ : -1;
						return <Feature key={point.title} point={point} index={index} mediaIndex={mediaIndex} />;
					})}
				</ol>
			</>
		);
	},
	screens: ({ section }) => (
		<>
			<Head section={section} />
			<div className="mg-portfolio" data-count={Math.min(section.shots.length, 4)}>
				{section.shots.map((shot, index) => (
					<Figure key={shot.src} media={shot} caption={shot.caption} size={index === 0 ? 'wide' : 'small'} />
				))}
			</div>
		</>
	),
	steps: ({ section }) => (
		<div className="mg-box mg-steps-box">
			<Head section={section} />
			<ol className="mg-steps" data-count={Math.min(section.items.length, 4)}>
				{section.items.map((point, index) => (
					<li key={point.title} data-reveal="">
						<span className="mg-step-no" aria-hidden="true">
							{index + 1}
						</span>
						<h3>
							{point.icon && <i className={`fa-solid ${point.icon}`} aria-hidden="true" />}
							{point.title}
						</h3>
						<p>{point.body}</p>
						{point.detail && <p className="mg-step-more">{point.detail}</p>}
						{point.media.map((item) => (
							<Figure key={item.src} media={item} caption={item.alt} size="small" />
						))}
					</li>
				))}
			</ol>
		</div>
	),
	built: ({ section }) => (
		<>
			<Head section={section} />
			<div className="mg-columns">
				{section.items.map((point, index) => (
					<RunIn key={point.title} point={point} icon={iconOf(point, index + 2)} />
				))}
			</div>
		</>
	),
	stories: ({ section }) => (
		<>
			<Head section={section} />
			<div className="mg-stories">
				{section.stories.map((story, index) => (
					<article key={story.title} className="mg-story" aria-label={story.title} data-reveal="">
						<div className="mg-story-side">
							<span className="mg-story-no" aria-hidden="true">
								{roman(index + 1)}
							</span>
							{story.facts.length > 0 && <Numbers facts={story.facts} className="mg-numbers-side" />}
						</div>
						<div className="mg-story-main">
							<h3>{story.title}</h3>
							{story.lead && <p className="mg-story-lead">{story.lead}</p>}
							{story.points.length > 0 && (
								<div className="mg-story-points">
									{story.points.map((point) => (
										<RunIn key={point.title} point={point} />
									))}
								</div>
							)}
							{story.image && <Figure media={story.image} caption={story.image.alt} size="inset" />}
						</div>
					</article>
				))}
			</div>
		</>
	),
	controls: ({ section }) => (
		<>
			<Head section={section} />
			<dl className="mg-keys">
				{section.controls.map((control) => (
					<div key={control.label}>
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
			<ol className="mg-chrono">
				{section.entries.map((entry) => (
					<li key={`${entry.date}-${entry.label}`}>
						<time>{entry.date}</time>
						<span>{entry.label}</span>
					</li>
				))}
			</ol>
		</>
	),
	tech: ({ section }) => (
		<>
			<Head section={section} />
			<div className="mg-tech">
				{section.stack.length > 0 && (
					<p className="mg-stack">
						{section.stack.map((item, index) => (
							<React.Fragment key={item}>
								{index > 0 && (
									<span className="mg-dot" aria-hidden="true">
										{' · '}
									</span>
								)}
								<span>{item}</span>
							</React.Fragment>
						))}
					</p>
				)}
				{section.specs.length > 0 && (
					<ol className="mg-specs">
						{section.specs.map((spec, index) => (
							<li key={spec.label}>
								<sup aria-hidden="true">{index + 1}</sup>
								<span className="mg-spec-label">{spec.label}</span>
								<span className="mg-spec-value">{spec.value}</span>
							</li>
						))}
					</ol>
				)}
				{section.structure && (
					<figure className="mg-tree">
						<figcaption>폴더 구조</figcaption>
						<pre>{section.structure}</pre>
					</figure>
				)}
			</div>
		</>
	),
	role: ({ section }) => (
		<>
			<Head section={section} title={section.role} />
			<div className="mg-role">
				{(section.context || section.period) && (
					<p className="mg-role-meta">{[section.context, section.period].filter(Boolean).join(' · ')}</p>
				)}
				{section.contributions.length > 0 && (
					<ul className="mg-role-list">
						{section.contributions.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				)}
			</div>
		</>
	),
	credits: ({ section }) => (
		<>
			<h2 className="mg-notes-title">{section.label}</h2>
			<ol className="mg-notes">
				{section.credits.map((credit) => (
					<li key={`${credit.role}-${credit.name}`}>
						<span className="mg-note-role">{credit.role}</span>{' '}
						{credit.href ? (
							<a href={credit.href} target="_blank" rel="noopener noreferrer">
								{credit.name}
							</a>
						) : (
							<cite>{credit.name}</cite>
						)}
						, {credit.by}.{credit.note && <span className="mg-note-extra"> {credit.note}.</span>}
					</li>
				))}
			</ol>
		</>
	),
};

const MagazinePage: React.FC<{ project: Project }> = ({ project }) => {
	const landing = useLanding(project);
	const root = useReveal<HTMLDivElement>();
	const accent = magazineAccent(useLandingAccent(project.icon));
	const { hero, closing } = landing;
	const kicker = [hero.meta.context, hero.meta.period].filter(Boolean).join(' · ');
	const showName = hero.logo || hero.headline !== hero.name;

	return (
		<div ref={root} className="tpl tpl-magazine" style={accent} data-image={hero.image ? '' : undefined}>
			<header className="mg-hero">
				<div className="mg-masthead">
					{hero.icon && <img className="mg-mast-icon" src={hero.icon} alt="" />}
					{showName ? (
						hero.logo ? (
							<img className="mg-logo" src={hero.logo} alt={hero.name} />
						) : (
							<p className="mg-mast-name">{hero.name}</p>
						)
					) : (
						<p className="mg-mast-name">사례 연구</p>
					)}
				</div>
				<div className="mg-hero-text">
					{kicker && <p className="mg-kicker">{kicker}</p>}
					<h1>{hero.headline}</h1>
					{hero.subhead && <p className="mg-dek">{hero.subhead}</p>}
					{hero.meta.role && (
						<p className="mg-byline">
							<span className="mg-byline-label">맡은 일</span>
							{hero.meta.role}
						</p>
					)}
					<LandingLinks links={hero.links} className="mg-links" />
				</div>
				{hero.image ? (
					<figure className="mg-lead">
						<div className="mg-plate">
							<Media media={hero.image} eager />
						</div>
						<figcaption>{hero.image.alt}</figcaption>
					</figure>
				) : (
					<p className="mg-ornament" aria-hidden="true">
						<span>⁂</span>
					</p>
				)}
			</header>

			<div className="mg-body">
				<LandingSections landing={landing} renderers={RENDERERS} className="mg-section" />
			</div>

			<footer className="mg-closing">
				<span className="mg-end" aria-hidden="true">
					■
				</span>
				<h2>{closing.title}</h2>
				{closing.lead && <p className="mg-closing-lead">{closing.lead}</p>}
				<LandingLinks links={closing.links} className="mg-links" />
			</footer>
		</div>
	);
};

export default MagazinePage;
