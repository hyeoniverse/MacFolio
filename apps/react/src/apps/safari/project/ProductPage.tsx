// 어두운 제품 론칭 페이지(product): 거의 검은 바탕의 아주 큰 제목 → 화면 폭 가득 떠 있는 대표 화면(뒤에 강조색 빛) → 큰 숫자 띠 →
// 기능 하나씩 크게(글과 그림을 좌우로 번갈아) → 밝은 띠의 만든 방식 카드 → 가로 단계(쓰는 법) → 가로 선(진행 과정) →
// 어두운 띠의 기술 사양 표와 맡은 일 체크 목록 → 마지막 부름(GitHub). 없는 묶음은 통째로 빠진다.
// MacFolio 자신일 때만 데모 둘(product/): 화면 크기 시뮬레이터(어디서 열어도)와 요청이 지나는 길 그림(만든 방식 안)
import React from 'react';
import { cssVars } from '@/shared/lib/cssVars';
import type { Project, ProjectPoint } from '@/shared/profile';
import { FactValue, Favicon, Links, Region } from '@/apps/safari/project/parts';
import { useReveal } from '@/apps/safari/project/reveal';
import Devices from '@/apps/safari/project/product/Devices';
import Pipeline from '@/apps/safari/project/product/Pipeline';
import '@/apps/safari/project/ProductPage.css';

/** 글 옆에 붙일 그림 하나: 영상 > 그림 > 화면 여러 장의 첫 장 */
const mediaOf = (point: ProjectPoint): { src: string; video: boolean; alt: string } | null => {
	if (point.video) return { src: point.video, video: true, alt: `${point.title} 영상` };
	if (point.image) return { src: point.image, video: false, alt: `${point.title} 화면` };
	const shot = point.shots?.[0];
	if (shot) return { src: shot.src, video: shot.src.endsWith('.mp4'), alt: shot.alt };
	return null;
};

const Media: React.FC<{ src: string; video: boolean; alt: string }> = ({ src, video, alt }) =>
	video ? (
		<video src={src} muted loop playsInline autoPlay aria-label={alt} />
	) : (
		<img src={src} alt={alt} loading="lazy" />
	);

/** 두 자리 번호 (01, 02 …) */
const pad = (n: number) => String(n + 1).padStart(2, '0');

/**
 * 맨 위: 아이콘과 이름 한 줄, 아주 큰 한 줄 제목, 소개, 링크. 그 아래 대표 화면이 화면 폭 가득 떠 있고 뒤에서 강조색 빛이 번진다.
 * 숫자가 있으면 화면 바로 아래에 큰 숫자 띠로 이어진다
 */
const Hero: React.FC<{ project: Project }> = ({ project }) => {
	const meta = [project.context, project.role, project.period].filter(Boolean);
	return (
		<header className="pd-hero">
			<div className="pd-hero-copy" data-reveal="">
				<p className="pd-brand">
					<Favicon project={project} className="pd-brand-icon" />
					{project.logo ? <img className="pd-brand-logo" src={project.logo} alt={project.name} /> : project.name}
				</p>
				<h1>{project.tagline || project.name}</h1>
				{project.description && <p className="pd-lead">{project.description}</p>}
				{meta.length > 0 && (
					<p className="pd-meta">
						{meta.map((item) => (
							<span key={item}>{item}</span>
						))}
					</p>
				)}
				<Links project={project} className="sp-links pd-links" />
			</div>
			{project.image && (
				<figure className="pd-stage" data-reveal="zoom">
					<img src={project.image} alt={`${project.name} 화면`} />
				</figure>
			)}
			{project.facts.length > 0 && (
				<ul className="pd-numbers" aria-label="한눈에" data-reveal="">
					{project.facts.map((fact, index) => (
						<li key={fact.label} style={cssVars({ d: index })}>
							<FactValue text={fact.value} />
							<span>{fact.label}</span>
						</li>
					))}
				</ul>
			)}
		</header>
	);
};

/** 기능 하나: 왼쪽 글, 오른쪽 그림. 홀수 번째는 좌우가 바뀐다. 그림이 없으면 글만 넓게 */
const Feature: React.FC<{ point: ProjectPoint; index: number }> = ({ point, index }) => {
	const media = mediaOf(point);
	return (
		<li className={`pd-feature${media ? '' : ' pd-feature-text'}`} data-reveal="">
			<div className="pd-feature-copy">
				<span className="pd-index" aria-hidden="true">
					{pad(index)}
				</span>
				<h3>
					{point.icon && <i className={`fa-solid ${point.icon}`} aria-hidden="true" />}
					{point.title}
				</h3>
				<p>{point.body}</p>
				{point.detail && <p className="pd-detail">{point.detail}</p>}
			</div>
			{media && (
				<figure className="pd-feature-media">
					<Media {...media} />
				</figure>
			)}
		</li>
	);
};

