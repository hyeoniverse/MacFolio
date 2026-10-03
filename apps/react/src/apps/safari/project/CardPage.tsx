// QRU (디지털 명함): 명함 앞뒤. 앞면(소개)과 뒷면(기술 사양) → 숫자 한 줄 → 명함이 오가는 순서(단계와 화면) → 묻고 답하기(만든 방식) → 맡은 일과 다음 단계
import React from 'react';
import type { Project } from '@/shared/profile';
import { Facts, Favicon, Links, Shot } from '@/apps/safari/project/parts';
import '@/apps/safari/project/CardPage.css';

const CardPage: React.FC<{ project: Project }> = ({ project }) => (
	<div className="qc">
		<header className="qc-hero">
			<div className="qc-cards">
				<div className="qc-card qc-front">
					<Favicon project={project} className="qc-icon" />
					<p className="qc-name">{project.name}</p>
					<h1>{project.tagline}</h1>
					<p className="qc-lead">{project.description}</p>
					<p className="qc-serial" aria-hidden="true">
						{project.context}
					</p>
				</div>
				<section className="qc-card qc-back" aria-label="기술 사양">
					<h2>기술 사양</h2>
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
			<Links project={project} className="qc-links" />
		</header>

		<section className="qc-facts" aria-label="한눈에 보기">
			<Facts project={project} />
		</section>

		<section className="qc-journey" aria-label="주요 기능">
			<h2 className="qc-title">명함 한 장이 오가는 순서</h2>
			<div className="qc-journey-body">
				<ol className="qc-steps">
					{project.highlights.map((point, i) => (
						<li key={point.title}>
							<span className="qc-step">{i + 1}</span>
							<h3>{point.title}</h3>
							<p>{point.body}</p>
						</li>
					))}
				</ol>
				<Shot project={project} className="qc-shot" />
			</div>
		</section>

		<section className="qc-faq" aria-label="만든 방식">
			<h2 className="qc-title">어떻게 만들었나요?</h2>
			{project.build.map((point, i) => (
				<details key={point.title} open={i === 0}>
					<summary>{point.title}</summary>
					<p>{point.body}</p>
				</details>
			))}
		</section>

		<div className="qc-lists">
			<section aria-label="맡은 일">
				<h2 className="qc-title">맡은 일</h2>
				{project.role && <p className="qc-role">{project.role}</p>}
				<ul>
					{project.contributions.map((item) => (
						<li key={item}>
							<i className="fa-solid fa-circle-check" aria-hidden="true" />
							{item}
						</li>
					))}
				</ul>
			</section>
			{project.next && (
				<section aria-label="다음 단계">
					<h2 className="qc-title">다음 단계</h2>
					<ul className="next">
						{project.next.map((item) => (
							<li key={item}>
								<i className="fa-regular fa-circle" aria-hidden="true" />
								{item}
							</li>
						))}
					</ul>
				</section>
			)}
		</div>

		<footer className="qc-foot">
			<p>{project.tagline}</p>
			<Links project={project} className="qc-links" />
		</footer>
	</div>
);

export default CardPage;
