// magazine 템플릿: 잡지의 사례 연구 기사처럼(NYT 특집, Stripe Press). 따뜻한 종이와 검은 잉크, 붉은 잉크 하나, 명조 제목과 고딕 본문.
// 표지처럼 왼쪽에 정렬한 아주 큰 명조 이름과 그 아래 제목(데크), 겹줄, 바이라인과 글 링크, 판 위의 넓은 사진과 설명으로 연다.
// 구역은 작은 머리말과 왼쪽 정렬 명조 제목, 가는 줄로 시작하는 기사의 꼭지다: 두 단으로 흐르는 기능 기사(내린 머리글자, 사이에 걸친 인용구),
// 숫자 상자, 번호 붙은 곁글, 두 단 본문, 연표, 각주와 미주.
// 계약은 templates/README.md
import React from 'react';
import type { Project, ProjectFact } from '@/shared/profile';
import { useReveal } from '@/apps/safari/project/reveal';
import {
	DeployList,
	iconOf,
	LandingLinks,
	LandingSections,
	Media,
	sectionTitle,
	TeamList,
	TroubleList,
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

/** 구역마다 매거진 말투의 제목 (공용 sectionTitle 대신) */
function magazineTitle(section: LandingSection): string {
	switch (section.kind) {
		case 'features':
			return '기능 하나하나에 담긴 생각을 읽습니다.';
		case 'screens':
			return '지면으로 옮긴 화면들입니다.';
		case 'steps':
			return section.items.length > 1
				? `${section.items.length}단계로 시작하는 법을 정리했습니다.`
				: '시작하는 법을 정리했습니다.';
		case 'built':
			return '보이지 않는 곳에서 일어나는 일을 적었습니다.';
		case 'troubleshooting':
			return '막혔던 순간과 풀어 낸 과정을 기록했습니다.';
		case 'stories':
			return '지면에 다 싣지 못한 이야기를 덧붙입니다.';
		case 'controls':
			return '손에 익혀 두면 좋은 키를 모았습니다.';
		case 'tech':
			return '만드는 데 쓴 기술을 밝혀 둡니다.';
		case 'team':
			return '함께 만든 사람들을 소개합니다.';
		case 'timeline':
			return '처음부터 마무리까지의 기록입니다.';
		case 'deployments':
			return '완성된 결과물은 이곳에서 만날 수 있습니다.';
		default:
			return sectionTitle(section);
	}
}

/** 꼭지 머리: 작은 대문자 머리말, 왼쪽 정렬 명조 h2, 아래 가는 줄 */
const Head: React.FC<{ section: LandingSection; title?: string }> = ({ section, title }) => (
	<header className="mg-head" data-reveal="ink">
		<p className="mg-rubric">{section.label}</p>
		<h2>{title ?? magazineTitle(section)}</h2>
	</header>
);

/** 사진 한 장: 옅은 판 위의 그림과 번호 붙은 설명 (번호는 CSS 카운터) */
const Figure: React.FC<{ media: LandingMedia; caption?: string; size?: 'wide' | 'inset' | 'small' }> = ({
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

/** 두 단 기사의 한 꼭지: 번호·아이콘·묶음의 작은 머리, h3, 리드 문장, 이어 읽는 글, 단 폭의 사진. 첫 꼭지는 머리글자를 크게 내린다 */
const Feature: React.FC<{ point: LandingPoint; index: number }> = ({ point, index }) => (
	<div className="mg-item">
		<p className="mg-item-kicker">
			<span className="mg-item-no">{pad(index + 1)}</span>
			<i className={`fa-solid ${iconOf(point, index)}`} aria-hidden="true" />
			{point.group && <span>{point.group}</span>}
		</p>
		<h3>{point.title}</h3>
		<p className="mg-standfirst" data-dropcap={index === 0 ? '' : undefined}>
			{point.body}
		</p>
		{point.detail && <p className="mg-prose">{point.detail}</p>}
		{point.media.map((item) => (
			<Figure key={item.src} media={item} caption={item.alt} size="inset" />
		))}
	</div>
);

/**
 * 주요 기능: 두 단으로 흐르는 기사. 앞 절반과 뒤 절반 사이에 한 꼭지의 리드 문장을 큰 인용구로 걸친다
 * (그림 없는 꼭지가 있으면 그것, 없으면 가운데 꼭지). 인용구는 본문을 한 번 더 싣는 것이라 보조 기술에는 숨긴다
 */
const FeatureArticle: React.FC<{ items: LandingPoint[] }> = ({ items }) => {
	const split = Math.ceil(items.length / 2);
	const plain = items.findIndex((point) => point.media.length === 0);
	const quote = items.length < 2 ? undefined : items[plain >= 0 ? plain : split - 1];
	const column = (from: number, to: number) => (
		<div className="mg-cols" data-reveal="ink">
			{items.slice(from, to).map((point, offset) => (
				<Feature key={point.title} point={point} index={from + offset} />
			))}
		</div>
	);
	return (
		<div className="mg-article">
			{column(0, split)}
			{quote && (
				<aside className="mg-pullquote" aria-hidden="true">
					<blockquote>
						<p>{quote.body}</p>
					</blockquote>
					<p className="mg-pullquote-src">{quote.title}</p>
				</aside>
			)}
			{split < items.length && column(split, items.length)}
		</div>
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
	features: ({ section }) => (
		<>
			<Head section={section} />
			<FeatureArticle items={section.items} />
		</>
	),
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
	troubleshooting: ({ section }) => (
		<>
			<Head section={section} />
			<TroubleList items={section.items} prefix="mg" />
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
	team: ({ section }) => (
		<>
			<Head section={section} />
			<TeamList members={section.members} prefix="mg" />
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
	deployments: ({ section }) => (
		<>
			<Head section={section} />
			<DeployList items={section.items} prefix="mg" />
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
	const byline = [hero.meta.role, hero.meta.period].filter((item): item is string => Boolean(item));
	const showName = hero.logo || hero.headline !== hero.name;

	return (
		<div ref={root} className="tpl tpl-magazine" style={accent} data-image={hero.image ? '' : undefined}>
			<header className="mg-hero">
				<div className="mg-cover">
					<p className="mg-folio">
						{hero.icon && <img className="mg-mast-icon" src={hero.icon} alt="" />}
						<span>사례 연구</span>
						{hero.meta.context && <span className="mg-folio-context">{hero.meta.context}</span>}
					</p>
					{showName &&
						(hero.logo ? (
							<img className="mg-logo" src={hero.logo} alt={hero.name} />
						) : (
							<p className="mg-title">{hero.name}</p>
						))}
					<h1 data-solo={showName ? undefined : ''}>{hero.headline}</h1>
					{hero.subhead && <p className="mg-dek">{hero.subhead}</p>}
					<div className="mg-byline-row">
						{byline.length > 0 && (
							<p className="mg-byline">
								{byline.map((item, index) => (
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
						<LandingLinks links={hero.links} className="mg-links" />
					</div>
				</div>
				{hero.image && (
					<figure className="mg-lead">
						<div className="mg-plate">
							<Media media={hero.image} eager />
						</div>
						<figcaption>{hero.image.alt}</figcaption>
					</figure>
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
