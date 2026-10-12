import React, { useState } from 'react';
import type { Project, ProjectPoint } from '@/shared/profile';
import { Links, Region } from '@/apps/safari/project/parts';
import { useReveal } from '@/apps/safari/project/reveal';
import {
	BentoGrid,
	CtaBand,
	DeviceFrame,
	FeatureVisual,
	GlowBackdrop,
	LogoStrip,
	MockScreen,
	SectionHeader,
	StatBand,
	iconOf,
	useLandingAccent,
	type BentoCell,
} from '@/apps/safari/project/landing';
import '@/apps/safari/project/ShowcasePage.css';

const isVideo = (src: string) => src.endsWith('.mp4');

/** 언어와 기술을 한 줄로 (언어가 기술에 이미 있으면 한 번만) */
const techOf = (project: Project) =>
	project.language && !project.stack.includes(project.language) ? [project.language, ...project.stack] : project.stack;

/** 항목의 대표 그림 (그림, 없으면 화면 여러 장의 첫 장) */
const imageOf = (point: ProjectPoint) => point.image ?? point.shots?.[0]?.src;

/** 그림이나 짧은 영상 한 장 */
const Media: React.FC<{ src: string; alt: string; className?: string }> = ({ src, alt, className }) =>
	isVideo(src) ? (
		<video className={className} src={src} muted loop playsInline autoPlay aria-label={alt || undefined} />
	) : (
		<img className={className} src={src} alt={alt} loading="lazy" />
	);

/**
 * 맨 위 (Stripe식): 밝은 바탕 위로 비스듬한 색 띠가 흐르고, 왼쪽에 이름 배지·큰 한 줄·소개·단추·기술 칩,
 * 오른쪽에 브라우저 틀에 담긴 대표 화면과 그 앞에 겹친 휴대폰 화면. 대표 화면이 없으면 프로젝트 데이터로 그린 가짜 화면
 */
const Hero: React.FC<{ project: Project; shots: string[] }> = ({ project, shots }) => {
	const tech = techOf(project);
	const meta = [project.role, project.period].filter(Boolean);
	return (
		<header className="sc-hero">
			<GlowBackdrop tone="light" pattern="grid" focus="side" />
			<span className="sc-ribbon" aria-hidden="true" />
			<div className="sc-hero-inner">
				<div className="sc-hero-text">
					<div className="sc-brand">
						{project.icon && <img className="sc-tile" src={project.icon} alt="" />}
						{project.logo ? (
							<img className="sc-logo" src={project.logo} alt={project.name} />
						) : (
							<span>{project.name}</span>
						)}
						{project.context && <span className="sc-badge">{project.context}</span>}
					</div>
					<h1>{project.tagline || project.name}</h1>
					{project.description && <p className="sc-lead">{project.description}</p>}
					<Links project={project} className="sp-links sc-links" />
					{meta.length > 0 && <p className="sc-meta">{meta.join(' · ')}</p>}
					{tech.length > 0 && (
						<ul className="sc-stack" aria-label="기술">
							{tech.map((item) => (
								<li key={item}>{item}</li>
							))}
						</ul>
					)}
				</div>
				<div className="sc-hero-art" aria-hidden="true">
					<DeviceFrame kind="browser" url={project.demo} glow className="sc-hero-device">
						{shots[0] ? (
							<Media src={shots[0]} alt="" className="sc-hero-shot lk-device-media" />
						) : (
							<MockScreen project={project} decorative />
						)}
					</DeviceFrame>
					<DeviceFrame kind="phone" className="sc-hero-phone">
						{shots[1] ? (
							<Media src={shots[1]} alt="" className="sc-hero-shot sc-hero-shot-back lk-device-media" />
						) : (
							<MockScreen project={project} kind="mobile" focus={1} decorative />
						)}
					</DeviceFrame>
				</div>
			</div>
		</header>
	);
};

/** 벤토 칸 하나: 큰 칸은 그림(없으면 그 항목을 고른 가짜 화면)이 칸을 채우고, 넓은·작은 칸은 글 옆이나 아래에 항목 비주얼 */
const BentoCard: React.FC<{ project: Project; point: ProjectPoint; cell: BentoCell; index: number }> = ({
	project,
	point,
	cell,
	index,
}) => {
	const image = imageOf(point);
	const visual = image ? (
		<Media src={image} alt={`${point.title} 화면`} className="sc-card-img" />
	) : cell.size === 'lg' ? (
		<MockScreen project={project} focus={index} decorative className="sc-card-mock" />
	) : (
		<FeatureVisual point={point} index={index} project={project} />
	);
	return (
		<article className="sc-card" data-size={cell.size} data-reveal="">
			<div className="sc-card-text">
				<span className="sc-card-icon" aria-hidden="true">
					<i className={`fa-solid ${iconOf(point, index)}`} />
				</span>
				<h3>{point.title}</h3>
				<p>{point.body}</p>
				{point.detail && <p className="sc-card-detail">{point.detail}</p>}
			</div>
			<div className="sc-card-visual">{visual}</div>
		</article>
	);
};

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

