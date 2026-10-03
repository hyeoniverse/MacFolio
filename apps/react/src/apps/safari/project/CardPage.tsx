// QRU (디지털 명함): 명함 앞뒤. 앞면(소개)과 뒷면(기술 사양) → 숫자 한 줄 → 명함이 오가는 순서(단계와 화면) → 묻고 답하기(만든 방식, 스크롤하면 위에서부터 차례로 펼쳐진다) → 맡은 일과 다음 단계
import React, { useEffect, useRef, useState } from 'react';
import type { Project, ProjectPoint } from '@/shared/profile';
import { Facts, Favicon, Links, Shot } from '@/apps/safari/project/parts';
import '@/apps/safari/project/CardPage.css';

/** 한 칸씩 펼쳐지는 사이 간격 (ms) */
const STEP = 260;

/**
 * 묻고 답하기: 스크롤해서 각 칸이 화면 아래쪽 1/3을 지나면, 위 칸부터 차례로 하나씩 펼쳐진다.
 * 여러 칸이 한꺼번에 화면에 들어와도 동시에 열리지 않고 간격을 두고 이어서 열린다. 누르면 접고 펼 수 있다
 */
const Answers: React.FC<{ points: ProjectPoint[] }> = ({ points }) => {
	const list = useRef<HTMLDivElement>(null);
	const supported = typeof IntersectionObserver !== 'undefined';
	// 화면에 들어온(또는 이미 지나간) 칸
	const [reached, setReached] = useState<boolean[]>(() => points.map(() => !supported));
	// 앞에서부터 몇 칸이 펼쳐졌나
	const [opened, setOpened] = useState(supported ? 0 : points.length);
	// 누른 칸은 그 뜻을 따른다
	const [toggled, setToggled] = useState<Record<number, boolean>>({});

	useEffect(() => {
		const items = list.current?.querySelectorAll<HTMLElement>('.qc-answer');
		if (!items || !supported) return;
		const observer = new IntersectionObserver(
			(entries) => {
				const seen = entries
					.filter((entry) => entry.isIntersecting || entry.boundingClientRect.bottom < (entry.rootBounds?.top ?? 0))
					.map((entry) => Number((entry.target as HTMLElement).dataset.index));
				if (seen.length) setReached((prev) => prev.map((value, i) => value || seen.includes(i)));
			},
			{ rootMargin: '0px 0px -33% 0px' }
		);
		items.forEach((item) => observer.observe(item));
		return () => observer.disconnect();
	}, [supported]);

	// 다음 칸이 화면에 들어와 있으면 조금 뒤에 연다 (한 번에 한 칸씩)
	useEffect(() => {
		if (opened >= points.length || !reached[opened]) return;
		const timer = window.setTimeout(() => setOpened((count) => count + 1), opened === 0 ? 0 : STEP);
		return () => window.clearTimeout(timer);
	}, [opened, reached, points.length]);

	return (
		<div ref={list}>
			{points.map((point, i) => {
				const open = toggled[i] ?? i < opened;
				return (
					<div key={point.title} className="qc-answer" data-index={i} data-open={open}>
						<button type="button" aria-expanded={open} onClick={() => setToggled((prev) => ({ ...prev, [i]: !open }))}>
							{point.title}
						</button>
						<div className="qc-answer-body">
							<p>{point.body}</p>
						</div>
					</div>
				);
			})}
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
			<Answers points={project.build} />
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
