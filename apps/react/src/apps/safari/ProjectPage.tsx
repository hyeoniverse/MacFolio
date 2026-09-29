import React from 'react';
import type { Project, ProjectLook } from '@/shared/profile';
import { APP_MANIFEST, type AppName } from '@/apps/manifest';
import { useAppState } from '@/desktop/AppStateContext';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import '@/apps/safari/ProjectPage.css';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** 프로젝트 아이콘. 아이콘이 없는 프로젝트와 시작 페이지는 기본 모양 */
export const Favicon: React.FC<{ project?: Project; className?: string }> = ({
	project,
	className = 'safari-favicon',
}) =>
	project?.icon ? (
		<img src={project.icon} alt="" className={className} />
	) : (
		<span className={`${className} fallback`} aria-hidden="true">
			<i className={project ? 'fa-solid fa-book' : 'fa-regular fa-star'} />
		</span>
	);

type SectionName = 'facts' | 'features' | 'controls' | 'conventions' | 'timeline' | 'build' | 'role' | 'next' | 'specs';

/** 모양마다 섹션 순서가 다르다. 신문 모양은 숫자를 첫 화면에 싣는다 */
const ORDER: Record<ProjectLook, SectionName[]> = {
	editorial: ['features', 'timeline', 'build', 'role', 'specs'],
	playful: ['features', 'facts', 'build', 'role', 'specs'],
	minimal: ['facts', 'features', 'build', 'role', 'next', 'specs'],
	game: ['facts', 'controls', 'features', 'build', 'role', 'specs'],
	terminal: ['facts', 'features', 'conventions', 'build', 'role', 'specs'],
};

/** 주요 기능 섹션의 제목 (굵은 제목, 흐린 덧붙임) */
const FEATURE_COPY: Record<ProjectLook, [string, string]> = {
	editorial: ['주요 기능.', '오늘 아침 받아 볼 것들.'],
	playful: ['주요 기능.', '할 일 목록이 가벼워지는 방법.'],
	minimal: ['주요 기능.', '명함 한 장이 오가는 순서.'],
	game: ['주요 기능.', '한 판의 흐름과 규칙.'],
	terminal: ['주요 기능.', '무엇을 어떻게 남겼나.'],
};

/** 섹션 제목: 굵은 제목 뒤에 흐린 글씨로 한 줄 덧붙인다 (Apple 홈페이지 방식) */
const Headline: React.FC<{ title: string; sub?: string }> = ({ title, sub }) => (
	<h2 className="sp-headline">
		{title}
		{sub && <span> {sub}</span>}
	</h2>
);

const Section: React.FC<{ label: string; className?: string; inner?: string; children: React.ReactNode }> = ({
	label,
	className = '',
	inner = '',
	children,
}) => (
	<section className={`sp-section ${className}`} aria-label={label}>
		<div className={`sp-inner ${inner}`}>{children}</div>
	</section>
);

/** 이 사이트 안에서 바로 실행할 수 있는 프로젝트 (앱으로 들어 있는 것) */
const PLAYABLE: Partial<Record<string, AppName>> = { sproutfarm: 'sproutfarm' };

const Links: React.FC<{ project: Project }> = ({ project }) => {
	const { openApp } = useAppState();
	const isMobile = useIsMobile();
	const app = PLAYABLE[project.id];
	const playable = app && !(isMobile && APP_MANIFEST[app].desktopOnly);

	return (
		<div className="sp-links">
			{playable && (
				<button type="button" className="sp-pill" onClick={() => openApp(app)}>
					여기서 플레이
				</button>
			)}
			{project.demo && (
				<a className={playable ? 'sp-link' : 'sp-pill'} href={project.demo} {...external}>
					{playable ? (
						<>
							새 탭에서 열기 <i className="fa-solid fa-chevron-right" aria-hidden="true" />
						</>
					) : (
						'데모 보기'
					)}
				</a>
			)}
			<a className="sp-link" href={project.url} {...external}>
				GitHub에서 보기 <i className="fa-solid fa-chevron-right" aria-hidden="true" />
			</a>
		</div>
	);
};

