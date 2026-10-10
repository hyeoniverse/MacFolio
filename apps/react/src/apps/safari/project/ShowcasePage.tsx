import React from 'react';
import type { Project, ProjectPoint } from '@/shared/profile';
import { Facts, Links, Region, Shot } from '@/apps/safari/project/parts';
import { useReveal } from '@/apps/safari/project/reveal';
import '@/apps/safari/project/ShowcasePage.css';

/** 제목·설명 카드 묶음 (주요 기능, 만든 방식, 쓰는 법) */
const Cards: React.FC<{ points: ProjectPoint[] }> = ({ points }) => (
	<ul className="sc-cards">
		{points.map((point) => (
			<li key={point.title}>
				{point.icon && <i className={`fa-solid ${point.icon}`} aria-hidden="true" />}
				<h3>{point.title}</h3>
				<p>{point.body}</p>
				{point.detail && <p className="sc-detail">{point.detail}</p>}
				{point.image && <img src={point.image} alt={`${point.title} 화면`} loading="lazy" />}
			</li>
		))}
	</ul>
);

/**
 * 어떤 프로젝트에나 맞는 모양(showcase): 큰 제목과 링크 → 숫자 → 대표 화면 → 주요 기능 → 만든 방식 → 화면 모음 →
 * 쓰는 법·진행 과정 → 기술 사양. 특정 프로젝트에 맞춘 다른 모양과 달리, 적은 내용만 있어도 빈 자리 없이 그려진다.
 * 새 프로젝트의 기본 모양이다
 */
const ShowcasePage: React.FC<{ project: Project }> = ({ project }) => {
	const root = useReveal<HTMLDivElement>();
	return (
		<div ref={root} className="sc">
			<header className="sc-hero">
				{project.logo ? (
					<img className="sc-logo" src={project.logo} alt={project.name} />
				) : (
					<span className="sc-name">
						{project.icon && <img src={project.icon} alt="" />}
						{project.name}
					</span>
				)}
				<h1>{project.tagline || project.name}</h1>
				{project.description && <p className="sc-lead">{project.description}</p>}
				<p className="sc-context">{[project.context, project.role, project.period].filter(Boolean).join(' · ')}</p>
				<Links project={project} className="sp-links sc-links" />
			</header>

			{project.facts.length > 0 && <Facts project={project} className="sp-facts sc-facts" />}

			{(project.image || project.art) && (
				<div className="sc-shot" data-reveal>
					{project.art && <img className="sc-art" src={project.art} alt="" />}
					<Shot project={project} className="sc-figure" />
				</div>
			)}

			{project.highlights.length > 0 && (
				<Region label="주요 기능" className="sc-section" data-reveal>
					<h2>주요 기능</h2>
					<Cards points={project.highlights} />
				</Region>
			)}

			{project.build.length > 0 && (
				<Region label="만든 방식" className="sc-section sc-alt" data-reveal>
					<h2>만든 방식</h2>
					<Cards points={project.build} />
				</Region>
			)}

			{project.gallery && project.gallery.length > 0 && (
				<Region label="화면 모음" className="sc-section" data-reveal>
					<h2>화면 모음</h2>
					<ul className="sc-gallery">
						{project.gallery.map((shot) => (
							<li key={shot.src}>
								{shot.src.endsWith('.mp4') ? (
									<video src={shot.src} muted loop playsInline autoPlay />
								) : (
									<img src={shot.src} alt={shot.caption} loading="lazy" />
								)}
								<figcaption>{shot.caption}</figcaption>
							</li>
						))}
					</ul>
				</Region>
			)}

			{project.usage && project.usage.length > 0 && (
				<Region label="쓰는 법" className="sc-section sc-alt" data-reveal>
					<h2>쓰는 법</h2>
					<Cards points={project.usage} />
				</Region>
			)}

			{project.timeline && project.timeline.length > 0 && (
				<Region label="진행 과정" className="sc-section" data-reveal>
					<h2>진행 과정</h2>
					<ol className="sc-timeline">
						{project.timeline.map((entry) => (
							<li key={`${entry.date}-${entry.label}`}>
								<time>{entry.date}</time>
								<span>{entry.label}</span>
							</li>
						))}
					</ol>
				</Region>
			)}

			{(project.specs.length > 0 || project.stack.length > 0 || project.contributions.length > 0) && (
				<Region label="기술 사양" className="sc-section sc-alt" data-reveal>
					<h2>기술 사양</h2>
					<div className="sc-specs">
						{project.specs.length > 0 && (
							<dl>
								{project.specs.map((spec) => (
									<div key={spec.label}>
										<dt>{spec.label}</dt>
										<dd>{spec.value}</dd>
									</div>
								))}
							</dl>
						)}
						{project.stack.length > 0 && (
							<ul className="sc-stack" aria-label="기술">
								{project.stack.map((item) => (
									<li key={item}>{item}</li>
								))}
							</ul>
						)}
						{project.contributions.length > 0 && (
							<Region label="맡은 일" as="div" className="sc-contributions">
								<h3>맡은 일</h3>
								<ul>
									{project.contributions.map((item) => (
										<li key={item}>{item}</li>
									))}
								</ul>
							</Region>
						)}
					</div>
				</Region>
			)}

			<footer className="sc-foot">
				<Links project={project} className="sp-links sc-links" />
			</footer>
		</div>
	);
};

export default ShowcasePage;
