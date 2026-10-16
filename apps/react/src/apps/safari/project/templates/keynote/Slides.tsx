// keynote 템플릿의 슬라이드 한 장. 구역의 장은 <section aria-label={구역 이름}>으로 감싸 지금 장의 구역만 페이지에 있다.
// 장마다 왼쪽 위의 작은 구역 이름(h2), 큰 그림이나 큰 숫자, 짧은 한 줄. 긴 설명은 발표자 노트(.kn-notes)로 보낸다
import React from 'react';
import {
	DeployList,
	FaIcon,
	iconOf,
	LandingLinks,
	Media,
	TeamList,
	troubleIcon,
	troubleSteps,
	type Landing,
	type LandingMedia,
	type LandingPoint,
	type LandingSection,
	type SectionOf,
} from '@/apps/safari/project/landing';
import { Figure } from './Figure';
import type { Slide } from './deck';

const pad = (n: number) => String(n).padStart(2, '0');

/** 한 장에 하나뿐인 구역의 큰 문장 (발표의 말투) */
const VOICE: Partial<Record<LandingSection['kind'], string>> = {
	steps: '시작하는 방법은 간단합니다.',
	built: '이렇게 만들었습니다.',
	controls: '키 몇 개면 충분합니다.',
	tech: '이 기술로 만들었습니다.',
	team: '이 팀이 만들었습니다.',
	role: '저는 이 일을 맡았습니다.',
	timeline: '여기까지 오는 길입니다.',
	deployments: '지금 열어 볼 수 있습니다.',
	credits: '도움을 받은 곳입니다.',
};

/** 얇은 테두리의 화면 틀 */
const Frame: React.FC<{ media: LandingMedia; className?: string; eager?: boolean }> = ({ media, className, eager }) => (
	<div className={['kn-frame', className].filter(Boolean).join(' ')}>
		<Media media={media} eager={eager} className="kn-frame-media" />
	</div>
);

/** 그림이 없는 항목: 큰 아이콘 타일 (장식) */
const IconArt: React.FC<{ point: LandingPoint; index: number }> = ({ point, index }) => (
	<div className="kn-icon-art" aria-hidden="true">
		<span className="kn-icon-tile">
			<i className={`fa-solid ${iconOf(point, index)}`} />
		</span>
	</div>
);

/** 발표자 노트: 노트를 켜면 무대 아래쪽에 보인다 */
const Notes: React.FC<{ items: { title?: string; text: string }[] }> = ({ items }) =>
	items.length > 0 ? (
		<div className="kn-notes">
			<p className="kn-notes-label">발표자 노트</p>
			{items.map((item, index) => (
				<p key={index}>
					{item.title && <b>{item.title}</b>}
					{item.text}
				</p>
			))}
		</div>
	) : null;

const detailNotes = (points: LandingPoint[]) =>
	points.filter((point) => point.detail).map((point) => ({ title: point.title, text: point.detail! }));

/** 장 머리: 작은 구역 이름과 장 차례 */
const Tag: React.FC<{ section: LandingSection; part?: number; parts?: number }> = ({ section, part, parts }) => (
	<h2 className="kn-tag">
		{section.label}
		{parts !== undefined && parts > 1 && part !== undefined && (
			<span className="kn-tag-count">
				{pad(part + 1)} / {pad(parts)}
			</span>
		)}
	</h2>
);

type PartProps<K extends LandingSection['kind']> = {
	section: SectionOf<K>;
	part: number;
	parts: number;
	build: number;
};

const StatSlide: React.FC<PartProps<'stats'>> = ({ section, part, parts }) => {
	const fact = section.facts[part];
	return (
		<div className="kn-s kn-s-number">
			<Tag section={section} part={part} parts={parts} />
			<Figure value={fact.value} className="kn-giant" />
			<p className="kn-number-label">{fact.label}</p>
		</div>
	);
};

