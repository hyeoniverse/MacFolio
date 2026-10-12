// product 템플릿: Apple 제품 페이지처럼. 흰(다크는 검정) 바탕, 가운데 정렬의 큰 문장, 큰 제품 화면, 넉넉한 여백, 큰 숫자.
// 기능은 한 줄에 하나씩 글과 큰 그림이 좌우로 번갈아 놓이고, 글은 그림 옆에 붙어 따라온다(sticky). 계약은 templates/README.md
import React from 'react';
import type { Project } from '@/shared/profile';
import { useReveal } from '@/apps/safari/project/reveal';
import {
	LandingLinks,
	LandingSections,
	Media,
	PointVisual,
	sectionTitle,
	useLanding,
	useLandingAccent,
	type LandingPoint,
	type LandingSection,
	type SectionRenderers,
} from '@/apps/safari/project/landing';
import './Page.css';

/** 구역 머리: 작은 강조색 이름과 큰 문장 */
const Head: React.FC<{ section: LandingSection; title?: string }> = ({ section, title }) => (
	<header className="pd-head" data-reveal="">
		<p className="pd-eyebrow">{section.label}</p>
		<h2>{title ?? sectionTitle(section)}</h2>
	</header>
);

/** 항목의 그림 여러 장 가운데 대표 다음 것들 (작은 줄) */
const MoreMedia: React.FC<{ point: LandingPoint }> = ({ point }) =>
	point.media.length > 1 ? (
		<ul className="pd-more" aria-label={`${point.title} 화면 더 보기`}>
			{point.media.slice(1).map((media) => (
				<li key={media.src}>
					<Media media={media} />
				</li>
			))}
		</ul>
	) : null;

