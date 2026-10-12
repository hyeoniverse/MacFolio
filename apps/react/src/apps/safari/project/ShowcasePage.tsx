import React, { useState } from 'react';
import type { Project, ProjectPoint } from '@/shared/profile';
import { FactValue, Links, Region } from '@/apps/safari/project/parts';
import { useReveal } from '@/apps/safari/project/reveal';
import { cssVars } from '@/shared/lib/cssVars';
import '@/apps/safari/project/ShowcasePage.css';

const isVideo = (src: string) => src.endsWith('.mp4');

/** 칸 n개를 max열 이하 격자에 남는 칸 없이: 열 수와 마지막 칸이 차지할 열 수 */
function fitGrid(n: number, max: number): { cols: number; last: number } {
	const cols = n <= max ? Math.max(1, n) : n % max === 0 ? max : n % 3 === 0 ? 3 : max;
	const rest = n % cols;
	return { cols, last: rest === 0 ? 1 : cols - rest + 1 };
}

/** 언어와 기술을 한 줄로 (언어가 기술에 이미 있으면 한 번만) */
const techOf = (project: Project) =>
	project.language && !project.stack.includes(project.language) ? [project.language, ...project.stack] : project.stack;

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
const Hero: React.FC<{ project: Project; shots: string[] }> = ({ project, shots }) => {
	const tech = techOf(project);
	return (
		<header className={`sc-hero${shots[0] ? '' : ' solo'}`} data-reveal="">
			<div className="sc-hero-text">
				<div className="sc-brand">
					{project.icon && <img className="sc-tile" src={project.icon} alt="" />}
					{project.logo ? (
						<img className="sc-logo" src={project.logo} alt={project.name} />
					) : (
						<span>{project.name}</span>
					)}
				</div>
				<h1>{project.tagline || project.name}</h1>
				{project.description && <p className="sc-lead">{project.description}</p>}
				<p className="sc-meta">{[project.context, project.role, project.period].filter(Boolean).join(' · ')}</p>
				<Links project={project} className="sp-links sc-links" />
				{tech.length > 0 && (
					<ul className="sc-stack" aria-label="기술">
						{tech.map((item) => (
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
};

/**
 * 벤토 칸의 크기 [열, 행]: 첫 카드는 2×2, 둘째·셋째는 그 옆 한 열에 위아래로. 나머지는 세 칸씩 줄을 짓고,
 * 마지막 줄이 모자라면 마지막 카드가 남은 칸을 채운다 (항목이 몇 개든 빈 칸이 없다)
 */
function bentoSpan(index: number, n: number): [number, number] {
	if (index === 0) return n === 1 ? [3, 2] : [2, 2];
	if (index === 1 && n === 2) return [1, 2];
	if (index < 3) return [1, 1];
	const rest = (n - 3) % 3;
	if (index === n - 1 && rest === 1) return [3, 1];
	if (index === n - 1 && rest === 2) return [2, 1];
	return [1, 1];
}

/**
 * 벤토: 첫 카드는 크게(그림이 있으면 그림이 바탕), 나머지는 작게. 그림이 있는 카드는 그림을 아래에 깔고 글을 위에 둔다.
 * 그림이 없는 큰 카드는 아이콘이나 번호를 크게 깔아 빈 판으로 남지 않는다
 */
const Bento: React.FC<{ points: ProjectPoint[]; fallback: string[] }> = ({ points, fallback }) => (
	<ul className="sc-bento">
		{points.map((point, index) => {
			const image =
				point.image ?? point.shots?.[0]?.src ?? (index === 0 ? fallback[index % fallback.length] : undefined);
			const [cols, rows] = bentoSpan(index, points.length);
			const big = cols * rows > 1;
			// 큰 장식은 두 줄 높이 카드에만 (한 줄 높이는 글이 그 자리를 쓴다)
			const tall = rows > 1;
			return (
				<li
					key={point.title}
					className={index === 0 ? 'wide' : big ? 'big' : ''}
					style={cssVars({ cols, rows })}
					data-reveal=""
				>
					{image && <Media src={image} alt="" className="sc-bento-bg" />}
					{!image && tall && (
						<span className="sc-bento-mark" aria-hidden="true">
							{point.icon ? <i className={`fa-solid ${point.icon}`} /> : String(index + 1).padStart(2, '0')}
						</span>
					)}
					<div className="sc-bento-text">
						{point.icon && <i className={`fa-solid ${point.icon}`} aria-hidden="true" />}
						<h3>{point.title}</h3>
						<p>{point.body}</p>
						{point.detail && <p className="sc-bento-detail">{point.detail}</p>}
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
 * 만든 방식: 그림이 있는 항목은 한 줄을 다 쓰며 글과 그림이 번갈아 좌우, 그림이 없는 항목은 두 칸씩 카드로 짝짓는다.
 * 짝이 없이 혼자 남은 카드는 줄을 다 쓴다
 */
function zigItems(points: ProjectPoint[]): React.ReactNode[] {
	const images = points.map((point) => point.image ?? point.shots?.[0]?.src);
	let flip = false;
	let run = 0;
	return points.map((point, index) => {
		const image = images[index];
		let className = '';
		if (image) {
			className = `media${flip ? ' flip' : ''}`;
			flip = !flip;
			run = 0;
		} else {
			run += 1;
			const nextIsCard = index + 1 < points.length && !images[index + 1];
			if (run % 2 === 1 && !nextIsCard) className = 'solo';
		}
		return (
			<li key={point.title} className={className} data-reveal="">
				<div className="sc-zig-text">
					<span className="sc-zig-num">{String(index + 1).padStart(2, '0')}</span>
					<h3>{point.title}</h3>
					<p>{point.body}</p>
					{point.detail && <p className="sc-zig-detail">{point.detail}</p>}
				</div>
				{image && <Media src={image} alt={`${point.title} 화면`} className="sc-zig-media" />}
			</li>
		);
	});
}

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
	// 쓰는 법 칸: 네 칸까지 한 줄, 그보다 많으면 줄마다 빈 칸 없이 (모자란 줄은 마지막 칸이 늘어난다)
	const stepGrid = fitGrid(project.usage?.length ?? 0, 4);

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
					<ol className="sc-zig">{zigItems(project.build)}</ol>
				</Region>
			)}

			{project.usage && project.usage.length > 0 && (
				<Region label="쓰는 법" className="sc-section">
					<h2 data-reveal="">쓰는 법</h2>
					<ol className="sc-steps" style={cssVars(stepGrid)}>
						{project.usage.map((point, index) => (
							<li key={point.title} data-reveal="">
								<span className="sc-step-num">{index + 1}</span>
								<div>
									<h3>{point.title}</h3>
									<p>{point.body}</p>
									{point.detail && <p className="sc-step-detail">{point.detail}</p>}
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
