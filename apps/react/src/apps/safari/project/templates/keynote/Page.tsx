// keynote 템플릿: Apple 키노트 무대와 Linear 출시 페이지처럼. 사이트 테마와 상관없이 검은 무대 위에서 한 장면씩 넘긴다.
// 첫 장면은 창 너비 가득 깔린 영화 같은 화면(그림이 없으면 큰 아이콘을 둔 어두운 장면)이고, 제목과 링크는 왼쪽 아래 옅은 어둠 위에 얹는다.
// 장면 머리는 왼쪽의 큰 번호(01)와 오른쪽 제목, 가는 선. 기능은 그림이 창 가장자리까지 닿는 넓은 줄이 좌우로 번갈아 놓이고
// 아주 큰 번호가 붙는다. 숫자는 세어 올라가는 한 줄, 쓰는 법은 슬라이드 차례, 기술 사양은 어두운 사양표, 마무리는 마지막 타이틀 카드.
// 빛 번짐·그라데이션 글자는 쓰지 않는다. 계약은 templates/README.md
import React from 'react';
import type { Project } from '@/shared/profile';
import { useReveal } from '@/apps/safari/project/reveal';
import {
	DeployList,
	iconOf,
	LandingLinks,
	LandingSections,
	Media,
	TeamList,
	TroubleList,
	useLanding,
	useLandingAccent,
	type LandingHero,
	type LandingMedia,
	type LandingPoint,
	type LandingSection,
	type SectionRenderers,
} from '@/apps/safari/project/landing';
import { keynoteAccent } from './accent';
import { Figure } from './Figure';
import { Screens } from './Screens';
import './Page.css';

const pad = (n: number) => String(n).padStart(2, '0');

/** 나타나는 차례 (0부터): 목록 안에서 조금씩 늦게 */
const delay = (index: number) => ({ '--d': Math.min(index, 4) }) as React.CSSProperties;

/** 장면 머리의 문장: 무대 위 발표자의 말투 (구역 이름은 section의 aria-label과 작은 글자가 맡는다) */
const titleOf = (section: LandingSection): string => {
	switch (section.kind) {
		case 'stats':
			return '숫자로 시작하겠습니다.';
		case 'features':
			return '오늘 보여 드릴 기능입니다.';
		case 'screens':
			return '화면을 띄워 보겠습니다.';
		case 'steps':
			return '시작하는 방법은 이렇습니다.';
		case 'built':
			return '무대 뒤를 보여 드리겠습니다.';
		case 'troubleshooting':
			return '쉽지 않은 순간도 있었습니다.';
		case 'stories':
			return '이야기가 하나 더 있습니다.';
		case 'controls':
			return '손에 익는 조작입니다.';
		case 'tech':
			return '사양을 살펴보겠습니다.';
		case 'team':
			return '이 무대를 함께 만든 사람들입니다.';
		case 'role':
			return '저는 이 부분을 맡았습니다.';
		case 'timeline':
			return '지나온 길을 되짚어 보겠습니다.';
		case 'deployments':
			return '지금 바로 만나 보실 수 있습니다.';
		case 'credits':
			return '도움을 받은 자료입니다.';
	}
};

/** 장면 머리: 가는 선 아래 왼쪽에 큰 번호, 오른쪽에 작은 구역 이름과 큰 문장 */
const Head: React.FC<{ section: LandingSection; index: number; lead?: string }> = ({ section, index, lead }) => (
	<header className="kn-head" data-reveal="">
		<span className="kn-head-num" aria-hidden="true">
			{pad(index + 1)}
		</span>
		<div className="kn-head-text">
			<p className="kn-head-label">{section.label}</p>
			<h2>{titleOf(section)}</h2>
			{lead && <p className="kn-lead">{lead}</p>}
		</div>
	</header>
);

/** 얇은 테두리의 화면 틀 */
const Frame: React.FC<{ media: LandingMedia; className?: string; eager?: boolean }> = ({ media, className, eager }) => (
	<div className={['kn-frame', className].filter(Boolean).join(' ')}>
		<Media media={media} eager={eager} className="kn-frame-media" />
	</div>
);

