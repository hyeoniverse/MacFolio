// paper 템플릿: Notion 페이지처럼. 따뜻한 흰 종이 위의 한 단 문서다. 큰 페이지 아이콘과 제목, 속성 표, 표지 그림으로 열고,
// 구역은 잘 다듬은 문서의 블록(갤러리 보기, 번호 목록, 알림 상자, 표, 태그, 각주)으로 읽힌다. 계약은 templates/README.md
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
	type LandingPoint,
	type LandingSection,
	type LandingSectionKind,
	type SectionRenderers,
} from '@/apps/safari/project/landing';
import './Page.css';

/** Notion 태그의 차분한 색 (태그, 그림이 없는 표지) */
const TONES = ['blue', 'green', 'orange', 'purple', 'pink', 'yellow', 'brown', 'red'] as const;
type Tone = (typeof TONES)[number] | 'gray';

/** 같은 이름은 언제나 같은 색 */
const toneOf = (text: string): Tone => {
	let hash = 0;
	for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
	return TONES[hash % TONES.length];
};

/** 구역 제목 앞의 작은 아이콘 */
const SECTION_ICONS: Record<LandingSectionKind, string> = {
	stats: 'fa-table',
	features: 'fa-table-cells-large',
	screens: 'fa-images',
	steps: 'fa-list-ol',
	built: 'fa-screwdriver-wrench',
	stories: 'fa-book-open',
	controls: 'fa-keyboard',
	timeline: 'fa-calendar-days',
	tech: 'fa-code',
	role: 'fa-user',
	credits: 'fa-quote-left',
};

/** 구역 머리: 아이콘 달린 h2와 흐린 한 줄 */
const Head: React.FC<{ section: LandingSection; note?: string }> = ({ section, note }) => (
	<header className="pp-head">
		<h2>
			<i className={`fa-solid ${SECTION_ICONS[section.kind]}`} aria-hidden="true" />
			{section.label}
		</h2>
		<p>{note ?? sectionTitle(section)}</p>
	</header>
);

const Tag: React.FC<{ children: string }> = ({ children }) => (
	<span className="pp-tag" data-tone={toneOf(children)}>
		{children}
	</span>
);

/** 쉼표로 이어 쓴 값을 태그 여러 개로 (글로는 원래 문장 그대로 읽힌다) */
const Tags: React.FC<{ value: string }> = ({ value }) => {
	const parts = value
		.split(/\s*,\s*/)
		.map((part) => part.trim())
		.filter(Boolean);
	return (
		<span className="pp-tagrow">
			{parts.map((part, index) => (
				<React.Fragment key={`${part}-${index}`}>
					{index > 0 && <span className="pp-sep">, </span>}
					<Tag>{part}</Tag>
				</React.Fragment>
			))}
		</span>
	);
};

/** 숫자 묶음: 한 줄짜리 데이터베이스 표 */
const FactTable: React.FC<{ facts: ProjectFact[] }> = ({ facts }) => (
	<dl className="pp-facts" data-count={Math.min(facts.length, 4)}>
		{facts.map((fact) => (
			<div key={fact.label}>
				<dt>
					<i className="fa-solid fa-hashtag" aria-hidden="true" />
					{fact.label}
				</dt>
				<dd>{fact.value}</dd>
			</div>
		))}
	</dl>
);

/** 자세히: 펼치는 토글 블록 */
const Detail: React.FC<{ point: LandingPoint }> = ({ point }) =>
	point.detail ? (
		<details className="pp-toggle">
			<summary>자세히 보기</summary>
			<p>{point.detail}</p>
		</details>
	) : null;

/** 항목의 그림·영상 전부 (문서 안의 그림 블록) */
const PointMedia: React.FC<{ point: LandingPoint; from?: number }> = ({ point, from = 0 }) => {
	const media = point.media.slice(from);
	return media.length > 0 ? (
		<div className="pp-media" data-count={Math.min(media.length, 3)}>
			{media.map((item) => (
				<Media key={item.src} media={item} />
			))}
		</div>
	) : null;
};

