// paper 템플릿: Notion 문서처럼. 따뜻한 흰 바탕의 한 단 문서, 표지 그림과 그 위에 걸친 아이콘, 속성 표,
// 펼치는 토글, 알림 상자(callout), 표와 할 일 목록. 차분하게 읽히는 본문이 중심이다. 계약은 templates/README.md
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
	type LandingPoint,
	type LandingSection,
	type SectionRenderers,
} from '@/apps/safari/project/landing';
import './Page.css';

/** 구역 머리: 문서의 큰 제목(구역 이름)과 흐린 한 줄 */
const Head: React.FC<{ section: LandingSection; note?: string }> = ({ section, note }) => (
	<header className="pp-head">
		<h2>{section.label}</h2>
		<p>{note ?? sectionTitle(section)}</p>
	</header>
);

/** 항목의 그림·영상 (문서 안의 그림 블록) */
const PointMedia: React.FC<{ point: LandingPoint }> = ({ point }) =>
	point.media.length > 0 ? (
		<div className="pp-media" data-count={Math.min(point.media.length, 3)}>
			{point.media.map((media) => (
				<Media key={media.src} media={media} />
			))}
		</div>
	) : null;

/** 자세히: 펼치는 토글 */
const Detail: React.FC<{ point: LandingPoint }> = ({ point }) =>
	point.detail ? (
		<details className="pp-toggle">
			<summary>자세히 보기</summary>
			<p>{point.detail}</p>
		</details>
	) : null;

