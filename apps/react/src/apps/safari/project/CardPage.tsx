// QRU (디지털 명함): 명함 앞뒤. 앞면(소개)과 뒷면(기술 사양) → 숫자 한 줄 → 명함이 오가는 순서(단계와 화면) → 묻고 답하기(만든 방식, 스크롤하면 펼쳐진다) → 맡은 일과 다음 단계
import React, { useEffect, useRef, useState } from 'react';
import type { Project, ProjectPoint } from '@/shared/profile';
import { Facts, Favicon, Links, Shot } from '@/apps/safari/project/parts';
import '@/apps/safari/project/CardPage.css';

/** 묻고 답하기 한 칸: 스크롤해서 화면 아래쪽 3/4 안으로 들어오면 펼쳐진다. 누르면 접고 펼 수도 있다 */
const Answer: React.FC<{ point: ProjectPoint }> = ({ point }) => {
	const ref = useRef<HTMLDivElement>(null);
	// IntersectionObserver가 없으면 처음부터 펼친다
	const [open, setOpen] = useState(() => typeof IntersectionObserver === 'undefined');

	useEffect(() => {
		const element = ref.current;
		if (!element || typeof IntersectionObserver === 'undefined') return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry.isIntersecting) return;
				setOpen(true);
				observer.disconnect();
			},
			{ rootMargin: '0px 0px -25% 0px' }
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	return (
		<div ref={ref} className="qc-answer" data-open={open}>
			<button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
				{point.title}
			</button>
			<div className="qc-answer-body">
				<p>{point.body}</p>
			</div>
		</div>
	);
};

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
			{project.build.map((point) => (
				<Answer key={point.title} point={point} />
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