/** 그림이 없는 표지: 태그 색을 옅게 깐 면과 큰 아이콘 (장식) */
const ToneCover: React.FC<{ icon: string; tone: Tone }> = ({ icon, tone }) => (
	<div className="pp-tone-cover" data-tone={tone} aria-hidden="true">
		<i className={`fa-solid ${icon}`} />
	</div>
);

/** 갤러리 보기의 카드 한 장: 표지(첫 그림, 없으면 색 면), 제목, 묶음 태그, 본문, 나머지 그림, 토글 */
const Card: React.FC<{ point: LandingPoint; index: number; wide: boolean }> = ({ point, index, wide }) => {
	const icon = iconOf(point, index);
	return (
		<article className="pp-card" aria-label={point.title} data-wide={wide ? '' : undefined} data-reveal="">
			<div className="pp-card-cover">
				{point.media[0] ? (
					<Media media={point.media[0]} />
				) : (
					<ToneCover icon={icon} tone={TONES[index % TONES.length]} />
				)}
			</div>
			<div className="pp-card-body">
				<h3>
					<i className={`fa-solid ${icon}`} aria-hidden="true" />
					{point.title}
				</h3>
				{point.group && <Tag>{point.group}</Tag>}
				<p>{point.body}</p>
				<PointMedia point={point} from={1} />
				<Detail point={point} />
			</div>
		</article>
	);
};

