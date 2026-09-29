import React, { useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import { PROJECTS, type Project } from '@/shared/profile';
import '@/apps/safari/Safari.css';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** 주소창에 보일 주소 (데모가 있으면 데모, 없으면 저장소) */
const addressOf = (project: Project) => project.demo ?? project.url;
const displayAddress = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');

/** 탭 안의 페이지: 프로젝트 소개 */
const ProjectPage: React.FC<{ project: Project }> = ({ project }) => (
	<article className="safari-page-content" aria-label={project.name}>
		<header className="safari-page-hero">
			<p className="safari-page-context">{project.context}</p>
			<h1>{project.name}</h1>
			<p className="safari-page-description">{project.description}</p>
			<div className="safari-page-actions">
				{project.demo && (
					<a className="safari-button primary" href={project.demo} {...external}>
						<i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /> 데모 열기
					</a>
				)}
				<a className="safari-button" href={project.url} {...external}>
					<i className="fa-brands fa-github" aria-hidden="true" /> GitHub 저장소
				</a>
			</div>
		</header>

		<figure className="safari-page-shot">
			<img src={project.image} alt={`${project.name} 화면`} />
		</figure>

		<div className="safari-page-sections">
			<section className="safari-page-card" aria-label="주요 기능">
				<h2>주요 기능</h2>
				<ul className="safari-features">
					{project.features.map((feature) => (
						<li key={feature}>
							<i className="fa-solid fa-circle-check" aria-hidden="true" />
							{feature}
						</li>
					))}
				</ul>
			</section>

			<div className="safari-page-side">
				{project.role && (
					<section className="safari-page-card" aria-label="맡은 일">
						<h2>맡은 일</h2>
						<p>{project.role}</p>
					</section>
				)}
				<section className="safari-page-card" aria-label="기술 스택">
					<h2>기술 스택</h2>
					<ul className="safari-stack">
						{project.stack.map((tech) => (
							<li key={tech}>{tech}</li>
						))}
					</ul>
				</section>
			</div>
		</div>
	</article>
);

/**
 * Safari: 프로젝트마다 탭이 하나씩 열린 브라우저. 탭을 고르면 그 프로젝트를 소개하는 페이지가 보인다.
 * 주소창을 누르면 실제 데모(없으면 저장소)를 새 탭에서 연다. 프로젝트는 GitHub 고정 저장소와 같다 (shared/profile.ts).
 */
const Safari: React.FC = () => {
	const [activeId, setActiveId] = useState(PROJECTS[0].id);
	const index = Math.max(
		0,
		PROJECTS.findIndex((project) => project.id === activeId)
	);
	const active = PROJECTS[index];
	const go = (offset: number) => setActiveId(PROJECTS[index + offset].id);

	return (
		<AppWindow title="Safari" appName="safari" chrome="unified">
			<div className="safari">
				{/* 도구 막대: 신호등 버튼 자리, 이전·다음 탭, 주소창, 새 탭에서 열기 */}
				<div className="safari-toolbar">
					<span className="safari-lights-space" aria-hidden="true" />
					<button
						type="button"
						className="safari-tool"
						aria-label="이전 탭"
						disabled={index === 0}
						onClick={() => go(-1)}
					>
						<i className="fa-solid fa-chevron-left" aria-hidden="true" />
					</button>
					<button
						type="button"
						className="safari-tool"
						aria-label="다음 탭"
						disabled={index === PROJECTS.length - 1}
						onClick={() => go(1)}
					>
						<i className="fa-solid fa-chevron-right" aria-hidden="true" />
					</button>
					<a className="safari-address" href={addressOf(active)} {...external} title="새 탭에서 열기">
						<i className="fa-solid fa-lock" aria-hidden="true" />
						<span>{displayAddress(addressOf(active))}</span>
					</a>
					<a className="safari-tool" href={addressOf(active)} {...external} aria-label="새 탭에서 열기">
						<i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
					</a>
				</div>

				{/* 탭 막대: 프로젝트마다 탭 하나 */}
				<div className="safari-tabs" role="tablist" aria-label="프로젝트 탭">
					{PROJECTS.map((project) => (
						<button
							key={project.id}
							type="button"
							role="tab"
							id={`safari-tab-${project.id}`}
							aria-selected={project.id === active.id}
							aria-controls="safari-tabpanel"
							className={`safari-tab ${project.id === active.id ? 'active' : ''}`}
							onClick={() => setActiveId(project.id)}
						>
							<img src={project.image} alt="" className="safari-favicon" />
							<span>{project.name}</span>
						</button>
					))}
				</div>

				<div className="safari-page" role="tabpanel" id="safari-tabpanel" aria-labelledby={`safari-tab-${active.id}`}>
					{/* 탭을 바꾸면 페이지를 새로 그려 나타나는 애니메이션이 다시 돈다 */}
					<ProjectPage key={active.id} project={active} />
				</div>
			</div>
		</AppWindow>
	);
};

export default Safari;
