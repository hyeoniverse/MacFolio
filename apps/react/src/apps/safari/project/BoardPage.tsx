// WTD (할 일 관리): 칸반 보드. 머리(소개와 숫자) → 할 일·진행 중·완료 세 열(기능·만든 방식·맡은 일) → 쓰는 법 두 줄 → 날짜별 스프린트 → 폴더 구조 → 라벨(기술 사양)
import React from 'react';
import type { Project } from '@/shared/profile';
import { Facts, Favicon, Links, Shot } from '@/apps/safari/project/parts';
import '@/apps/safari/project/BoardPage.css';

const Column: React.FC<{ label: string; status: string; tone: string; count: number; children: React.ReactNode }> = ({
	label,
	status,
	tone,
	count,
	children,
}) => (
	<section className="kb-col" data-tone={tone} aria-label={label}>
		<h2>
			<span className="kb-status">{status}</span>
			{label}
			<span className="kb-count">{count}</span>
		</h2>
		<ul>{children}</ul>
	</section>
);

const BoardPage: React.FC<{ project: Project }> = ({ project }) => (
	<div className="kb">
		<header className="kb-head">
			<div className="kb-intro">
				<Favicon project={project} className="kb-icon" />
				<p className="kb-name">{project.name}</p>
				<h1>{project.tagline}</h1>
				<p className="kb-lead">{project.description}</p>
				<Links project={project} className="kb-links" />
			</div>
			<Shot project={project} className="kb-shot" />
		</header>

		<section className="kb-stats" aria-label="한눈에 보기">
			<p>{project.context}</p>
			<Facts project={project} className="kb-facts" />
		</section>

		<div className="kb-board">
			<Column label="주요 기능" status="할 일" tone="todo" count={project.highlights.length}>
				{project.highlights.map((point) => (
					<li key={point.title} className="kb-card">
						<h3>{point.title}</h3>
						<p>{point.body}</p>
					</li>
				))}
			</Column>
			<Column label="만든 방식" status="진행 중" tone="doing" count={project.build.length}>
				{project.build.map((point) => (
					<li key={point.title} className="kb-card">
						<h3>{point.title}</h3>
						<p>{point.body}</p>
					</li>
				))}
			</Column>
			<Column label="맡은 일" status="완료" tone="done" count={project.contributions.length}>
				{project.contributions.map((item) => (
					<li key={item} className="kb-card done">
						<i className="fa-solid fa-square-check" aria-hidden="true" />
						<p>{item}</p>
					</li>
				))}
			</Column>
		</div>

		{project.usage && (
			<section className="kb-usage" aria-label="쓰는 법">
				<h2 className="kb-title">쓰는 법</h2>
				<div className="kb-lanes">
					{project.usage.map((lane, i) => (
						<div key={lane.title} className="kb-lane" data-tone={i === 0 ? 'todo' : 'done'}>
							<h3>{lane.title}</h3>
							<p>{lane.body}</p>
						</div>
					))}
				</div>
			</section>
		)}

		{project.timeline && (
			<section className="kb-sprint" aria-label="진행 과정">
				<h2 className="kb-title">
					스프린트 <span>{project.period}</span>
				</h2>
				<ol>
					{project.timeline.map((step, i) => (
						<li key={step.date} style={{ '--i': i } as React.CSSProperties}>
							<time>{step.date}</time>
							<span>{step.label}</span>
						</li>
					))}
				</ol>
			</section>
		)}

		{project.structure && (
			<section className="kb-tree" aria-label="폴더 구조">
				<h2 className="kb-title">폴더 구조</h2>
				<pre>{project.structure}</pre>
			</section>
		)}

		<section className="kb-labels" aria-label="기술 사양">
			<h2>기술 사양</h2>
			<ul>
				{project.specs.map((spec) => (
					<li key={spec.label}>
						<span>{spec.label}</span>
						{spec.value}
					</li>
				))}
			</ul>
		</section>

		<footer className="kb-foot">
			<p>{project.tagline}</p>
			<Links project={project} className="kb-links" />
		</footer>
	</div>
);

export default BoardPage;