/** 그림이 없는 항목의 슬라이드: 옅은 점 격자 위 가운데 아이콘 타일과 작은 차례 표시 (장식) */
const IconSlide: React.FC<{ point: LandingPoint; index: number; total?: number }> = ({ point, index, total }) => (
	<div className="kn-icon-slide" aria-hidden="true">
		<span className="kn-icon-tile">
			<i className={`fa-solid ${iconOf(point, index)}`} />
		</span>
		<span className="kn-icon-caption">
			<span className="kn-index">{total ? `${pad(index + 1)} / ${pad(total)}` : pad(index + 1)}</span>
			<b>{point.title}</b>
		</span>
	</div>
);

/** 항목의 그림들: 첫 장은 크게, 나머지는 아래에 나란히 */
const MediaSet: React.FC<{ point: LandingPoint; className?: string }> = ({ point, className }) => {
	const [first, ...more] = point.media;
	if (!first) return null;
	return (
		<div className={['kn-media-set', className].filter(Boolean).join(' ')}>
			<Frame media={first} />
			{more.length > 0 && (
				<ul className="kn-media-more" aria-label={`${point.title} 화면 더 보기`} data-count={Math.min(more.length, 3)}>
					{more.map((media) => (
						<li key={media.src}>
							<Frame media={media} />
						</li>
					))}
				</ul>
			)}
		</div>
	);
};

/** 항목의 글: 묶음, 제목, 설명, 이어 읽는 설명 */
const PointText: React.FC<{ point: LandingPoint }> = ({ point }) => (
	<>
		{point.group && <p className="kn-group">{point.group}</p>}
		<h3>{point.title}</h3>
		<p className="kn-body">{point.body}</p>
		{point.detail && <p className="kn-detail">{point.detail}</p>}
	</>
);

/** 기능 하나가 한 장면: 왼쪽에 머무는 큰 차례와 글, 오른쪽에 큰 그림(없으면 아이콘 슬라이드). 장면마다 좌우가 바뀐다 */
const Feature: React.FC<{ point: LandingPoint; index: number; total: number }> = ({ point, index, total }) => (
	<li className="kn-feature" data-flip={index % 2 === 1 ? '' : undefined}>
		<div className="kn-feature-text" data-reveal="">
			<p className="kn-feature-num" aria-hidden="true">
				{pad(index + 1)}
			</p>
			<PointText point={point} />
		</div>
		<div className="kn-feature-visual" data-reveal="">
			{point.media.length > 0 ? <MediaSet point={point} /> : <IconSlide point={point} index={index} total={total} />}
		</div>
	</li>
);

/** 만든 방식의 칸 수: 그림이 없는 항목이 3의 배수면 세 칸, 아니면 두 칸 (두 칸에서 홀수로 남는 마지막은 한 줄을 다 쓴다, CSS) */
const builtColumns = (items: LandingPoint[]) => {
	const plain = items.filter((point) => point.media.length === 0).length;
	return plain > 0 && plain % 3 === 0 ? 3 : 2;
};