const RENDERERS: SectionRenderers = {
	stats: ({ section }) => (
		<>
			<h2 className="pp-db-title">
				<i className={`fa-solid ${SECTION_ICONS.stats}`} aria-hidden="true" />
				{section.label}
			</h2>
			<FactTable facts={section.facts} />
		</>
	),
	features: ({ section }) => (
		<>
			<Head section={section} />
			<div className="pp-gallery">
				{section.items.map((point, index) => (
					<Card key={point.title} point={point} index={index} wide={section.items.length % 2 === 1 && index === 0} />
				))}
			</div>
		</>
	),
	screens: ({ section }) => (
		<>
			<Head section={section} />
			<ul className="pp-shots">
				{section.shots.map((shot) => (
					<li key={shot.src} data-reveal="">
						<Media media={shot} />
						<span>{shot.caption}</span>
					</li>
				))}
			</ul>
		</>
	),
	steps: ({ section }) => (
		<>
			<Head section={section} />
			<ol className="pp-steps">
				{section.items.map((point, index) => (
					<li key={point.title}>
						<span className="pp-step-no" aria-hidden="true">
							{index + 1}.
						</span>
						<div>
							<h3>
								{point.icon && <i className={`fa-solid ${point.icon}`} aria-hidden="true" />}
								{point.title}
							</h3>
							<p>{point.body}</p>
							<PointMedia point={point} />
							<Detail point={point} />
						</div>
					</li>
				))}
			</ol>
		</>
	),
	built: ({ section }) => (
		<>
			<Head section={section} />
			<div className="pp-callouts">
				{section.items.map((point, index) => (
					<aside key={point.title} className="pp-callout" aria-label={point.title} data-reveal="">
						<span className="pp-callout-icon" aria-hidden="true">
							<i className={`fa-solid ${iconOf(point, index + 2)}`} />
						</span>
						<div>
							<h3>{point.title}</h3>
							<p>{point.body}</p>
							<PointMedia point={point} />
							<Detail point={point} />
						</div>
					</aside>
				))}
			</div>
		</>
	),
	stories: ({ section }) => (
		<>
			<Head section={section} />
			<div className="pp-stories">
				{section.stories.map((story) => (
					<article key={story.title} className="pp-story" aria-label={story.title}>
						<h3>
							<i className="fa-regular fa-file-lines" aria-hidden="true" />
							{story.title}
						</h3>
						{story.lead && (
							<div className="pp-callout" data-tone="yellow">
								<span className="pp-callout-icon" aria-hidden="true">
									<i className="fa-regular fa-lightbulb" />
								</span>
								<p className="pp-callout-lead">{story.lead}</p>
							</div>
						)}
						{story.facts.length > 0 && <FactTable facts={story.facts} />}
						{story.points.length > 0 && (
							<ul className="pp-bullets">
								{story.points.map((point) => (
									<li key={point.title}>
										<strong>{point.title}</strong> {point.body}
										<PointMedia point={point} />
										<Detail point={point} />
									</li>
								))}
							</ul>
						)}
						{story.image && (
							<figure className="pp-figure">
								<Media media={story.image} />
								<figcaption>{story.image.alt}</figcaption>
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
			<table className="pp-table">
				<thead>
					<tr>
						<th scope="col">
							<i className="fa-regular fa-keyboard" aria-hidden="true" />키
						</th>
						<th scope="col">
							<span className="pp-aa" aria-hidden="true">
								Aa
							</span>
							하는 일
						</th>
					</tr>
				</thead>
				<tbody>
					{section.controls.map((control) => (
						<tr key={control.label}>
							<td className="pp-keys">
								{control.keys.map((key) => (
									<kbd key={key}>{key}</kbd>
								))}
							</td>
							<td>{control.label}</td>
						</tr>
					))}
				</tbody>
			</table>
		</>
	),
	timeline: ({ section }) => (
		<>
			<Head section={section} />
			<table className="pp-table pp-timeline">
				<thead>
					<tr>
						<th scope="col">
							<i className="fa-regular fa-calendar" aria-hidden="true" />
							날짜
						</th>
						<th scope="col">
							<span className="pp-aa" aria-hidden="true">
								Aa
							</span>
							한 일
						</th>
					</tr>
				</thead>
				<tbody>
					{section.entries.map((entry) => (
						<tr key={`${entry.date}-${entry.label}`}>
							<td className="pp-date">{entry.date}</td>
							<td>{entry.label}</td>
						</tr>
					))}
				</tbody>
			</table>
		</>
	),
	tech: ({ section }) => (
		<>
			<Head section={section} />
			{section.stack.length > 0 && (
				<ul className="pp-stack" aria-label="쓴 기술">
					{section.stack.map((item) => (
						<li key={item}>
							<Tag>{item}</Tag>
						</li>
					))}
				</ul>
			)}
			{section.specs.length > 0 && (
				<table className="pp-table">
					<thead>
						<tr>
							<th scope="col">
								<span className="pp-aa" aria-hidden="true">
									Aa
								</span>
								분류
							</th>
							<th scope="col">
								<i className="fa-solid fa-list-ul" aria-hidden="true" />
								기술
							</th>
						</tr>
					</thead>
					<tbody>
						{section.specs.map((spec) => (
							<tr key={spec.label}>
								<th scope="row">{spec.label}</th>
								<td>
									<Tags value={spec.value} />
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
			{section.structure && (
				<figure className="pp-code">
					<figcaption>폴더 구조</figcaption>
					<pre>{section.structure}</pre>
				</figure>
			)}
		</>
	),
	role: ({ section }) => (
		<>
			<Head section={section} note={section.role} />
			{(section.context || section.period) && (
				<p className="pp-role-meta">{[section.context, section.period].filter(Boolean).join(' · ')}</p>
			)}
			{section.contributions.length > 0 && (
				<ul className="pp-bullets">
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
			<ol className="pp-notes">
				{section.credits.map((credit, index) => (
					<li key={`${credit.role}-${credit.name}`}>
						<span className="pp-note-no" aria-hidden="true">
							{index + 1}
						</span>
						<span>
							<span className="pp-note-role">{credit.role}</span>{' '}
							{credit.href ? (
								<a href={credit.href} target="_blank" rel="noopener noreferrer">
									{credit.name}
								</a>
							) : (
								<strong>{credit.name}</strong>
							)}
							, {credit.by}
							{credit.note && <span className="pp-note-extra">{credit.note}</span>}
						</span>
					</li>
				))}
			</ol>
		</>
	),
};

/** 마무리의 손으로 그린 듯한 선 그림: 종이 한 장과 연필 (장식) */
const Sketch: React.FC = () => (
	<svg className="pp-sketch" viewBox="0 0 200 120" aria-hidden="true" focusable="false">
		<g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
			<path d="M62 14.5c14-.6 34-.3 50 .2l14.5 14.8c.4 22 .2 52-.4 77.3-21 .6-44 .5-64.6-.2-.6-28-.8-62 .5-92.1Z" />
			<path d="M112 14.8c.3 5 .1 10-.2 14.6 4.8.3 9.8.1 14.6 0" />
			<path d="M74 40c11-.4 23-.3 33 .3M74 52c16-.5 30-.3 40 .2M74 64c12-.3 26-.4 38 .1M74 76c8-.2 15-.1 21 .3" />
			<path d="M76 90.5c3-3 5-3 7 0s4 3 6.5 0 4.5-3 7 .2" />
			<path d="M139 98.5 168 46.8c1.6-2.8 5-3.6 7.6-2.1 2.6 1.6 3.4 4.9 1.8 7.6l-29 51.5-9.6 4.6.3-10Z" />
			<path d="m164.4 53 9.4 5.4M139.1 98.6l9.3 5.2" />
			<path d="M28 106c30-1.5 60-.6 92-1.2M134 106c14 0 24-.4 38-.8" />
		</g>
	</svg>
);

const PROPERTY_ICONS = {
	context: 'fa-solid fa-align-left',
	role: 'fa-regular fa-user',
	period: 'fa-regular fa-calendar',
	stack: 'fa-solid fa-list-ul',
};

const PaperPage: React.FC<{ project: Project }> = ({ project }) => {
	const landing = useLanding(project);
	const root = useReveal<HTMLDivElement>();
	const accent = useLandingAccent(project.icon);
	const { hero, closing } = landing;
	const stack = landing.sections.find((section) => section.kind === 'tech')?.stack ?? [];
	const properties = (
		[
			{ key: 'context', label: '프로젝트', value: hero.meta.context },
			{ key: 'role', label: '역할', value: hero.meta.role },
			{ key: 'period', label: '기간', value: hero.meta.period },
		] as const
	).filter((row) => row.value);
	const hasProps = properties.length > 0 || stack.length > 0;

	return (
		<div ref={root} className="tpl tpl-paper" style={accent}>
			<header className="pp-hero">
				<div className="pp-doc">
					<span className="pp-page-icon" data-tone={hero.icon ? undefined : 'gray'} aria-hidden="true">
						{hero.icon ? <img src={hero.icon} alt="" /> : <i className="fa-regular fa-file-lines" />}
					</span>
					{(hero.logo || hero.headline !== hero.name) && (
						<p className="pp-crumb">
							{hero.logo ? <img className="pp-logo" src={hero.logo} alt={hero.name} /> : hero.name}
						</p>
					)}
					<h1>{hero.headline}</h1>
					{hero.subhead && <p className="pp-lead">{hero.subhead}</p>}
					{hasProps && (
						<dl className="pp-props">
							{properties.map(({ key, label, value }) => (
								<div key={key}>
									<dt>
										<i className={PROPERTY_ICONS[key]} aria-hidden="true" />
										{label}
									</dt>
									<dd>{value}</dd>
								</div>
							))}
							{stack.length > 0 && (
								<div>
									<dt>
										<i className={PROPERTY_ICONS.stack} aria-hidden="true" />
										기술
									</dt>
									<dd className="pp-tagrow">
										{stack.map((item) => (
											<Tag key={item}>{item}</Tag>
										))}
									</dd>
								</div>
							)}
						</dl>
					)}
					<LandingLinks links={hero.links} className="pp-links" />
				</div>
				{hero.image && (
					<figure className="pp-cover">
						<Media media={hero.image} eager />
					</figure>
				)}
			</header>

			<div className="pp-doc pp-body">
				<LandingSections landing={landing} renderers={RENDERERS} className="pp-section" />
			</div>

			<footer className="pp-closing">
				<Sketch />
				<h2>{closing.title}</h2>
				{closing.lead && <p>{closing.lead}</p>}
				<LandingLinks links={closing.links} className="pp-links" />
			</footer>
		</div>
	);
};

export default PaperPage;
