// friendly 템플릿: Stripe처럼 밝고 친근하게. 아이콘 색 하나를 강조색으로, 또렷한 흰 카드와 아이콘, 이어진 단계 흐름,
// 대표 화면은 가벼운 창 틀 안에. 그림이 없어도 카드와 아이콘으로 꽉 차 보여 새 프로젝트의 기본 모양이다. 계약은 templates/README.md
import React from 'react';
import type { Project } from '@/shared/profile';
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
import './Page.css';

const Head: React.FC<{ section: LandingSection; title?: string; lead?: string }> = ({ section, title, lead }) => (
	<header className="fr-head" data-reveal="">
		<p className="fr-eyebrow">{section.label}</p>
		<h2>{title ?? sectionTitle(section)}</h2>
		{lead && <p className="fr-lead">{lead}</p>}
	</header>
);

/** 가벼운 창 틀: 위 막대에 점 셋 (장식) */
const Window: React.FC<{ media: LandingMedia; eager?: boolean; className?: string }> = ({
	media,
	eager,
	className,
}) => (
	<figure className={['fr-window', className].filter(Boolean).join(' ')}>
		<span className="fr-window-bar" aria-hidden="true">
			<i />
			<i />
			<i />
		</span>
		<Media media={media} eager={eager} />
	</figure>
);

/** 아이콘 칸: 강조색을 옅게 깐 둥근 네모 */
const IconTile: React.FC<{ point: LandingPoint; index: number }> = ({ point, index }) => (
	<span className="fr-icon" aria-hidden="true">
		<i className={`fa-solid ${iconOf(point, index)}`} />
	</span>
);

/** 기능 카드: 아이콘, 제목, 설명, 자세히, 그림이 있으면 카드 아래에 */
const Card: React.FC<{ point: LandingPoint; index: number }> = ({ point, index }) => (
	<li className="fr-card" data-reveal="" data-media={point.media.length ? '' : undefined}>
		<IconTile point={point} index={index} />
		<h3>{point.title}</h3>
		<p>{point.body}</p>
		{point.detail && <p className="fr-detail">{point.detail}</p>}
		{point.media.length > 0 && (
			<div className="fr-card-media">
				{point.media.map((media) => (
					<Media key={media.src} media={media} />
				))}
			</div>
		)}
	</li>
);