const FeatureSlide: React.FC<PartProps<'features'>> = ({ section, part, parts }) => {
	const point = section.items[part];
	const [first, ...more] = point.media;
	return (
		<div className="kn-s kn-s-feature" data-art={first ? undefined : ''}>
			<Tag section={section} part={part} parts={parts} />
			<div className="kn-feature-visual">
				{first ? <Frame media={first} /> : <IconArt point={point} index={part} />}
			</div>
			<div className="kn-feature-caption">
				{point.group && <p className="kn-group">{point.group}</p>}
				<h3>{point.title}</h3>
				<p className="kn-line">{point.body}</p>
				{more.length > 0 && (
					<ul className="kn-more" aria-label={`${point.title} 화면 더 보기`}>
						{more.map((media) => (
							<li key={media.src}>
								<Frame media={media} />
							</li>
						))}
					</ul>
				)}
			</div>
			<Notes items={detailNotes([point])} />
		</div>
	);
};

const ScreenSlide: React.FC<PartProps<'screens'>> = ({ section, part, parts }) => {
	const shot = section.shots[part];
	return (
		<div className="kn-s kn-s-screen">
			<Tag section={section} part={part} parts={parts} />
			<figure className="kn-screen">
				<Frame media={shot} />
				<figcaption>{shot.caption}</figcaption>
			</figure>
		</div>
	);
};

const PointMedia: React.FC<{ point: LandingPoint }> = ({ point }) =>
	point.media.length > 0 ? (
		<div className="kn-point-media">
			{point.media.map((media) => (
				<Frame key={media.src} media={media} />
			))}
		</div>
	) : null;

const StepsSlide: React.FC<PartProps<'steps'>> = ({ section }) => (
	<div className="kn-s kn-s-list">
		<Tag section={section} />
		<p className="kn-headline">{VOICE.steps}</p>
		<ol className="kn-columns" data-count={Math.min(section.items.length, 4)}>
			{section.items.map((point, index) => (
				<li key={point.title}>
					<span className="kn-step-num" aria-hidden="true">
						{index + 1}
					</span>
					<h3>{point.title}</h3>
					<p className="kn-body">{point.body}</p>
					<PointMedia point={point} />
				</li>
			))}
		</ol>
		<Notes items={detailNotes(section.items)} />
	</div>
);

const BuiltSlide: React.FC<PartProps<'built'>> = ({ section }) => (
	<div className="kn-s kn-s-list">
		<Tag section={section} />
		<p className="kn-headline">{VOICE.built}</p>
		<ul className="kn-columns kn-cards" data-count={Math.min(section.items.length, 4)}>
			{section.items.map((point, index) => (
				<li key={point.title}>
					<span className="kn-glyph" aria-hidden="true">
						<i className={`fa-solid ${iconOf(point, index)}`} />
					</span>
					<h3>{point.title}</h3>
					<p className="kn-body">{point.body}</p>
					<PointMedia point={point} />
				</li>
			))}
		</ul>
		<Notes items={detailNotes(section.items)} />
	</div>
);

/** 트러블슈팅 한 건: 문제 → 원인 → 해결 → 결과를 빌드마다 하나씩 */
const TroubleSlide: React.FC<PartProps<'troubleshooting'>> = ({ section, part, parts, build }) => {
	const item = section.items[part];
	const steps = troubleSteps(item);
	return (
		<div className="kn-s kn-s-trouble" data-image={item.image ? '' : undefined}>
			<Tag section={section} part={part} parts={parts} />
			<div className="kn-trouble-head">
				<span className="kn-icon-tile kn-trouble-icon" aria-hidden="true">
					<FaIcon icon={troubleIcon(item)} />
				</span>
				<h3>{item.title}</h3>
			</div>
			<ol className="kn-builds" data-count={steps.length}>
				{steps.map((step, index) => (
					<li key={step.key} data-step={step.key} data-built={index < build ? '' : undefined}>
						<p className="kn-build-label">
							<span aria-hidden="true">{pad(index + 1)}</span>
							{step.label}
						</p>
						<p className="kn-build-text">{step.text}</p>
					</li>
				))}
			</ol>
			{item.image && (
				<figure className="kn-trouble-image">
					<Frame media={item.image} />
				</figure>
			)}
		</div>
	);
};

