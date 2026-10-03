// HYEONIVERSE (포트폴리오): 왼쪽에 제목과 차례가 붙어 있고, 오른쪽만 장(01 기능, 02 만든 방식, 03 맡은 일, 04 기술 사양)을 넘기며 내려간다
import React, { useRef } from 'react';
import type { Project } from '@/shared/profile';
import { Favicon, Links, Shot } from '@/apps/safari/project/parts';
import '@/apps/safari/project/CreativePage.css';

const CHAPTERS = ['주요 기능', '만든 방식', '맡은 일', '기술 사양'] as const;

const CreativePage: React.FC<{ project: Project }> = ({ project }) => {
	const main = useRef<HTMLDivElement>(null);
	const open = (index: number) => {
		const chapters = main.current?.querySelectorAll<HTMLElement>('.cr-chapter');
		chapters?.[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};
	const number = (index: number) => String(index + 1).padStart(2, '0');

	return (
		<div className="cr">
			<div className="cr-side">
				<Favicon project={project} className="cr-icon" />
				<p className="cr-name">{project.name}</p>
				<h1>{project.tagline}</h1>
				<p className="cr-lead">{project.description}</p>
				<Links project={project} className="cr-links" />
				<nav className="cr-index" aria-label="차례">
					<ol>
						{CHAPTERS.map((title, i) => (
							<li key={title}>
								<button type="button" onClick={() => open(i)}>
									<span>{number(i)}</span>
									{title}
								</button>
							</li>
						))}
					</ol>
				</nav>
			</div>

			<div className="cr-main" ref={main}>
				<Shot project={project} className="cr-shot" />

				<section className="cr-facts" aria-label="한눈에 보기">
					<p>{project.context}</p>
					<ul>
						{project.facts.map((fact) => (
							<li key={fact.label}>
								<strong>{fact.value}</strong>
								<span>{fact.label}</span>
							</li>
						))}
					</ul>
				</section>

				<section className="cr-chapter" aria-label="주요 기능">
					<p className="cr-no">{number(0)}</p>
					<h2>주요 기능</h2>
					<ol className="cr-features">
						{project.highlights.map((point) => (
							<li key={point.title}>
								<h3>{point.title}</h3>
								<p>{point.body}</p>
							</li>
						))}
					</ol>
				</section>

				<section className="cr-chapter" aria-label="만든 방식">
					<p className="cr-no">{number(1)}</p>
					<h2>만든 방식</h2>
					<div className="cr-build">
						{project.build.map((point) => (
							<article key={point.title}>
								<h3>{point.title}</h3>
								<p>{point.body}</p>
							</article>
						))}
					</div>
				</section>

				<section className="cr-chapter" aria-label="맡은 일">
					<p className="cr-no">{number(2)}</p>
					<h2>맡은 일</h2>
					{project.role && <p className="cr-role">{project.role}</p>}
					<ul className="cr-roles">
						{project.contributions.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				</section>

				<section className="cr-chapter" aria-label="기술 사양">
					<p className="cr-no">{number(3)}</p>
					<h2>기술 사양</h2>
					<dl className="cr-specs">
						{project.specs.map((spec) => (
							<div key={spec.label}>
								<dt>{spec.label}</dt>
								<dd>{spec.value}</dd>
							</div>
						))}
					</dl>
				</section>

				<footer className="cr-foot">
					<p>{project.tagline}</p>
					<Links project={project} className="cr-links" />
				</footer>
			</div>
		</div>
	);
};

export default CreativePage;