const Facts: React.FC<{ project: Project }> = ({ project }) => (
	<ul className="sp-facts">
		{project.facts.map((fact) => (
			<li key={fact.label}>
				<strong>{fact.value}</strong>
				<span>{fact.label}</span>
			</li>
		))}
	</ul>
);

/** 첫 화면. 신문은 제호와 나란한 화면 캡처, 터미널은 캡처 대신 터미널 창 */
const Hero: React.FC<{ project: Project }> = ({ project }) => {
	const { look } = project;
	const shot = (
		<figure className="sp-shot">
			<img src={project.image} alt={`${project.name} 화면`} />
		</figure>
	);

	return (
		<section className="sp-hero">
			{look === 'editorial' && (
				<div className="sp-masthead">
					{project.logo ? <img src={project.logo} alt="" className="sp-logo" /> : <strong>{project.name}</strong>}
					<span>{project.context}</span>
					<span>{project.period}</span>
				</div>
			)}
			<div className="sp-hero-main">
				{look !== 'editorial' && (
					<div className="sp-hero-art">
						<Favicon project={project} className="sp-app-icon" />
					</div>
				)}
				<div className="sp-hero-copy">
					<p className="sp-eyebrow">{project.name}</p>
					<h1>{project.tagline}</h1>
					<p className="sp-lead">{project.description}</p>
					<Links project={project} />
				</div>
				{look === 'editorial' && shot}
			</div>
			{look === 'editorial' && <Facts project={project} />}
			{look === 'terminal' && project.terminal ? (
				<div className="sp-terminal" aria-label="터미널">
					<div className="sp-terminal-bar" aria-hidden="true">
						<span />
						<span />
						<span />
					</div>
					<pre>
						{project.terminal.map((line) =>
							line.startsWith('$ ') ? (
								<code key={line} className="command">
									{line.slice(2)}
								</code>
							) : (
								<code key={line}>{line}</code>
							)
						)}
						<code className="command cursor" aria-hidden="true" />
					</pre>
				</div>
			) : (
				look !== 'editorial' && shot
			)}
		</section>
	);
};

/** 주요 기능: 모양마다 다르게 늘어놓는다 */
const Features: React.FC<{ project: Project }> = ({ project }) => {
	const [title, sub] = FEATURE_COPY[project.look];
	const points = project.highlights;
	let list: React.ReactNode;

	switch (project.look) {
		// 신문: 번호 붙은 기사 칸
		case 'editorial':
			list = (
				<ol className="sp-news">
					{points.map((point, i) => (
						<li key={point.title}>
							<span className="sp-news-no">{String(i + 1).padStart(2, '0')}</span>
							<h3>{point.title}</h3>
							<p>{point.body}</p>
						</li>
					))}
				</ol>
			);
			break;
		// 알록달록 할 일 카드
		case 'playful':
			list = (
				<ul className="sp-cards">
					{points.map((point) => (
						<li key={point.title}>
							<i className="fa-regular fa-square-check" aria-hidden="true" />
							<h3>{point.title}</h3>
							<p>{point.body}</p>
						</li>
					))}
				</ul>
			);
			break;
		// 차례로 이어지는 단계
		case 'minimal':
			list = (
				<ol className="sp-steps">
					{points.map((point, i) => (
						<li key={point.title}>
							<span className="sp-step-no">{i + 1}</span>
							<h3>{point.title}</h3>
							<p>{point.body}</p>
						</li>
					))}
				</ol>
			);
			break;
		default:
			list = (
				<ul className="sp-tiles">
					{points.map((point, i) => (
						// 개수가 홀수면 첫 타일을 넓게 해 빈칸을 없앤다
						<li key={point.title} className={i === 0 && points.length % 2 === 1 ? 'wide' : undefined}>
							<h3>{point.title}</h3>
							<p>{point.body}</p>
						</li>
					))}
				</ul>
			);
	}

	return (
		<Section label="주요 기능">
			<Headline title={title} sub={sub} />
			{list}
		</Section>
	);
};

