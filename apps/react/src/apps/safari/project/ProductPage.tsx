// MacFolio: Apple 제품 페이지 흐름 그대로. 아이콘과 큰 제목 → 숫자 띠 → 기능 타일 → 어두운 만든 방식 → 맡은 일 → 기술 사양 표
import React from 'react';
import type { Project } from '@/shared/profile';
import { Facts, Favicon, Links, Shot } from '@/apps/safari/project/parts';

const Headline: React.FC<{ title: string; sub?: string }> = ({ title, sub }) => (
	<h2 className="sp-headline">
		{title}
		{sub && <span> {sub}</span>}
	</h2>
);

const ProductPage: React.FC<{ project: Project }> = ({ project }) => (
	<>
		<section className="sp-hero">
			<div className="sp-hero-main">
				<Favicon project={project} className="sp-app-icon" />
				<p className="sp-eyebrow">{project.name}</p>
				<h1>{project.tagline}</h1>
				<p className="sp-lead">{project.description}</p>
				<Links project={project} />
			</div>
			<Shot project={project} />
		</section>

		<section className="sp-band" aria-label="한눈에 보기">
			<div className="sp-inner">
				<p className="sp-meta">
					{project.context}
					{project.period && ` · ${project.period}`}
				</p>
				<Facts project={project} />
			</div>
		</section>

		<section className="sp-section" aria-label="주요 기능">
			<div className="sp-inner">
				<Headline title="주요 기능." sub="지금 보고 있는 이 화면." />
				<ul className="sp-tiles">
					{project.highlights.map((point, i) => (
						// 개수가 홀수면 첫 타일을 넓게 해 빈칸을 없앤다
						<li key={point.title} className={i === 0 && project.highlights.length % 2 === 1 ? 'wide' : undefined}>
							<h3>{point.title}</h3>
							<p>{point.body}</p>
						</li>
					))}
				</ul>
			</div>
		</section>

		<section className="sp-section sp-dark" aria-label="만든 방식">
			<div className="sp-inner">
				<Headline title="만든 방식." sub="보이지 않는 곳에서 신경 쓴 것들." />
				<ul className="sp-points">
					{project.build.map((point) => (
						<li key={point.title}>
							<h3>{point.title}</h3>
							<p>{point.body}</p>
						</li>
					))}
				</ul>
			</div>
		</section>

		<section className="sp-section sp-alt" aria-label="맡은 일">
			<div className="sp-inner sp-split">
				<Headline title="맡은 일." sub={project.role} />
				<ul className="sp-checks">
					{project.contributions.map((item) => (
						<li key={item}>
							<i className="fa-solid fa-circle-check" aria-hidden="true" />
							{item}
						</li>
					))}
				</ul>
			</div>
		</section>

		<section className="sp-section" aria-label="기술 사양">
			<div className="sp-inner">
				<h2 className="sp-specs-title">기술 사양</h2>
				<dl className="sp-specs">
					{project.specs.map((spec) => (
						<div key={spec.label}>
							<dt>{spec.label}</dt>
							<dd>{spec.value}</dd>
						</div>
					))}
				</dl>
			</div>
		</section>

		<footer className="sp-cta">
			<p>{project.tagline}</p>
			<Links project={project} />
		</footer>
	</>
);

export default ProductPage;