/** 만든 방식: 항목마다 글과 그림이 한 줄씩 좌우를 번갈아 (그림이 없으면 그 항목의 비주얼) */
const Zig: React.FC<{ project: Project; points: ProjectPoint[] }> = ({ project, points }) => (
	<ol className="sc-zig">
		{points.map((point, index) => {
			const image = imageOf(point);
			return (
				<li key={point.title} className={index % 2 ? 'flip' : undefined} data-reveal="">
					<div className="sc-zig-text">
						<span className="sc-zig-num">{String(index + 1).padStart(2, '0')}</span>
						<h3>{point.title}</h3>
						<p>{point.body}</p>
						{point.detail && <p className="sc-zig-detail">{point.detail}</p>}
					</div>
					<div className="sc-zig-visual">
						{image ? (
							<Media src={image} alt={`${point.title} 화면`} className="sc-zig-media" />
						) : (
							<FeatureVisual point={point} index={index + 1} project={project} />
						)}
					</div>
				</li>
			);
		})}
	</ol>
);

/**
 * 어떤 프로젝트에나 맞는 모양(showcase), Stripe식 밝은 제품 랜딩: 색 띠가 흐르는 히어로와 기기 속 대표 화면 → 숫자 띠 →
 * 주요 기능 벤토 → 화면 모음 띠 → 만든 방식(좌우 번갈이) → 쓰는 법(이어진 단계) → 진행 과정 → 기술과 사양 → 마무리 띠.
 * 없는 묶음은 통째로 빠진다
 */
const ShowcasePage: React.FC<{ project: Project }> = ({ project }) => {
	const root = useReveal<HTMLDivElement>();
	const accent = useLandingAccent(project.icon);
	const gallery = project.gallery ?? [];
	// 대표 화면과 화면 모음을 합친 그림 목록 (겹치지 않게)
	const shots = [...new Set([project.image, ...gallery.map((shot) => shot.src)].filter(Boolean))] as string[];
	const stillShots = shots.filter((src) => !isVideo(src));
	const tech = techOf(project);
	const usage = project.usage ?? [];
	const timeline = project.timeline ?? [];

	return (
		<div ref={root} className="sc" style={accent}>
			<Hero project={project} shots={stillShots} />

			{project.facts.length > 0 && (
				<div className="sc-stats" data-reveal="">
					<StatBand facts={project.facts} />
				</div>
			)}

			{project.highlights.length > 0 && (
				<Region label="주요 기능" className="sc-section">
					<SectionHeader eyebrow="주요 기능" title="필요한 것을 한곳에 담았습니다." lead={project.description} />
					<BentoGrid
						items={project.highlights}
						label="주요 기능 목록"
						itemKey={(point) => point.title}
						framed={false}
						render={(point, cell, index) => <BentoCard project={project} point={point} cell={cell} index={index} />}
					/>
				</Region>
			)}

			{gallery.length > 1 && (
				<Region label="화면 모음" className="sc-section sc-wide">
					<SectionHeader eyebrow="화면 모음" title="화면으로 먼저 둘러보세요." align="start" />
					<Strip shots={gallery} />
				</Region>
			)}

			{project.build.length > 0 && (
				<Region label="만든 방식" className="sc-section">
					<SectionHeader eyebrow="만든 방식" title="보이지 않는 곳까지 다듬었습니다." />
					<Zig project={project} points={project.build} />
				</Region>
			)}

			{usage.length > 0 && (
				<Region label="쓰는 법" className="sc-section">
					<SectionHeader eyebrow="쓰는 법" title={`${usage.length}단계면 시작할 수 있습니다.`} />
					<ol className="sc-steps" data-count={Math.min(usage.length, 4)}>
						{usage.map((point, index) => (
							<li key={point.title} data-reveal="">
								<span className="sc-step-num">{index + 1}</span>
								<h3>{point.title}</h3>
								<p>{point.body}</p>
								{point.detail && <p className="sc-step-detail">{point.detail}</p>}
							</li>
						))}
					</ol>
				</Region>
			)}

			{timeline.length > 0 && (
				<Region label="진행 과정" className="sc-section">
					<SectionHeader eyebrow="진행 과정" title="처음 기획부터 마무리까지 이렇게 걸어왔습니다." />
					<ol className="sc-timeline" data-reveal="">
						{timeline.map((entry, index) => (
							<li key={`${entry.date}-${entry.label}`} data-last={index === timeline.length - 1 ? '' : undefined}>
								<time>{entry.date}</time>
								<span>{entry.label}</span>
							</li>
						))}
					</ol>
				</Region>
			)}

			{(project.specs.length > 0 || project.contributions.length > 0) && (
				<Region label="기술 사양" className="sc-section sc-specs-section">
					<SectionHeader eyebrow="기술 사양" title="무엇으로, 누가 만들었나요?" />
					{tech.length > 0 && <LogoStrip items={tech} caption="만든 기술" label="만든 기술" marquee />}
					<div className="sc-specs" data-reveal="">
						{project.specs.length > 0 && (
							<dl className="sc-specs-card">
								{project.specs.map((spec) => (
									<div key={spec.label}>
										<dt>{spec.label}</dt>
										<dd>{spec.value}</dd>
									</div>
								))}
							</dl>
						)}
						{project.contributions.length > 0 && (
							<Region label="맡은 일" as="div" className="sc-specs-card sc-contributions">
								<h3>맡은 일</h3>
								{project.role && <p className="sc-role">{project.role}</p>}
								<ul>
									{project.contributions.map((item) => (
										<li key={item}>
											<i className="fa-solid fa-check" aria-hidden="true" />
											{item}
										</li>
									))}
								</ul>
							</Region>
						)}
					</div>
				</Region>
			)}

			<div className="sc-cta" data-reveal="">
				<CtaBand project={project} />
			</div>
		</div>
	);
};

export default ShowcasePage;