const StorySlide: React.FC<PartProps<'stories'>> = ({ section, part, parts }) => {
	const story = section.stories[part];
	return (
		<article className="kn-s kn-s-story" aria-label={story.title} data-image={story.image ? '' : undefined}>
			<Tag section={section} part={part} parts={parts} />
			<div className="kn-story-text">
				<h3>{story.title}</h3>
				{story.lead && <p className="kn-line">{story.lead}</p>}
				{story.facts.length > 0 && (
					<ul className="kn-story-facts">
						{story.facts.map((fact) => (
							<li key={fact.label}>
								<Figure value={fact.value} />
								<span>{fact.label}</span>
							</li>
						))}
					</ul>
				)}
				{story.points.length > 0 && (
					<ul className="kn-story-points">
						{story.points.map((point) => (
							<li key={point.title}>
								<h4>{point.title}</h4>
								<p className="kn-body">{point.body}</p>
								<PointMedia point={point} />
							</li>
						))}
					</ul>
				)}
			</div>
			{story.image && (
				<figure className="kn-story-image">
					<Frame media={story.image} />
				</figure>
			)}
			<Notes items={detailNotes(story.points)} />
		</article>
	);
};

const ControlsSlide: React.FC<PartProps<'controls'>> = ({ section }) => (
	<div className="kn-s kn-s-list">
		<Tag section={section} />
		<p className="kn-headline">{VOICE.controls}</p>
		<dl className="kn-keys" data-count={Math.min(section.controls.length, 4)}>
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
	</div>
);

