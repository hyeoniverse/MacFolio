// 직접 짠 페이지: whattodo 전용 (처음부터 이 프로젝트를 위해 짠 페이지. custom/index.ts에 등록돼 있고 look이 custom이면 이걸로 그린다)
import { cssVars } from '@/shared/lib/cssVars';
// WTD (할 일 관리): 칸반 보드. 머리(소개와 숫자) → 할 일·진행 중·완료 세 열(기능·만든 방식·맡은 일) → 쓰는 법 두 줄 → 에픽(장마다 붙임쪽지) → 날짜별 스프린트 → 폴더 구조 → 라벨(기술 사양)
import React, { useState } from 'react';
import type { Project } from '@/shared/profile';
import { Facts, Favicon, Links, Shot } from '@/apps/safari/project/parts';
import '@/apps/safari/project/custom/WhatToDoPage.css';
import { useReveal } from '@/apps/safari/project/reveal';

type Lane = 'todo' | 'doing' | 'done';

const LANES: { id: Lane; label: string; status: string }[] = [
	{ id: 'todo', label: '주요 기능', status: '할 일' },
	{ id: 'doing', label: '만든 방식', status: '진행 중' },
	{ id: 'done', label: '맡은 일', status: '완료' },
];

const NEXT: Record<Lane, Lane> = { todo: 'doing', doing: 'done', done: 'todo' };

type Card = { id: string; title?: string; body: string; home: Lane };

/** 처음 자리: 기능은 할 일, 만든 방식은 진행 중, 맡은 일은 완료 */
const cardsOf = (project: Project): Card[] => [
	...project.highlights.map((point) => ({
		id: `todo:${point.title}`,
		title: point.title,
		body: point.body,
		home: 'todo' as const,
	})),
	...project.build.map((point) => ({
		id: `doing:${point.title}`,
		title: point.title,
		body: point.body,
		home: 'doing' as const,
	})),
	...project.contributions.map((item) => ({ id: `done:${item}`, body: item, home: 'done' as const })),
];

/**
 * 진짜 칸반처럼 카드를 끌어 다른 열에 놓거나, 카드의 화살표 단추로 다음 열로 옮긴다.
 * 옮긴 자리는 이 페이지에서만 기억하고, "처음대로"로 되돌린다
 */
const Board: React.FC<{ project: Project }> = ({ project }) => {
	const cards = cardsOf(project);
	const [moved, setMoved] = useState<Record<string, Lane>>({});
	const [over, setOver] = useState<Lane | null>(null);
	const laneOf = (card: Card) => moved[card.id] ?? card.home;
	const move = (id: string, lane: Lane) => setMoved((now) => ({ ...now, [id]: lane }));
	const changed = cards.some((card) => laneOf(card) !== card.home);

	return (
		<div className="kb-board-wrap">
			<p className="kb-hint">
				<i className="fa-solid fa-hand-pointer" aria-hidden="true" /> 카드를 끌어 다른 열에 놓아 보세요
				{changed && (
					<button type="button" className="kb-reset" onClick={() => setMoved({})}>
						<i className="fa-solid fa-rotate-left" aria-hidden="true" /> 처음대로
					</button>
				)}
			</p>
			<div className="kb-board">
				{LANES.map((lane, laneIndex) => {
					const list = cards.filter((card) => laneOf(card) === lane.id);
					return (
						<section
							key={lane.id}
							className="kb-col"
							data-tone={lane.id}
							data-over={over === lane.id || undefined}
							aria-label={lane.label}
							onDragOver={(event) => {
								event.preventDefault();
								setOver(lane.id);
							}}
							onDragLeave={() => setOver((now) => (now === lane.id ? null : now))}
							onDrop={(event) => {
								event.preventDefault();
								const id = event.dataTransfer.getData('text/plain');
								if (id) move(id, lane.id);
								setOver(null);
							}}
						>
							<h2>
								<span className="kb-status">{lane.status}</span>
								{lane.label}
								<span className="kb-count" key={list.length}>
									{list.length}
								</span>
							</h2>
							<ul>
								{list.map((card, i) => (
									<li
										key={card.id}
										className={lane.id === 'done' ? 'kb-card done' : 'kb-card'}
										draggable
										onDragStart={(event) => {
											event.dataTransfer.setData('text/plain', card.id);
											event.dataTransfer.effectAllowed = 'move';
										}}
										onDragEnd={() => setOver(null)}
										data-reveal="drop"
										style={cssVars({ d: laneIndex + i * 0.6 })}
									>
										{lane.id === 'done' && <i className="fa-solid fa-square-check" aria-hidden="true" />}
										<div className="kb-text">
											{card.title && <h3>{card.title}</h3>}
											<p>{card.body}</p>
										</div>
										<button
											type="button"
											className="kb-move"
											aria-label={`${card.title ?? card.body}: ${LANES.find((item) => item.id === NEXT[lane.id])?.status}(으)로 옮기기`}
											onClick={() => move(card.id, NEXT[lane.id])}
										>
											<i
												className={lane.id === 'done' ? 'fa-solid fa-rotate-left' : 'fa-solid fa-arrow-right'}
												aria-hidden="true"
											/>
										</button>
									</li>
								))}
							</ul>
						</section>
					);
				})}
			</div>
		</div>
	);
};

const WhatToDoPage: React.FC<{ project: Project }> = ({ project }) => {
	const root = useReveal<HTMLDivElement>();
	return (
		<div className="kb" ref={root}>
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

			<section className="kb-stats" aria-label="한눈에 보기" data-reveal="">
				<p>{project.context}</p>
				<Facts project={project} className="kb-facts" />
			</section>

			<Board project={project} />

			{project.usage && (
				<section className="kb-usage" aria-label="쓰는 법" data-reveal="">
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

			{project.chapters?.map((chapter) => (
				<section key={chapter.title} className="kb-epic" aria-label={chapter.title}>
					<h2 className="kb-title">
						에픽 <span className="kb-epic-name">{chapter.title}</span>
					</h2>
					{chapter.lead && (
						<p className="kb-epic-lead" data-reveal="">
							{chapter.lead}
						</p>
					)}
					<ul className="kb-notes">
						{chapter.points.map((point, i) => (
							<li key={point.title} data-reveal="drop" style={cssVars({ d: i % 3, n: i })}>
								<h3>{point.title}</h3>
								<p>{point.body}</p>
							</li>
						))}
					</ul>
				</section>
			))}

			{project.timeline && (
				<section className="kb-sprint" aria-label="진행 과정" data-reveal="">
					<h2 className="kb-title">
						스프린트 <span>{project.period}</span>
					</h2>
					<ol>
						{project.timeline.map((step, i) => (
							<li key={step.date} style={cssVars({ i })}>
								<time>{step.date}</time>
								<span>{step.label}</span>
							</li>
						))}
					</ol>
				</section>
			)}

			{project.structure && (
				<section className="kb-tree" aria-label="폴더 구조" data-reveal="">
					<h2 className="kb-title">폴더 구조</h2>
					<pre>{project.structure}</pre>
				</section>
			)}

			<section className="kb-labels" aria-label="기술 사양" data-reveal="">
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
};

export default WhatToDoPage;