const ProductPage: React.FC<{ project: Project }> = ({ project }) => {
	const root = useReveal<HTMLDivElement>();
	const usage = project.usage ?? [];
	const timeline = project.timeline ?? [];
	// MacFolio 전용 데모 (다른 프로젝트가 이 모양을 골라도 그리지 않는다)
	const self = project.id === 'macfolio';

	return (
		<div ref={root} className="pd">
			<Hero project={project} />

			{project.highlights.length > 0 && (
				<Region label="주요 기능" className="pd-section pd-features">
					<div className="pd-head" data-reveal="">
						<p className="pd-kicker">주요 기능</p>
						<h2>하나씩, 크게.</h2>
					</div>
					<ol>
						{project.highlights.map((point, index) => (
							<Feature key={point.title} point={point} index={index} />
						))}
					</ol>
				</Region>
			)}

			{self && <Devices />}

			{project.build.length > 0 && (
				<Region label="만든 방식" className="pd-section pd-build">
					<div className="pd-head" data-reveal="">
						<p className="pd-kicker">만든 방식</p>
						<h2>겉보다 속에 들인 시간.</h2>
					</div>
					{self && <Pipeline />}
					<ol className="pd-cards">
						{project.build.map((point, index) => (
							<li key={point.title} data-reveal="" style={cssVars({ d: index % 2 })}>
								<span className="pd-card-num" aria-hidden="true">
									{pad(index)}
								</span>
								<h3>{point.title}</h3>
								<p>{point.body}</p>
								{point.detail && <p className="pd-detail">{point.detail}</p>}
							</li>
						))}
					</ol>
				</Region>
			)}

			{usage.length > 0 && (
				<Region label="쓰는 법" className="pd-section pd-usage">
					<div className="pd-head" data-reveal="">
						<p className="pd-kicker">쓰는 법</p>
						<h2>처음 열면 이렇게.</h2>
					</div>
					<ol className="pd-steps">
						{usage.map((point, index) => (
							<li key={point.title} data-reveal="" style={cssVars({ d: index })}>
								<span className="pd-step-num">{index + 1}</span>
								<h3>{point.title}</h3>
								<p>{point.body}</p>
							</li>
						))}
					</ol>
				</Region>
			)}

			{timeline.length > 0 && (
				<Region label="진행 과정" className="pd-section pd-timeline">
					<div className="pd-head" data-reveal="">
						<p className="pd-kicker">진행 과정</p>
						<h2>날짜로 보는 길.</h2>
					</div>
					<ol className="pd-track">
						{timeline.map((entry, index) => (
							<li key={`${entry.date}-${entry.label}`} data-reveal="" style={cssVars({ d: index })}>
								<time>{entry.date}</time>
								<span>{entry.label}</span>
							</li>
						))}
					</ol>
				</Region>
			)}

			{(project.specs.length > 0 || project.contributions.length > 0) && (
				<div className="pd-dark">
					{project.specs.length > 0 && (
						<Region label="기술 사양" className="pd-section pd-specs">
							<div className="pd-head" data-reveal="">
								<p className="pd-kicker">기술 사양</p>
								<h2>무엇으로 만들었나.</h2>
							</div>
							<dl data-reveal="">
								{project.specs.map((spec) => (
									<div key={spec.label}>
										<dt>{spec.label}</dt>
										<dd>{spec.value}</dd>
									</div>
								))}
							</dl>
						</Region>
					)}
					{project.contributions.length > 0 && (
						<Region label="맡은 일" className="pd-section pd-roles">
							<div className="pd-head" data-reveal="">
								<p className="pd-kicker">맡은 일</p>
								<h2>{project.role ? '이 가운데 내가 한 일.' : '처음부터 끝까지.'}</h2>
							</div>
							<ul className="pd-checks">
								{project.contributions.map((item, index) => (
									<li key={item} data-reveal="left" style={cssVars({ d: index })}>
										<i className="fa-solid fa-check" aria-hidden="true" />
										{item}
									</li>
								))}
							</ul>
						</Region>
					)}
				</div>
			)}

			<footer className="pd-cta" data-reveal="">
				<Favicon project={project} className="pd-cta-icon" />
				<p className="pd-cta-title">{project.name}</p>
				<p className="pd-cta-sub">코드는 저장소에 다 있습니다.</p>
				<Links project={project} className="sp-links pd-links" />
			</footer>
		</div>
	);
};

export default ProductPage;
