// 잡지 표지와 특집 기사 (editorial). 표지(제호·발행 정보·표지 사진 위의 헤드라인) → 특집(넓은 단의 머리기사, 좁은 단의 사이드바:
// 진행 과정·숫자·기술 태그) → 칼럼(만든 방식, 괘선으로 나뉜 세 단) → 독자 가이드(쓰는 법) → 소특집(장마다) → 바이라인(맡은 일) → 판권(기술 사양)
// 없는 필드는 그 구역을 통째로 뺀다. 좁은 창에서는 한 단으로 흐른다
import React from 'react';
import type { Project, ProjectPoint } from '@/shared/profile';
import { cssVars } from '@/shared/lib/cssVars';
import { Facts, Links, Region } from '@/apps/safari/project/parts';
import { useReveal } from '@/apps/safari/project/reveal';
import '@/apps/safari/project/EditorialPage.css';

/** 작은 대문자 머리말 (구역 이름 위에 붙는 "특집", "칼럼" 같은 꼬리표) */
const Kicker: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="mg-kicker">{children}</p>;

/** 기사 사진과 캡션: 그림이 있는 꼭지에만 (머리기사 사진에는 실제 서비스 화면이라고 적는다) */
const Photo: React.FC<{ point: ProjectPoint; caption: string }> = ({ point, caption }) =>
	point.image ? (
		<figure className="mg-photo">
			<img src={point.image} alt={`${point.title} 화면`} loading="lazy" />
			<figcaption>{caption}</figcaption>
		</figure>
	) : null;

/** 표지: 제호(로고가 있으면 로고), 발행 정보 줄, 표지 사진 위에 헤드라인(tagline)이 겹친다 */
const Cover: React.FC<{ project: Project }> = ({ project }) => {
	const issue = [project.context, project.period, project.role].filter(Boolean);
	return (
		<header className="mg-cover">
			<p className="mg-masthead">
				{project.logo ? (
					<img src={project.logo} alt={project.name} className="mg-masthead-logo" />
				) : (
					<span className="mg-masthead-name">{project.name}</span>
				)}
			</p>
			<p className="mg-issue">
				{issue.map((item) => (
					<span key={item}>{item}</span>
				))}
			</p>
			<div className={project.image ? 'mg-cover-photo' : 'mg-cover-plain'}>
				{project.image && <img src={project.image} alt={`${project.name} 화면`} />}
				<div className="mg-cover-head">
					<h1>{project.tagline}</h1>
					<Links project={project} className="mg-links" />
				</div>
			</div>
		</header>
	);
};

/** 머리기사: 소개 글(첫 글자 드롭캡)과 주요 기능을 소제목 달린 본문으로, 그림이 있으면 기사 사진으로 */
const LeadStory: React.FC<{ project: Project }> = ({ project }) => (
	<Region label="머리기사" className="mg-story">
		<Kicker>특집 · Cover Story</Kicker>
		<h2 className="mg-story-title">{project.name}, 어떻게 만들었나</h2>
		<p className="mg-dropcap" data-reveal="ink">
			{project.description}
		</p>
		{project.highlights.length > 0 && (
			<Region label="주요 기능" as="div" className="mg-story-body">
				{project.highlights.map((point, i) => (
					<article key={point.title} className="mg-passage" data-reveal="ink" style={cssVars({ d: i % 3 })}>
						<h3>{point.title}</h3>
						<p>{point.body}</p>
						{point.detail && <p>{point.detail}</p>}
						<Photo point={point} caption={`▲ 실제 서비스 화면 · ${point.title}`} />
					</article>
				))}
			</Region>
		)}
	</Region>
);

