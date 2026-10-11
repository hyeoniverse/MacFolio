import React, { useState } from 'react';
import type { Project, ProjectPoint } from '@/shared/profile';
import { FactValue, Links, Region } from '@/apps/safari/project/parts';
import { useReveal } from '@/apps/safari/project/reveal';
import '@/apps/safari/project/ShowcasePage.css';

const isVideo = (src: string) => src.endsWith('.mp4');

/** 그림이나 짧은 영상 한 장 */
const Media: React.FC<{ src: string; alt: string; className?: string }> = ({ src, alt, className }) =>
	isVideo(src) ? (
		<video className={className} src={src} muted loop playsInline autoPlay aria-label={alt} />
	) : (
		<img className={className} src={src} alt={alt} loading="lazy" />
	);

/**
 * 맨 위: 앱 아이콘 타일, 이름, 큰 제목, 소개, 링크. 오른쪽(넓은 창)에는 대표 화면이 기울어진 채 떠 있다.
 * 바탕은 어두운 띠에 강조색 빛이 번진다
 */
const Hero: React.FC<{ project: Project; shots: string[] }> = ({ project, shots }) => (
	<header className="sc-hero" data-reveal="">
		<div className="sc-hero-text">
			<div className="sc-brand">
				{project.icon && <img className="sc-tile" src={project.icon} alt="" />}
				{project.logo ? <img className="sc-logo" src={project.logo} alt={project.name} /> : <span>{project.name}</span>}
			</div>
			<h1>{project.tagline || project.name}</h1>
			{project.description && <p className="sc-lead">{project.description}</p>}
			<p className="sc-meta">{[project.context, project.role, project.period].filter(Boolean).join(' · ')}</p>
			<Links project={project} className="sp-links sc-links" />
			{project.stack.length > 0 && (
				<ul className="sc-stack" aria-label="기술">
					{project.stack.map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
			)}
		</div>
		{shots[0] && (
			<div className="sc-hero-art" aria-hidden="true">
				<Media src={shots[0]} alt="" className="sc-hero-shot" />
				{shots[1] && <Media src={shots[1]} alt="" className="sc-hero-shot sc-hero-shot-back" />}
			</div>
		)}
	</header>
);

/**
 * 벤토: 첫 카드는 크게(그림이 있으면 그림이 바탕), 나머지는 작게. 그림이 있는 카드는 그림을 아래에 깔고 글을 위에 둔다
 */
const Bento: React.FC<{ points: ProjectPoint[]; fallback: string[] }> = ({ points, fallback }) => (
	<ul className="sc-bento">
		{points.map((point, index) => {
			const image =
				point.image ?? point.shots?.[0]?.src ?? (index === 0 ? fallback[index % fallback.length] : undefined);
			return (
				<li key={point.title} className={index === 0 ? 'wide' : ''} data-reveal="">
					{image && <Media src={image} alt="" className="sc-bento-bg" />}
					<div className="sc-bento-text">
						{point.icon && <i className={`fa-solid ${point.icon}`} aria-hidden="true" />}
						<h3>{point.title}</h3>
						<p>{point.body}</p>
					</div>
				</li>
			);
		})}
	</ul>
);

/** 화면 모음: 옆으로 넘기는 띠. 누르면 크게 */
const Strip: React.FC<{ shots: { src: string; caption: string }[] }> = ({ shots }) => {
	const [open, setOpen] = useState<number | null>(null);
	return (
		<>
			<ul className="sc-strip" aria-label="화면 모음">
				{shots.map((shot, index) => (
					<li key={shot.src} data-reveal="">
						<button type="button" aria-label={`${shot.caption} 크게 보기`} onClick={() => setOpen(index)}>
							<Media src={shot.src} alt={shot.caption} />
						</button>
						<figcaption>{shot.caption}</figcaption>
					</li>
				))}
			</ul>
			{open !== null && (
				<div className="sc-lightbox" role="dialog" aria-label={shots[open].caption} onClick={() => setOpen(null)}>
					<Media src={shots[open].src} alt={shots[open].caption} />
					<p>{shots[open].caption}</p>
				</div>
			)}
		</>
	);
};

/**
 * 어떤 프로젝트에나 맞는 모양(showcase): 어두운 띠의 큰 제목과 떠 있는 대표 화면 → 숫자 띠 → 주요 기능 벤토 →
 * 화면 모음 띠 → 만든 방식(번갈아 좌우) → 쓰는 법 → 진행 과정 → 기술 사양. 없는 묶음은 통째로 빠진다
 */
const ShowcasePage: React.FC<{ project: Project }> = ({ project }) => {
	const root = useReveal<HTMLDivElement>();
	const gallery = project.gallery ?? [];
	// 대표 화면과 화면 모음을 합친 그림 목록 (겹치지 않게)
	const shots = [...new Set([project.image, ...gallery.map((shot) => shot.src)].filter(Boolean))] as string[];
	const stillShots = shots.filter((src) => !isVideo(src));

	return (
		<div ref={root} className="sc">
			<Hero project={project} shots={stillShots} />

			{project.facts.length > 0 && (
				<ul className="sc-facts" aria-label="한눈에" data-reveal="">
					{project.facts.map((fact) => (
						<li key={fact.label}>
							<strong>
								<FactValue text={fact.value} />
							</strong>
							<span>{fact.label}</span>
						</li>
					))}
				</ul>
			)}

			{project.highlights.length > 0 && (
				<Region label="주요 기능" className="sc-section">
					<h2 data-reveal="">주요 기능</h2>
					<Bento points={project.highlights} fallback={stillShots.slice(1)} />
				</Region>
			)}

			{gallery.length > 1 && (
				<Region label="화면 모음" className="sc-section sc-wide">
					<h2 data-reveal="">화면 모음</h2>
					<Strip shots={gallery} />
				</Region>
			)}

			{project.build.length > 0 && (
				<Region label="만든 방식" className="sc-section">
					<h2 data-reveal="">만든 방식</h2>
					<ol className="sc-zig">
						{project.build.map((point, index) => {
							const image = point.image ?? point.shots?.[0]?.src;
							return (
								<li key={point.title} data-reveal="">
									<div className="sc-zig-text">
										<span className="sc-zig-num">{String(index + 1).padStart(2, '0')}</span>
										<h3>{point.title}</h3>
										<p>{point.body}</p>
										{point.detail && <p className="sc-zig-detail">{point.detail}</p>}
									</div>
									{image && <Media src={image} alt={`${point.title} 화면`} className="sc-zig-media" />}
								</li>
							);
						})}
					</ol>
				</Region>
			)}

			{project.usage && project.usage.length > 0 && (
				<Region label="쓰는 법" className="sc-section">
					<h2 data-reveal="">쓰는 법</h2>
					<ol className="sc-steps">
						{project.usage.map((point, index) => (
							<li key={point.title} data-reveal="">
								<span className="sc-step-num">{index + 1}</span>
								<div>
									<h3>{point.title}</h3>
									<p>{point.body}</p>
								</div>
							</li>
						))}
					</ol>
				</Region>
			)}

			{project.timeline && project.timeline.length > 0 && (
				<Region label="진행 과정" className="sc-section">
					<h2 data-reveal="">진행 과정</h2>
					<ol className="sc-timeline">
						{project.timeline.map((entry) => (
							<li key={`${entry.date}-${entry.label}`} data-reveal="">
								<time>{entry.date}</time>
								<span>{entry.label}</span>
							</li>
						))}
					</ol>
				</Region>
			)}

			{(project.specs.length > 0 || project.contributions.length > 0) && (
				<Region label="기술 사양" className="sc-section sc-specs-section">
					<div className="sc-specs" data-reveal="">
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

			<footer className="sc-foot" data-reveal="">
				<div className="sc-brand">
					{project.icon && <img className="sc-tile" src={project.icon} alt="" />}
					<span>{project.name}</span>
				</div>
				<Links project={project} className="sp-links sc-links" />
			</footer>
		</div>
	);
};

export default ShowcasePage;