const RENDERERS: SectionRenderers = {
	stats: ({ section }) => (
		<>
			<h2 className="visually-hidden">{section.label}</h2>
			<ul className="pp-stats">
				{section.facts.map((fact) => (
					<li key={fact.label} className="pp-callout">
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
			<div className="pp-blocks">
				{section.items.map((point, index) => (
					<article key={point.title} className="pp-block" aria-label={point.title} data-reveal="">
						<h3>
							<span className="pp-emoji" aria-hidden="true">
								<i className={`fa-solid ${iconOf(point, index)}`} />
							</span>
							{point.title}
						</h3>
						<p>{point.body}</p>
						<PointMedia point={point} />
						<Detail point={point} />
					</article>
				))}
			</div>
		</>
	),
	screens: ({ section }) => (
		<>
			<Head section={section} />
			<ul className="pp-gallery">
				{section.shots.map((shot) => (
					<li key={shot.src}>
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
			<ol className="pp-numbered">
				{section.items.map((point) => (
					<li key={point.title}>
						<strong>{point.title}</strong>
						<p>{point.body}</p>
						<PointMedia point={point} />
						<Detail point={point} />
					</li>
				))}
			</ol>
		</>
	),
	built: ({ section }) => (
		<>
			<Head section={section} />
			<div className="pp-blocks">
				{section.items.map((point, index) => (
					<aside key={point.title} className="pp-callout pp-callout-block" aria-label={point.title}>
						<span className="pp-emoji" aria-hidden="true">
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
			{section.stories.map((story) => (
				<article key={story.title} className="pp-story" aria-label={story.title}>
					<h3>{story.title}</h3>
					{story.lead && <blockquote className="pp-quote">{story.lead}</blockquote>}
					{story.facts.length > 0 && (
						<ul className="pp-stats">
							{story.facts.map((fact) => (
								<li key={fact.label} className="pp-callout">
									<strong>{fact.value}</strong>
									<span>{fact.label}</span>
								</li>
							))}
						</ul>
					)}
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
		</>
	),
	controls: ({ section }) => (
		<>
			<Head section={section} />
			<table className="pp-table">
				<thead>
					<tr>
						<th scope="col">키</th>
						<th scope="col">하는 일</th>
					</tr>
				</thead>
				<tbody>
					{section.controls.map((control) => (
						<tr key={control.label}>
							<td>
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
			<table className="pp-table">
				<thead>
					<tr>
						<th scope="col">때</th>
						<th scope="col">한 일</th>
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
				<ul className="pp-tags" aria-label="쓴 기술">
					{section.stack.map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
			)}
			{section.specs.length > 0 && (
				<table className="pp-table">
					<thead>
						<tr>
							<th scope="col">분류</th>
							<th scope="col">기술</th>
						</tr>
					</thead>
					<tbody>
						{section.specs.map((spec) => (
							<tr key={spec.label}>
								<th scope="row">{spec.label}</th>
								<td>{spec.value}</td>
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
				<p className="pp-muted">{[section.context, section.period].filter(Boolean).join(' · ')}</p>
			)}
			{section.contributions.length > 0 && (
				<ul className="pp-todos">
					{section.contributions.map((item) => (
						<li key={item}>
							<span className="pp-check" aria-hidden="true">
								<i className="fa-solid fa-check" />
							</span>
							{item}
						</li>
					))}
				</ul>
			)}
		</>
	),
	credits: ({ section }) => (
		<>
			<Head section={section} />
			<table className="pp-table">
				<thead>
					<tr>
						<th scope="col">맡은 부분</th>
						<th scope="col">이름</th>
						<th scope="col">만든 사람</th>
					</tr>
				</thead>
				<tbody>
					{section.credits.map((credit) => (
						<tr key={`${credit.role}-${credit.name}`}>
							<td>{credit.role}</td>
							<td>
								{credit.href ? (
									<a href={credit.href} target="_blank" rel="noopener noreferrer">
										{credit.name}
									</a>
								) : (
									credit.name
								)}
								{credit.note && <span className="pp-note">{credit.note}</span>}
							</td>
							<td>{credit.by}</td>
						</tr>
					))}
				</tbody>
			</table>
		</>
	),
};

const PaperPage: React.FC<{ project: Project }> = ({ project }) => {
	const landing = useLanding(project);
	const root = useReveal<HTMLDivElement>();
	const accent = useLandingAccent(project.icon);
	const { hero, closing } = landing;
	const properties: [string, string][] = [
		['프로젝트', hero.meta.context],
		['역할', hero.meta.role],
		['기간', hero.meta.period],
	].filter((row): row is [string, string] => Boolean(row[1]));

	return (
		<div ref={root} className="tpl tpl-paper" style={accent}>
			<header className="pp-hero">
				<div className="pp-cover" data-empty={hero.image ? undefined : ''}>
					{hero.image && <Media media={hero.image} eager />}
				</div>
				<div className="pp-doc">
					<span className="pp-page-icon" aria-hidden="true">
						{hero.icon ? <img src={hero.icon} alt="" /> : <i className="fa-regular fa-file-lines" />}
					</span>
					<p className="pp-name">
						{hero.logo ? <img className="pp-logo" src={hero.logo} alt={hero.name} /> : hero.name}
					</p>
					<h1>{hero.headline}</h1>
					{properties.length > 0 && (
						<dl className="pp-props">
							{properties.map(([label, value]) => (
								<div key={label}>
									<dt>{label}</dt>
									<dd>{value}</dd>
								</div>
							))}
						</dl>
					)}
					{hero.subhead && <p className="pp-subhead">{hero.subhead}</p>}
					<LandingLinks links={hero.links} className="pp-links" />
				</div>
			</header>

			<div className="pp-doc pp-body">
				<LandingSections landing={landing} renderers={RENDERERS} className="pp-section" />

				<footer className="pp-closing">
					<div className="pp-callout pp-callout-block">
						<span className="pp-emoji" aria-hidden="true">
							<i className="fa-solid fa-arrow-up-right-from-square" />
						</span>
						<div>
							<h2>{closing.title}</h2>
							{closing.lead && <p>{closing.lead}</p>}
							<LandingLinks links={closing.links} className="pp-links" />
						</div>
					</div>
				</footer>
			</div>
		</div>
	);
};

export default PaperPage;