/** 사이드바: 진행 과정 목록, 숫자 상자, 기술 태그 */
const Sidebar: React.FC<{ project: Project }> = ({ project }) => (
	<aside className="mg-side" aria-label="곁들이">
		{project.timeline && project.timeline.length > 0 && (
			<Region label="진행 과정" className="mg-box" data-reveal="ink">
				<h2 className="mg-box-title">진행 과정</h2>
				<ol className="mg-timeline">
					{project.timeline.map((step) => (
						<li key={`${step.date} ${step.label}`}>
							<time>{step.date}</time>
							<span>{step.label}</span>
						</li>
					))}
				</ol>
			</Region>
		)}
		{project.facts.length > 0 && (
			<Region label="숫자로 보기" className="mg-box mg-box-facts" data-reveal="ink" style={cssVars({ d: 1 })}>
				<h2 className="mg-box-title">숫자로 보면</h2>
				<Facts project={project} className="mg-facts" />
			</Region>
		)}
		{project.stack.length > 0 && (
			<Region label="기술" className="mg-box" data-reveal="ink" style={cssVars({ d: 2 })}>
				<h2 className="mg-box-title">함께 쓴 기술</h2>
				<ul className="mg-tags">
					{project.stack.map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
			</Region>
		)}
	</aside>
);

const EditorialPage: React.FC<{ project: Project }> = ({ project }) => {
	const root = useReveal<HTMLDivElement>();

	return (
		<div className="mg" ref={root}>
			<Cover project={project} />

			<div className="mg-feature">
				<LeadStory project={project} />
				<Sidebar project={project} />
			</div>

			{project.build.length > 0 && (
				<Region label="만든 방식" className="mg-section">
					<Kicker>칼럼 · Columns</Kicker>
					<h2 className="mg-section-title">만든 방식</h2>
					<div className="mg-columns">
						{project.build.map((point, i) => (
							<article key={point.title} className="mg-column" data-reveal="ink" style={cssVars({ d: i % 3 })}>
								<h3>{point.title}</h3>
								<p>{point.body}</p>
								{point.detail && <p>{point.detail}</p>}
							</article>
						))}
					</div>
				</Region>
			)}

			{project.usage && project.usage.length > 0 && (
				<Region label="쓰는 법" className="mg-section">
					<div className="mg-guide" data-reveal="ink">
						<Kicker>독자 가이드 · How to use</Kicker>
						<h2 className="mg-section-title">쓰는 법</h2>
						<dl>
							{project.usage.map((point) => (
								<div key={point.title}>
									<dt>{point.title}</dt>
									<dd>
										{point.body}
										{point.detail && ` ${point.detail}`}
									</dd>
								</div>
							))}
						</dl>
					</div>
				</Region>
			)}

			{project.chapters?.map((chapter, n) => (
				<Region key={chapter.title} label={chapter.title} className="mg-section mg-chapter">
					<Kicker>소특집 {String(n + 1).padStart(2, '0')}</Kicker>
					<h2 className="mg-section-title">{chapter.title}</h2>
					{chapter.lead && (
						<p className="mg-chapter-lead" data-reveal="ink">
							{chapter.lead}
						</p>
					)}
					{chapter.facts && chapter.facts.length > 0 && (
						<ul className="mg-chapter-facts">
							{chapter.facts.map((fact) => (
								<li key={fact.label}>
									<strong>{fact.value}</strong>
									<span>{fact.label}</span>
								</li>
							))}
						</ul>
					)}
					<div className="mg-chapter-points">
						{chapter.points.map((point, i) => (
							<article key={point.title} className="mg-passage" data-reveal="ink" style={cssVars({ d: i % 2 })}>
								<h3>{point.title}</h3>
								<p>{point.body}</p>
								{point.detail && <p>{point.detail}</p>}
								<Photo point={point} caption={point.title} />
							</article>
						))}
					</div>
					{chapter.image && (
						<figure className="mg-photo mg-chapter-photo" data-reveal="ink">
							<img src={chapter.image.src} alt={chapter.image.alt} loading="lazy" />
							<figcaption>{chapter.image.alt}</figcaption>
						</figure>
					)}
				</Region>
			))}

			<div className="mg-colophon">
				{project.contributions.length > 0 && (
					<Region label="맡은 일" className="mg-byline" data-reveal="ink">
						<Kicker>바이라인 · Byline</Kicker>
						<h2 className="mg-section-title">맡은 일</h2>
						{project.role && <p className="mg-byline-role">{project.role}</p>}
						<ul>
							{project.contributions.map((item) => (
								<li key={item}>{item}</li>
							))}
						</ul>
					</Region>
				)}
				{project.specs.length > 0 && (
					<Region label="기술 사양" className="mg-imprint" data-reveal="ink" style={cssVars({ d: 1 })}>
						<Kicker>판권 · Imprint</Kicker>
						<h2 className="mg-section-title">기술 사양</h2>
						<dl>
							{project.specs.map((spec) => (
								<div key={spec.label}>
									<dt>{spec.label}</dt>
									<dd>{spec.value}</dd>
								</div>
							))}
						</dl>
						<p className="mg-imprint-foot">
							<span>{project.name}</span>
							<span>{project.language}</span>
							{project.period && <span>{project.period}</span>}
						</p>
					</Region>
				)}
			</div>

			<footer className="mg-back">
				<p className="mg-back-line">{project.tagline}</p>
				<Links project={project} className="mg-links" />
			</footer>
		</div>
	);
};

export default EditorialPage;