const RENDERERS: SectionRenderers = {
	stats: ({ section }) => (
		<>
			<h2 className="visually-hidden">{section.label}</h2>
			<ul className="pd-stats">
				{section.facts.map((fact) => (
					<li key={fact.label} data-reveal="">
						<strong>{fact.value}</strong>
						<span>{fact.label}</span>
					</li>
				))}
			</ul>
		</>
	),
	features: ({ section }) => (
		<>
			<Head section={section} />
			<ol className="pd-features">
				{section.items.map((point, index) => (
					<li key={point.title} className="pd-feature" data-flip={index % 2 ? '' : undefined}>
						<div className="pd-feature-text" data-reveal="">
							<h3>{point.title}</h3>
							<p>{point.body}</p>
							{point.detail && <p className="pd-detail">{point.detail}</p>}
						</div>
						<div className="pd-feature-visual" data-reveal="zoom">
							<PointVisual point={point} index={index} className="pd-visual" />
							<MoreMedia point={point} />
						</div>
					</li>
				))}
			</ol>
		</>
	),
	screens: ({ section }) => (
		<>
			<Head section={section} />
			<ul className="pd-screens">
				{section.shots.map((shot) => (
					<li key={shot.src}>
						<figure>
							<Media media={shot} />
							<figcaption>{shot.caption}</figcaption>
						</figure>
					</li>
				))}
			</ul>
		</>
	),
	steps: ({ section }) => (
		<>
			<Head section={section} />
			<ol className="pd-steps">
				{section.items.map((point, index) => (
					<li key={point.title} data-reveal="">
						<span className="pd-step-num" aria-hidden="true">
							{index + 1}
						</span>
						<h3>{point.title}</h3>
						<p>{point.body}</p>
						{point.detail && <p className="pd-detail">{point.detail}</p>}
						{point.media[0] && <Media media={point.media[0]} className="pd-step-media" />}
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
					<li key={point.title} data-reveal="">
						<span className="pd-built-num" aria-hidden="true">
							{String(index + 1).padStart(2, '0')}
						</span>
						<div>
							<h3>{point.title}</h3>
							<p>{point.body}</p>
							{point.detail && <p className="pd-detail">{point.detail}</p>}
						</div>
						{point.media.length > 0 && (
							<div className="pd-built-media">
								{point.media.map((media) => (
									<Media key={media.src} media={media} />
								))}
							</div>
						)}
					</li>
				))}
			</ol>
		</>
	),
	stories: ({ section }) => (
		<div className="pd-stories">
			{section.stories.map((story) => (
				<article key={story.title} className="pd-story" aria-label={story.title}>
					<header className="pd-head" data-reveal="">
						<p className="pd-eyebrow">{section.label}</p>
						<h2>{story.title}</h2>
						{story.lead && <p className="pd-lead">{story.lead}</p>}
					</header>
					{story.facts.length > 0 && (
						<ul className="pd-stats pd-stats-small">
							{story.facts.map((fact) => (
								<li key={fact.label} data-reveal="">
									<strong>{fact.value}</strong>
									<span>{fact.label}</span>
								</li>
							))}
						</ul>
					)}
					{story.points.length > 0 && (
						<ul className="pd-story-points">
							{story.points.map((point) => (
								<li key={point.title} data-reveal="">
									<h3>{point.title}</h3>
									<p>{point.body}</p>
									{point.detail && <p className="pd-detail">{point.detail}</p>}
									{point.media.map((media) => (
										<Media key={media.src} media={media} className="pd-story-point-media" />
									))}
								</li>
							))}
						</ul>
					)}
					{story.image && (
						<figure className="pd-story-image" data-reveal="zoom">
							<Media media={story.image} />
						</figure>
					)}
				</article>
			))}
		</div>
	),
	controls: ({ section }) => (
		<>
			<Head section={section} />
			<dl className="pd-controls">
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
			<ol className="pd-timeline">
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
			{section.stack.length > 0 && (
				<ul className="pd-stack" aria-label="쓴 기술">
					{section.stack.map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
			)}
			{section.specs.length > 0 && (
				<dl className="pd-specs">
					{section.specs.map((spec) => (
						<div key={spec.label}>
							<dt>{spec.label}</dt>
							<dd>{spec.value}</dd>
						</div>
					))}
				</dl>
			)}
			{section.structure && (
				<figure className="pd-structure">
					<figcaption>폴더 구조</figcaption>
					<pre>{section.structure}</pre>
				</figure>
			)}
		</>
	),
	role: ({ section }) => (
		<>
			<Head section={section} />
			{(section.context || section.role || section.period) && (
				<dl className="pd-role-meta">
					{section.context && (
						<div>
							<dt>프로젝트</dt>
							<dd>{section.context}</dd>
						</div>
					)}
					{section.role && (
						<div>
							<dt>역할</dt>
							<dd>{section.role}</dd>
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
						<li key={item}>{item}</li>
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
						<span>
							{credit.href ? (
								<a href={credit.href} target="_blank" rel="noopener noreferrer">
									{credit.name}
								</a>
							) : (
								credit.name
							)}
							<span className="pd-credit-by"> · {credit.by}</span>
						</span>
						{credit.note && <span className="pd-credit-note">{credit.note}</span>}
					</li>
				))}
			</ul>
		</>
	),
};

const ProductPage: React.FC<{ project: Project }> = ({ project }) => {
	const landing = useLanding(project);
	const root = useReveal<HTMLDivElement>();
	const accent = useLandingAccent(project.icon);
	const { hero, closing } = landing;
	const meta = [hero.meta.context, hero.meta.role, hero.meta.period].filter(Boolean);

	return (
		<div ref={root} className="tpl tpl-product" style={accent}>
			<header className="pd-hero">
				<div className="pd-hero-text">
					<p className="pd-brand">
						{hero.icon && <img className="pd-icon" src={hero.icon} alt="" />}
						{hero.logo ? <img className="pd-logo" src={hero.logo} alt={hero.name} /> : <span>{hero.name}</span>}
					</p>
					<h1>{hero.headline}</h1>
					{hero.subhead && <p className="pd-subhead">{hero.subhead}</p>}
					<LandingLinks links={hero.links} className="pd-links" />
					{meta.length > 0 && <p className="pd-meta">{meta.join(' · ')}</p>}
				</div>
				{hero.image && (
					<figure className="pd-hero-shot" data-reveal="zoom">
						<Media media={hero.image} eager />
					</figure>
				)}
			</header>

			<LandingSections landing={landing} renderers={RENDERERS} className="pd-section" />

			<footer className="pd-closing" data-reveal="">
				{hero.icon && <img className="pd-icon pd-icon-large" src={hero.icon} alt="" />}
				<h2>{closing.title}</h2>
				{closing.lead && <p className="pd-subhead">{closing.lead}</p>}
				<LandingLinks links={closing.links} className="pd-links" />
			</footer>
		</div>
	);
};

export default ProductPage;
