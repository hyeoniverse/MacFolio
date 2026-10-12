// bento 템플릿: Framer·Raycast 템플릿처럼. 화면과 숫자 타일을 크기가 다른 칸에 짜 넣고, 또렷한 1px 선과 고정폭 글자로
// 작은 정보를 단다. 다크 테마에서 가장 잘 어울리지만 사이트 테마를 따른다. 계약은 templates/README.md
import React from 'react';
import type { Project } from '@/shared/profile';
import { useReveal } from '@/apps/safari/project/reveal';
import {
	iconOf,
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

const Head: React.FC<{ section: LandingSection; title?: string }> = ({ section, title }) => (
	<header className="bt-head" data-reveal="">
		<p className="bt-label">{section.label}</p>
		<h2>{title ?? sectionTitle(section)}</h2>
	</header>
);

/** 타일 크기: 그림이 있는 첫 항목은 큰 칸, 그림이 있으면 넓은 칸, 없으면 작은 칸 */
const sizeOf = (point: LandingPoint, index: number) => (point.media.length ? (index === 0 ? 'lg' : 'wide') : 'sm');

const Tile: React.FC<{ point: LandingPoint; index: number; number?: boolean }> = ({ point, index, number }) => (
	<li className="bt-tile" data-size={sizeOf(point, index)} data-reveal="">
		<div className="bt-tile-text">
			<span className="bt-tile-mark" aria-hidden="true">
				{number ? String(index + 1).padStart(2, '0') : <i className={`fa-solid ${iconOf(point, index)}`} />}
			</span>
			<h3>{point.title}</h3>
			<p>{point.body}</p>
			{point.detail && <p className="bt-detail">{point.detail}</p>}
		</div>
		{point.media.length > 0 && (
			<div className="bt-tile-visual">
				<PointVisual point={point} index={index} className="bt-visual" />
				{point.media.length > 1 && (
					<ul className="bt-thumbs" aria-label={`${point.title} 화면 더 보기`}>
						{point.media.slice(1).map((media) => (
							<li key={media.src}>
								<Media media={media} />
							</li>
						))}
					</ul>
				)}
			</div>
		)}
	</li>
);

const RENDERERS: SectionRenderers = {
	stats: ({ section }) => (
		<>
			<h2 className="visually-hidden">{section.label}</h2>
			<ul className="bt-grid bt-stats">
				{section.facts.map((fact) => (
					<li key={fact.label} className="bt-tile" data-reveal="">
						<span className="bt-label">{fact.label}</span>
						<strong>{fact.value}</strong>
					</li>
				))}
			</ul>
		</>
	),
	features: ({ section }) => (
		<>
			<Head section={section} />
			<ul className="bt-grid">
				{section.items.map((point, index) => (
					<Tile key={point.title} point={point} index={index} />
				))}
			</ul>
		</>
	),
	screens: ({ section }) => (
		<>
			<Head section={section} />
			<ul className="bt-grid bt-screens">
				{section.shots.map((shot, index) => (
					<li key={shot.src} className="bt-tile bt-shot" data-size={index === 0 ? 'lg' : 'sm'} data-reveal="">
						<Media media={shot} />
						<span className="bt-caption">{shot.caption}</span>
					</li>
				))}
			</ul>
		</>
	),
	steps: ({ section }) => (
		<>
			<Head section={section} />
			<ol className="bt-grid bt-steps">
				{section.items.map((point, index) => (
					<Tile key={point.title} point={point} index={index} number />
				))}
			</ol>
		</>
	),
	built: ({ section }) => (
		<>
			<Head section={section} />
			<ul className="bt-grid">
				{section.items.map((point, index) => (
					<Tile key={point.title} point={point} index={index + 2} />
				))}
			</ul>
		</>
	),
	stories: ({ section }) => (
		<>
			<Head section={section} />
			<div className="bt-stories">
				{section.stories.map((story) => (
					<article key={story.title} className="bt-grid" aria-label={story.title}>
						<div className="bt-tile bt-story-lead" data-reveal="">
							<h3>{story.title}</h3>
							{story.lead && <p>{story.lead}</p>}
						</div>
						{story.facts.map((fact) => (
							<div key={fact.label} className="bt-tile bt-story-fact" data-reveal="">
								<span className="bt-label">{fact.label}</span>
								<strong>{fact.value}</strong>
							</div>
						))}
						{story.points.length > 0 && (
							<ul className="bt-tile bt-story-points" data-reveal="">
								{story.points.map((point) => (
									<li key={point.title}>
										<strong>{point.title}</strong>
										<p>{point.body}</p>
										{point.detail && <p className="bt-detail">{point.detail}</p>}
										{point.media.map((media) => (
											<Media key={media.src} media={media} className="bt-story-point-media" />
										))}
									</li>
								))}
							</ul>
						)}
						{story.image && (
							<figure className="bt-tile bt-story-image" data-reveal="">
								<Media media={story.image} />
							</figure>
						)}
					</article>
				))}
			</div>
		</>
	),
	controls: ({ section }) => (
		<>
			<Head section={section} />
			<dl className="bt-grid bt-controls">
				{section.controls.map((control) => (
					<div key={control.label} className="bt-tile" data-reveal="">
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
			<ol className="bt-tile bt-log" data-reveal="">
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
			<div className="bt-grid bt-tech">
				{section.stack.length > 0 && (
					<div className="bt-tile bt-tech-stack" data-reveal="">
						<span className="bt-label">쓴 기술</span>
						<ul className="bt-chips" aria-label="쓴 기술">
							{section.stack.map((item) => (
								<li key={item}>{item}</li>
							))}
						</ul>
					</div>
				)}
				{section.specs.length > 0 && (
					<dl className="bt-tile bt-specs" data-reveal="">
						{section.specs.map((spec) => (
							<div key={spec.label}>
								<dt>{spec.label}</dt>
								<dd>{spec.value}</dd>
							</div>
						))}
					</dl>
				)}
				{section.structure && (
					<figure className="bt-tile bt-structure" data-reveal="">
						<figcaption className="bt-label">폴더 구조</figcaption>
						<pre>{section.structure}</pre>
					</figure>
				)}
			</div>
		</>
	),
	role: ({ section }) => (
		<>
			<Head section={section} />
			<div className="bt-grid">
				{(section.context || section.role || section.period) && (
					<dl className="bt-tile bt-role-meta" data-reveal="">
						{section.context && (
							<div>
								<dt className="bt-label">프로젝트</dt>
								<dd>{section.context}</dd>
							</div>
						)}
						{section.role && (
							<div>
								<dt className="bt-label">역할</dt>
								<dd>{section.role}</dd>
							</div>
						)}
						{section.period && (
							<div>
								<dt className="bt-label">기간</dt>
								<dd>{section.period}</dd>
							</div>
						)}
					</dl>
				)}
				{section.contributions.length > 0 && (
					<ul className="bt-tile bt-list" data-reveal="">
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
			<Head section={section} />
			<ul className="bt-grid bt-credits">
				{section.credits.map((credit) => (
					<li key={`${credit.role}-${credit.name}`} className="bt-tile" data-reveal="">
						<span className="bt-label">{credit.role}</span>
						<strong>
							{credit.href ? (
								<a href={credit.href} target="_blank" rel="noopener noreferrer">
									{credit.name}
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
		</>
	),
};

const BentoPage: React.FC<{ project: Project }> = ({ project }) => {
	const landing = useLanding(project);
	const root = useReveal<HTMLDivElement>();
	const accent = useLandingAccent(project.icon);
	const { hero, closing } = landing;
	const meta = [hero.meta.role, hero.meta.period].filter(Boolean);

	return (
		<div ref={root} className="tpl tpl-bento" style={accent}>
			<header className="bt-hero">
				<p className="bt-brand">
					{hero.icon && <img className="bt-icon" src={hero.icon} alt="" />}
					{hero.logo ? <img className="bt-logo" src={hero.logo} alt={hero.name} /> : <span>{hero.name}</span>}
				</p>
				{hero.meta.context && <p className="bt-pill">{hero.meta.context}</p>}
				<h1>{hero.headline}</h1>
				{hero.subhead && <p className="bt-subhead">{hero.subhead}</p>}
				<LandingLinks links={hero.links} className="bt-links" />
				{meta.length > 0 && <p className="bt-meta">{meta.join(' · ')}</p>}
				{hero.image && (
					<figure className="bt-tile bt-hero-shot" data-reveal="zoom">
						<Media media={hero.image} eager />
					</figure>
				)}
			</header>

			<LandingSections landing={landing} renderers={RENDERERS} className="bt-section" />

			<footer className="bt-section bt-closing">
				<div className="bt-tile" data-reveal="">
					<h2>{closing.title}</h2>
					{closing.lead && <p className="bt-subhead">{closing.lead}</p>}
					<LandingLinks links={closing.links} className="bt-links" />
				</div>
			</footer>
		</div>
	);
};

export default BentoPage;
