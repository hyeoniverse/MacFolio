// NewPick (뉴스레터): 신문 1면. 제호 → 머리기사와 옆 단(숫자, 진행 과정) → 기사 네 꼭지 → 두 단 해설 → 아래 칸(맡은 일, 기술 사양)
import React from 'react';
import type { Project } from '@/shared/profile';
import { Facts, Links, Shot } from '@/apps/safari/project/parts';
import '@/apps/safari/project/EditorialPage.css';

const EditorialPage: React.FC<{ project: Project }> = ({ project }) => (
	<div className="np">
		<header className="np-masthead">
			<p className="np-topline">
				<span>{project.context}</span>
				{project.period && <span>{project.period}</span>}
			</p>
			{project.logo ? (
				<img src={project.logo} alt={project.name} className="np-logo" />
			) : (
				<strong className="np-title">{project.name}</strong>
			)}
			<p className="np-rule" aria-hidden="true">
				<span>NO. 01</span>
				<span>{project.name}</span>
				<span>{project.language}</span>
			</p>
		</header>

		<div className="np-front">
			<section className="np-lead" aria-label="머리기사">
				<p className="np-kicker">오늘의 머리기사</p>
				<h1>{project.tagline}</h1>
				<p className="np-dek">{project.description}</p>
				<Links project={project} className="np-links" />
				<Shot project={project} className="np-shot" />
				<p className="np-caption">▲ {project.name} 첫 화면</p>
			</section>

			<div className="np-side">
				<section className="np-box" aria-label="한눈에 보기">
					<h2>숫자로 보면</h2>
					<Facts project={project} className="np-facts" />
				</section>
				{project.timeline && (
					<section className="np-box" aria-label="진행 과정">
						<h2>진행 과정</h2>
						<ol className="np-timeline">
							{project.timeline.map((step) => (
								<li key={step.date}>
									<time>{step.date}</time>
									<span>{step.label}</span>
								</li>
							))}
						</ol>
					</section>
				)}
			</div>
		</div>

		<section className="np-articles" aria-label="주요 기능">
			<h2 className="np-section">주요 기능</h2>
			<ol>
				{project.highlights.map((point) => (
					<li key={point.title}>
						<h3>{point.title}</h3>
						<p>{point.body}</p>
					</li>
				))}
			</ol>
		</section>

		<section className="np-column" aria-label="만든 방식">
			<h2 className="np-section">해설 · 만든 방식</h2>
			<div className="np-body">
				{project.build.map((point) => (
					<p key={point.title}>
						<strong>{point.title}.</strong> {point.body}
					</p>
				))}
			</div>
		</section>

		<div className="np-bottom">
			<section className="np-byline" aria-label="맡은 일">
				<h2 className="np-section">맡은 일</h2>
				{project.role && <p className="np-role">{project.role}</p>}
				<ul>
					{project.contributions.map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
			</section>
			<section className="np-classified" aria-label="기술 사양">
				<h2 className="np-section">기술 사양</h2>
				<dl>
					{project.specs.map((spec) => (
						<div key={spec.label}>
							<dt>{spec.label}</dt>
							<dd>{spec.value}</dd>
						</div>
					))}
				</dl>
			</section>
		</div>

		<footer className="np-foot">
			<p>{project.tagline}</p>
			<Links project={project} className="np-links" />
		</footer>
	</div>
);

export default EditorialPage;
