import React from 'react';
import AppWindow from '@/desktop/window/Window';
import { PROFILE, PROJECTS, type Project } from '@/shared/profile';
import '@/apps/safari/Safari.css';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** 프로젝트 카드: 화면 캡처, 구분, 이름, 소개, 기술, 데모·GitHub */
const ProjectCard: React.FC<{ project: Project }> = ({ project }) => (
	<li className="safari-project">
		<a
			className="safari-project-image"
			href={project.demo ?? project.url}
			{...external}
			tabIndex={-1}
			aria-hidden="true"
		>
			<img src={project.image} alt="" loading="lazy" />
		</a>
		<div className="safari-project-body">
			<p className="safari-project-context">{project.context}</p>
			<h2>{project.name}</h2>
			<p className="safari-project-description">{project.description}</p>
			{project.role && (
				<p className="safari-project-role">
					<strong>맡은 일</strong> {project.role}
				</p>
			)}
			<ul className="safari-stack" aria-label="기술">
				{project.stack.map((tech) => (
					<li key={tech}>{tech}</li>
				))}
			</ul>
			<div className="safari-project-actions">
				{project.demo && (
					<a className="safari-button primary" href={project.demo} {...external}>
						<i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /> 데모
					</a>
				)}
				<a className="safari-button" href={project.url} {...external}>
					<i className="fa-brands fa-github" aria-hidden="true" /> GitHub
				</a>
			</div>
		</div>
	</li>
);

/**
 * Safari: 포트폴리오 페이지. macOS Safari처럼 위쪽에 도구 막대(주소창)가 있고, 아래에 소개와 프로젝트.
 * 프로젝트는 GitHub에 고정한 저장소와 같다 (shared/profile.ts).
 */
const Safari: React.FC = () => (
	<AppWindow title="Safari" appName="safari" chrome="unified">
		<div className="safari">
			{/* 도구 막대 (보여 주기용). 신호등 버튼 자리를 비우고 주소창을 가운데에 */}
			<div className="safari-toolbar" aria-hidden="true">
				<span className="safari-lights-space" />
				<i className="fa-solid fa-chevron-left" />
				<i className="fa-solid fa-chevron-right" />
				<div className="safari-address">
					<i className="fa-solid fa-lock" />
					{PROFILE.name} · 포트폴리오
				</div>
				<i className="fa-solid fa-arrow-up-from-bracket" />
			</div>

			<div className="safari-page">
				<header className="safari-hero">
					<p className="safari-eyebrow">Portfolio</p>
					<h1>{PROFILE.name}의 포트폴리오</h1>
					<p className="safari-role">{PROFILE.role}</p>
					<p className="safari-intro">
						React · Next.js로 인터랙티브한 UI를 만들고, 화면에 필요한 API와 데이터 구조까지 직접 설계합니다.
					</p>
					<div className="safari-hero-links">
						<a className="safari-button" href={PROFILE.github} {...external}>
							<i className="fa-brands fa-github" aria-hidden="true" /> GitHub
						</a>
						<a className="safari-button" href={`mailto:${PROFILE.email}`}>
							<i className="fa-solid fa-envelope" aria-hidden="true" /> {PROFILE.email}
						</a>
					</div>
				</header>

				<section aria-label="프로젝트">
					<h2 className="safari-section-title">프로젝트</h2>
					<ul className="safari-projects">
						{PROJECTS.map((project) => (
							<ProjectCard key={project.id} project={project} />
						))}
					</ul>
				</section>
			</div>
		</div>
	</AppWindow>
);

export default Safari;