const TechSlide: React.FC<PartProps<'tech'>> = ({ section }) => (
	<div className="kn-s kn-s-split" data-tree={section.structure ? '' : undefined}>
		<Tag section={section} />
		<div className="kn-split-main">
			<p className="kn-headline">{VOICE.tech}</p>
			{section.stack.length > 0 && (
				<ul className="kn-stack" aria-label="쓴 기술">
					{section.stack.map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
			)}
			{section.specs.length > 0 && (
				<dl className="kn-sheet">
					{section.specs.map((spec) => (
						<div key={spec.label}>
							<dt>{spec.label}</dt>
							<dd>{spec.value}</dd>
						</div>
					))}
				</dl>
			)}
		</div>
		{section.structure && (
			<div className="kn-split-side">
				<p className="kn-side-label">폴더 구조</p>
				<pre className="kn-structure">{section.structure}</pre>
			</div>
		)}
	</div>
);

const TeamSlide: React.FC<PartProps<'team'>> = ({ section }) => (
	<div className="kn-s kn-s-list">
		<Tag section={section} />
		<p className="kn-headline">{VOICE.team}</p>
		<TeamList members={section.members} prefix="kn" reveal={false} />
	</div>
);

const RoleSlide: React.FC<PartProps<'role'>> = ({ section }) => {
	const meta = (
		[
			['역할', section.role],
			['프로젝트', section.context],
			['기간', section.period],
		] as [string, string | undefined][]
	).filter((row): row is [string, string] => Boolean(row[1]));
	return (
		<div className="kn-s kn-s-split">
			<Tag section={section} />
			<div className="kn-split-main">
				<p className="kn-headline">{VOICE.role}</p>
				{meta.length > 0 && (
					<dl className="kn-sheet">
						{meta.map(([label, value]) => (
							<div key={label}>
								<dt>{label}</dt>
								<dd>{value}</dd>
							</div>
						))}
					</dl>
				)}
			</div>
			{section.contributions.length > 0 && (
				<ol className="kn-split-side kn-contributions">
					{section.contributions.map((item, index) => (
						<li key={item}>
							<span aria-hidden="true">{pad(index + 1)}</span>
							{item}
						</li>
					))}
				</ol>
			)}
		</div>
	);
};

const TimelineSlide: React.FC<PartProps<'timeline'>> = ({ section }) => (
	<div className="kn-s kn-s-list">
		<Tag section={section} />
		<p className="kn-headline">{VOICE.timeline}</p>
		<ol className="kn-timeline" style={{ '--n': Math.min(section.entries.length, 7) } as React.CSSProperties}>
			{section.entries.map((entry) => (
				<li key={`${entry.date}-${entry.label}`}>
					<time>{entry.date}</time>
					<span>{entry.label}</span>
				</li>
			))}
		</ol>
	</div>
);

const DeploySlide: React.FC<PartProps<'deployments'>> = ({ section }) => (
	<div className="kn-s kn-s-list">
		<Tag section={section} />
		<p className="kn-headline">{VOICE.deployments}</p>
		<DeployList items={section.items} prefix="kn" reveal={false} />
	</div>
);

const CreditsSlide: React.FC<PartProps<'credits'>> = ({ section }) => (
	<div className="kn-s kn-s-list">
		<Tag section={section} />
		<p className="kn-headline">{VOICE.credits}</p>
		<ul className="kn-credits">
			{section.credits.map((credit) => (
				<li key={`${credit.role}-${credit.name}`}>
					<span className="kn-credit-role">{credit.role}</span>
					<span className="kn-credit-name">
						{credit.href ? (
							<a href={credit.href} target="_blank" rel="noopener noreferrer">
								{credit.name}
							</a>
						) : (
							credit.name
						)}
					</span>
					<span className="kn-credit-by">
						{credit.by}
						{credit.note && <span className="kn-credit-note">{credit.note}</span>}
					</span>
				</li>
			))}
		</ul>
	</div>
);

const PARTS: { [K in LandingSection['kind']]: React.FC<PartProps<K>> } = {
	stats: StatSlide,
	features: FeatureSlide,
	screens: ScreenSlide,
	steps: StepsSlide,
	built: BuiltSlide,
	troubleshooting: TroubleSlide,
	stories: StorySlide,
	controls: ControlsSlide,
	tech: TechSlide,
	team: TeamSlide,
	role: RoleSlide,
	timeline: TimelineSlide,
	deployments: DeploySlide,
	credits: CreditsSlide,
};

/** 표지: 왼쪽 큰 제목과 링크, 오른쪽 대표 화면 (없으면 앱 아이콘과 기능 아이콘 넷) */
const TitleSlide: React.FC<{ landing: Landing }> = ({ landing }) => {
	const { hero } = landing;
	const features = landing.sections.find((section) => section.kind === 'features');
	const points = features?.kind === 'features' ? features.items.slice(0, 4) : [];
	const meta = [hero.meta.context, hero.meta.role, hero.meta.period].filter(Boolean) as string[];
	const art = !hero.image && (hero.icon || points.length > 0);
	return (
		<header className="kn-s kn-s-title" data-visual={hero.image ? 'shot' : art ? 'art' : undefined}>
			<div className="kn-title-copy">
				<p className="kn-brand">
					{hero.icon && hero.image && <img className="kn-brand-icon" src={hero.icon} alt="" />}
					{hero.logo ? <img className="kn-logo" src={hero.logo} alt={hero.name} /> : <span>{hero.name}</span>}
				</p>
				<h1>{hero.headline}</h1>
				{hero.subhead && <p className="kn-subhead">{hero.subhead}</p>}
				<LandingLinks links={hero.links} className="kn-links" />
				{meta.length > 0 && (
					<ul className="kn-meta" aria-label="프로젝트 정보">
						{meta.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				)}
			</div>
			{hero.image ? (
				<div className="kn-title-visual">
					<Frame media={hero.image} eager />
				</div>
			) : (
				art && (
					<div className="kn-title-visual kn-title-art" aria-hidden="true">
						{hero.icon && <img className="kn-title-icon" src={hero.icon} alt="" />}
						{points.length > 0 && (
							<ul className="kn-overview">
								{points.map((point, index) => (
									<li key={point.title}>
										<span className="kn-icon-tile">
											<i className={`fa-solid ${iconOf(point, index)}`} />
										</span>
										<b>{point.title}</b>
									</li>
								))}
							</ul>
						)}
					</div>
				)
			)}
		</header>
	);
};

/** 마지막 인사: 감사 인사, 마무리 문장, 링크 */
const EndSlide: React.FC<{ landing: Landing }> = ({ landing }) => {
	const { hero, closing } = landing;
	return (
		<footer className="kn-s kn-s-end">
			{hero.icon && <img className="kn-end-icon" src={hero.icon} alt="" />}
			<p className="kn-thanks">감사합니다.</p>
			<h2>{closing.title}</h2>
			{closing.lead && <p className="kn-subhead">{closing.lead}</p>}
			<LandingLinks links={closing.links} className="kn-links" />
		</footer>
	);
};

export const SlideView: React.FC<{ slide: Slide; landing: Landing; build: number }> = ({ slide, landing, build }) => {
	if (slide.type === 'title') return <TitleSlide landing={landing} />;
	if (slide.type === 'end') return <EndSlide landing={landing} />;
	const { section, part, parts } = slide;
	const Render = PARTS[section.kind] as React.FC<PartProps<LandingSection['kind']>>;
	return (
		<section aria-label={section.label} data-section={section.kind} className="kn-region">
			<Render section={section as never} part={part} parts={parts} build={build} />
		</section>
	);
};