const RENDERERS: SectionRenderers = {
	stats: ({ section }) => (
		<>
			<h2 className="visually-hidden">{section.label}</h2>
			<ul className="fr-stats">
				{section.facts.map((fact) => (
					<li key={fact.label} data-reveal="">
						<strong>{fact.value}</strong>
						<span>{fact.label}</span>
					</li>
				))}
			</ul>
		</>
	),
	features: ({ section, landing }) => (
		<>
			<Head section={section} lead={landing.hero.subhead} />
			<ul className="fr-cards">
				{section.items.map((point, index) => (
					<Card key={point.title} point={point} index={index} />
				))}
			</ul>
		</>
	),
	screens: ({ section }) => (
		<>
			<Head section={section} />
			<ul className="fr-screens">
				{section.shots.map((shot) => (
					<li key={shot.src} data-reveal="">
						<Window media={shot} />
						<p>{shot.caption}</p>
					</li>
				))}
			</ul>
		</>
	),
	steps: ({ section }) => (
		<>
			<Head section={section} />
			<ol className="fr-steps">
				{section.items.map((point, index) => (
					<li key={point.title} data-reveal="">
						<span className="fr-step-num" aria-hidden="true">
							{index + 1}
						</span>
						<h3>{point.title}</h3>
						<p>{point.body}</p>
						{point.detail && <p className="fr-detail">{point.detail}</p>}
						{point.media.map((media) => (
							<Media key={media.src} media={media} className="fr-step-media" />
						))}
					</li>
				))}
			</ol>
		</>
	),
	built: ({ section }) => (
		<>
			<Head section={section} />
			<ul className="fr-cards fr-cards-two">
				{section.items.map((point, index) => (
					<Card key={point.title} point={point} index={index + 3} />
				))}
			</ul>
		</>
	),
	stories: ({ section }) => (
		<>
			<Head section={section} />
			<div className="fr-stories">
				{section.stories.map((story) => (
					<article key={story.title} className="fr-story" aria-label={story.title} data-reveal="">
						<div className="fr-story-text">
							<h3>{story.title}</h3>
							{story.lead && <p className="fr-story-lead">{story.lead}</p>}
							{story.facts.length > 0 && (
								<ul className="fr-story-facts">
									{story.facts.map((fact) => (
										<li key={fact.label}>
											<strong>{fact.value}</strong>
											<span>{fact.label}</span>
										</li>
									))}
								</ul>
							)}
							{story.points.length > 0 && (
								<ul className="fr-story-points">
									{story.points.map((point) => (
										<li key={point.title}>
											<i className="fa-solid fa-check" aria-hidden="true" />
											<div>
												<strong>{point.title}</strong>
												<p>{point.body}</p>
												{point.detail && <p className="fr-detail">{point.detail}</p>}
												{point.media.map((media) => (
													<Media key={media.src} media={media} className="fr-story-point-media" />
												))}
											</div>
										</li>
									))}
								</ul>
							)}
						</div>
						{story.image && <Window media={story.image} className="fr-story-image" />}
					</article>
				))}
			</div>
		</>
	),
	controls: ({ section }) => (
		<>
			<Head section={section} />
			<dl className="fr-controls" data-reveal="">
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
			<ol className="fr-timeline" data-reveal="">
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
			<div className="fr-tech" data-reveal="">
				{section.stack.length > 0 && (
					<ul className="fr-chips" aria-label="쓴 기술">
						{section.stack.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				)}
				{section.specs.length > 0 && (
					<dl className="fr-table">
						{section.specs.map((spec) => (
							<div key={spec.label}>
								<dt>{spec.label}</dt>
								<dd>{spec.value}</dd>
							</div>
						))}
					</dl>
				)}
				{section.structure && (
					<figure className="fr-code">
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
			<div className="fr-role" data-reveal="">
				{(section.context || section.period) && (
					<p className="fr-role-meta">{[section.context, section.period].filter(Boolean).join(' · ')}</p>
				)}
				{section.contributions.length > 0 && (
					<ul className="fr-checks">
						{section.contributions.map((item) => (
							<li key={item}>
								<i className="fa-solid fa-check" aria-hidden="true" />
								{item}
							</li>
						))}
					</ul>
				)}
			</div>
		</>
	),
	credits: ({ section }) => (
		<>
			<Head section={section} />
			<ul className="fr-credits" data-reveal="">
				{section.credits.map((credit) => (
					<li key={`${credit.role}-${credit.name}`}>
						<span className="fr-credit-role">{credit.role}</span>
						<strong>
							{credit.href ? (
								<a href={credit.href} target="_blank" rel="noopener noreferrer">
									{credit.name}
								</a>
							) : (
								credit.name
							)}
						</strong>
						<span className="fr-credit-by">{credit.by}</span>
						{credit.note && <span className="fr-credit-note">{credit.note}</span>}
					</li>
				))}
			</ul>
		</>
	),
};

const FriendlyPage: React.FC<{ project: Project }> = ({ project }) => {
	const landing = useLanding(project);
	const root = useReveal<HTMLDivElement>();
	const accent = useLandingAccent(project.icon);
	const { hero, closing } = landing;
	const tech = landing.sections.find((section) => section.kind === 'tech')?.stack ?? [];

	return (
		<div ref={root} className="tpl tpl-friendly" style={accent}>
			<header className="fr-hero">
				<div className="fr-hero-text">
					<p className="fr-brand">
						{hero.icon && <img className="fr-brand-icon" src={hero.icon} alt="" />}
						{hero.logo ? <img className="fr-logo" src={hero.logo} alt={hero.name} /> : <span>{hero.name}</span>}
						{hero.meta.context && <span className="fr-badge">{hero.meta.context}</span>}
					</p>
					<h1>{hero.headline}</h1>
					{hero.subhead && <p className="fr-subhead">{hero.subhead}</p>}
					<LandingLinks links={hero.links} className="fr-links" />
					{(hero.meta.role || hero.meta.period) && (
						<p className="fr-meta">{[hero.meta.role, hero.meta.period].filter(Boolean).join(' · ')}</p>
					)}
					{tech.length > 0 && (
						<ul className="fr-chips fr-hero-chips" aria-label="기술">
							{tech.slice(0, 6).map((item) => (
								<li key={item}>{item}</li>
							))}
						</ul>
					)}
				</div>
				{hero.image && (
					<div className="fr-hero-art" data-reveal="zoom">
						<Window media={hero.image} eager />
					</div>
				)}
			</header>

			<LandingSections landing={landing} renderers={RENDERERS} className="fr-section" />

			<footer className="fr-closing" data-reveal="">
				<div className="fr-closing-inner">
					<h2>{closing.title}</h2>
					{closing.lead && <p>{closing.lead}</p>}
					<LandingLinks links={closing.links} className="fr-links" />
				</div>
			</footer>
		</div>
	);
};

export default FriendlyPage;