const RENDERERS: SectionRenderers = {
	stats: ({ section, index }) => (
		<div className="kn-stats-scene">
			<Head section={section} index={index} />
			<ul className="kn-stats" data-count={Math.min(section.facts.length, 4)}>
				{section.facts.map((fact, index) => (
					<li key={fact.label} data-reveal="" style={delay(index)}>
						<Figure value={fact.value} />
						<span className="kn-stat-label">{fact.label}</span>
					</li>
				))}
			</ul>
		</div>
	),
	features: ({ section, index }) => (
		<>
			<Head section={section} index={index} />
			<ol className="kn-features">
				{section.items.map((point, index) => (
					<Feature key={point.title} point={point} index={index} total={section.items.length} />
				))}
			</ol>
		</>
	),
	screens: ({ section, index }) => (
		<>
			<Head section={section} index={index} />
			<Screens shots={section.shots} />
		</>
	),
	steps: ({ section, index }) => (
		<>
			<Head section={section} index={index} />
			<ol className="kn-slides" data-count={Math.min(section.items.length, 4)}>
				{section.items.map((point, index) => {
					const [first, ...more] = point.media;
					return (
						<li key={point.title} className="kn-slide" data-reveal="" style={delay(index)}>
							<div className="kn-slide-screen">
								{first ? (
									<Media media={first} className="kn-slide-media" />
								) : (
									<span className="kn-slide-art" aria-hidden="true">
										<i className={`fa-solid ${iconOf(point, index)}`} />
										<b>{index + 1}</b>
									</span>
								)}
								<span className="kn-slide-count" aria-hidden="true">
									{index + 1} / {section.items.length}
								</span>
							</div>
							<p className="kn-slide-step">{index + 1}단계</p>
							<PointText point={point} />
							{more.length > 0 && (
								<ul className="kn-media-more" aria-label={`${point.title} 화면 더 보기`}>
									{more.map((media) => (
										<li key={media.src}>
											<Frame media={media} />
										</li>
									))}
								</ul>
							)}
						</li>
					);
				})}
			</ol>
		</>
	),
	built: ({ section, index }) => (
		<>
			<Head section={section} index={index} />
			<ul className="kn-built" data-cols={builtColumns(section.items)}>
				{section.items.map((point, index) => (
					<li
						key={point.title}
						data-reveal=""
						data-media={point.media.length ? '' : undefined}
						style={delay(index % 2)}
					>
						<div className="kn-built-text">
							<span className="kn-glyph" aria-hidden="true">
								<i className={`fa-solid ${iconOf(point, index)}`} />
							</span>
							<PointText point={point} />
						</div>
						<MediaSet point={point} />
					</li>
				))}
			</ul>
		</>
	),
	troubleshooting: ({ section, index }) => (
		<>
			<Head section={section} index={index} />
			<TroubleList items={section.items} prefix="kn" />
		</>
	),
	stories: ({ section, index }) => (
		<>
			<Head section={section} index={index} />
			<div className="kn-stories">
				{section.stories.map((story, number) => (
					<article
						key={story.title}
						className="kn-story"
						aria-label={story.title}
						data-image={story.image ? '' : undefined}
					>
						<header className="kn-story-head" data-reveal="">
							<p className="kn-eyebrow">
								{section.label} {pad(number + 1)}
							</p>
							<h2>{story.title}</h2>
							{story.lead && <p className="kn-lead">{story.lead}</p>}
						</header>
						{story.image && (
							<figure className="kn-story-image" data-reveal="">
								<Frame media={story.image} />
							</figure>
						)}
						{story.facts.length > 0 && (
							<ul className="kn-story-facts" data-count={Math.min(story.facts.length, 4)}>
								{story.facts.map((fact, index) => (
									<li key={fact.label} data-reveal="" style={delay(index)}>
										<Figure value={fact.value} />
										<span className="kn-stat-label">{fact.label}</span>
									</li>
								))}
							</ul>
						)}
						{story.points.length > 0 && (
							<ul className="kn-story-points">
								{story.points.map((point, index) => (
									<li key={point.title} data-reveal="" style={delay(index)}>
										<span className="kn-index" aria-hidden="true">
											{pad(index + 1)}
										</span>
										<PointText point={point} />
										<MediaSet point={point} />
									</li>
								))}
							</ul>
						)}
					</article>
				))}
			</div>
		</>
	),
	controls: ({ section, index }) => (
		<>
			<Head section={section} index={index} />
			<dl className="kn-keys" data-count={Math.min(section.controls.length, 4)}>
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
	timeline: ({ section, index }) => (
		<>
			<Head section={section} index={index} />
			<ol
				className="kn-timeline"
				style={{ '--n': Math.min(section.entries.length, 7) } as React.CSSProperties}
				data-wrap={section.entries.length > 7 ? '' : undefined}
			>
				{section.entries.map((entry, index) => (
					<li key={`${entry.date}-${entry.label}`} data-reveal="" style={delay(index)}>
						<span className="kn-index" aria-hidden="true">
							{pad(index + 1)}
						</span>
						<time>{entry.date}</time>
						<span className="kn-timeline-label">{entry.label}</span>
					</li>
				))}
			</ol>
		</>
	),
	tech: ({ section, index }) => (
		<>
			<Head section={section} index={index} />
			<dl className="kn-sheet">
				{section.stack.length > 0 && (
					<div>
						<dt>쓴 기술</dt>
						<dd>
							<ul className="kn-stack" aria-label="쓴 기술">
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
							<pre className="kn-structure">{section.structure}</pre>
						</dd>
					</div>
				)}
			</dl>
		</>
	),
	team: ({ section, index }) => (
		<>
			<Head section={section} index={index} />
			<TeamList members={section.members} prefix="kn" />
		</>
	),
	role: ({ section, index }) => (
		<>
			<Head section={section} index={index} />
			<div className="kn-role">
				{(section.role || section.context || section.period) && (
					<dl className="kn-sheet">
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
					<ol className="kn-contributions">
						{section.contributions.map((item, index) => (
							<li key={item}>
								<span className="kn-index" aria-hidden="true">
									{pad(index + 1)}
								</span>
								<span>{item}</span>
							</li>
						))}
					</ol>
				)}
			</div>
		</>
	),
	deployments: ({ section, index }) => (
		<>
			<Head section={section} index={index} />
			<DeployList items={section.items} prefix="kn" />
		</>
	),
	credits: ({ section, index }) => (
		<>
			<Head section={section} index={index} />
			<ul className="kn-credits">
				{section.credits.map((credit) => (
					<li key={`${credit.role}-${credit.name}`}>
						<span className="kn-credit-role">{credit.role}</span>
						<span className="kn-credit-name">
							{credit.href ? (
								<a href={credit.href} target="_blank" rel="noopener noreferrer">
									{credit.name}
									<i className="fa-solid fa-arrow-up-right" aria-hidden="true" />
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
		</>
	),
};

/** 첫 장면의 배경: 그림이 있으면 창 너비 가득, 없으면 점 격자 위 큰 앱 아이콘(없으면 첫 기능의 아이콘 타일)을 둔 어두운 장면 (장식) */
const HeroScene: React.FC<{ hero: LandingHero; first?: LandingPoint }> = ({ hero, first }) => {
	if (hero.image) return <Media media={hero.image} eager className="kn-hero-media" />;
	return (
		<div className="kn-hero-stage" aria-hidden="true">
			{hero.icon ? (
				<img className="kn-hero-icon" src={hero.icon} alt="" />
			) : (
				first && (
					<span className="kn-icon-tile kn-hero-tile">
						<i className={`fa-solid ${iconOf(first, 0)}`} />
					</span>
				)
			)}
		</div>
	);
};

const KeynotePage: React.FC<{ project: Project }> = ({ project }) => {
	const landing = useLanding(project);
	const root = useReveal<HTMLDivElement>();
	const accent = keynoteAccent(useLandingAccent(project.icon));
	const { hero, closing } = landing;
	const meta = (
		[
			['프로젝트', hero.meta.context],
			['역할', hero.meta.role],
			['기간', hero.meta.period],
		] as [string, string | undefined][]
	).filter((entry): entry is [string, string] => Boolean(entry[1]));
	const features = landing.sections.find((section) => section.kind === 'features');
	const points = features?.kind === 'features' ? features.items : [];

	return (
		<div ref={root} className="tpl tpl-keynote" style={accent} data-hero={hero.image ? 'shot' : 'stage'}>
			<header className="kn-hero">
				<div className="kn-hero-scene">
					<HeroScene hero={hero} first={points[0]} />
					<div className="kn-hero-text">
						<p className="kn-brand" data-reveal="">
							{hero.icon && hero.image && <img className="kn-brand-icon" src={hero.icon} alt="" />}
							{hero.logo ? <img className="kn-logo" src={hero.logo} alt={hero.name} /> : <span>{hero.name}</span>}
						</p>
						<h1 data-reveal="" style={delay(1)}>
							{hero.headline}
						</h1>
						{hero.subhead && (
							<p className="kn-subhead" data-reveal="" style={delay(2)}>
								{hero.subhead}
							</p>
						)}
						<div data-reveal="" style={delay(3)}>
							<LandingLinks links={hero.links} className="kn-links" />
						</div>
					</div>
				</div>
				{meta.length > 0 && (
					<dl className="kn-meta" data-count={meta.length}>
						{meta.map(([label, value]) => (
							<div key={label}>
								<dt>{label}</dt>
								<dd>{value}</dd>
							</div>
						))}
					</dl>
				)}
			</header>

			<LandingSections landing={landing} renderers={RENDERERS} className="kn-scene" />

			<footer className="kn-closing">
				<div className="kn-closing-card" data-reveal="">
					{hero.icon && <img className="kn-closing-icon" src={hero.icon} alt="" />}
					<h2>{closing.title}</h2>
					{closing.lead && <p className="kn-closing-lead">{closing.lead}</p>}
					<LandingLinks links={closing.links} className="kn-links" />
				</div>
			</footer>
		</div>
	);
};

export default KeynotePage;