const renderSection = (name: SectionName, project: Project) => {
	switch (name) {
		case 'facts':
			return (
				<section key={name} className="sp-band" aria-label="한눈에 보기">
					<div className="sp-inner">
						<p className="sp-meta">
							{project.context}
							{project.period && ` · ${project.period}`}
						</p>
						<Facts project={project} />
					</div>
				</section>
			);
		case 'features':
			return <Features key={name} project={project} />;
		case 'controls':
			return (
				project.controls && (
					<Section key={name} label="조작법" className="sp-alt">
						<Headline title="조작법." sub="방향키, Shift, Space." />
						<ul className="sp-controls">
							{project.controls.map((control) => (
								<li key={control.label}>
									<span className="sp-keys">
										{control.keys.map((key) => (
											<kbd key={key}>{key}</kbd>
										))}
									</span>
									<span>{control.label}</span>
								</li>
							))}
						</ul>
					</Section>
				)
			);
		case 'conventions':
			return (
				project.conventions && (
					<Section key={name} label="커밋 컨벤션" className="sp-alt">
						<Headline title="커밋 컨벤션." sub="기록의 성격을 타입으로 나눴어요." />
						<ul className="sp-conventions">
							{project.conventions.map((convention) => (
								<li key={convention.type}>
									<code>{convention.type}</code>
									<span>{convention.description}</span>
								</li>
							))}
						</ul>
					</Section>
				)
			);
		case 'timeline':
			return (
				project.timeline && (
					<Section key={name} label="진행 과정">
						<Headline title="진행 과정." sub={project.period} />
						<ol className="sp-timeline">
							{project.timeline.map((step) => (
								<li key={step.date}>
									<time>{step.date}</time>
									<span>{step.label}</span>
								</li>
							))}
						</ol>
					</Section>
				)
			);
		case 'build':
			return (
				<Section key={name} label="만든 방식" className="sp-dark">
					<Headline title="만든 방식." sub="보이지 않는 곳에서 신경 쓴 것들." />
					<ul className="sp-points">
						{project.build.map((point) => (
							<li key={point.title}>
								<h3>{point.title}</h3>
								<p>{point.body}</p>
							</li>
						))}
					</ul>
				</Section>
			);
		case 'role':
			return (
				<Section key={name} label="맡은 일" className="sp-alt" inner="sp-split">
					<Headline title="맡은 일." sub={project.role} />
					<ul className="sp-checks">
						{project.contributions.map((item) => (
							<li key={item}>
								<i className="fa-solid fa-circle-check" aria-hidden="true" />
								{item}
							</li>
						))}
					</ul>
				</Section>
			);
		case 'next':
			return (
				project.next && (
					<Section key={name} label="다음 단계" inner="sp-split">
						<Headline title="다음 단계." sub="아직 남은 것들." />
						<ul className="sp-checks next">
							{project.next.map((item) => (
								<li key={item}>
									<i className="fa-regular fa-circle" aria-hidden="true" />
									{item}
								</li>
							))}
						</ul>
					</Section>
				)
			);
		case 'specs':
			// Apple 제품의 '기술 사양' 표처럼
			return (
				<Section key={name} label="기술 사양">
					<h2 className="sp-specs-title">기술 사양</h2>
					<dl className="sp-specs">
						{project.specs.map((spec) => (
							<div key={spec.label}>
								<dt>{spec.label}</dt>
								<dd>{spec.value}</dd>
							</div>
						))}
					</dl>
				</Section>
			);
	}
};

/**
 * Safari 탭 안의 페이지: Apple 제품 소개 페이지처럼 프로젝트를 소개한다.
 * 프로젝트마다 모양(look)이 달라 첫 화면, 기능 소개, 색, 섹션 순서가 바뀐다.
 */
const ProjectPage: React.FC<{ project: Project }> = ({ project }) => (
	<article className="sp" data-look={project.look} aria-label={project.name}>
		<Hero project={project} />
		{ORDER[project.look].map((name) => renderSection(name, project))}
		<footer className="sp-cta">
			<p>{project.tagline}</p>
			<Links project={project} />
		</footer>
	</article>
);

export default ProjectPage;
