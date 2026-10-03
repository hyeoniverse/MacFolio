// QRU (디지털 명함): 명함 앞뒤. 앞면(소개)과 뒷면(기술 사양) → 숫자 한 줄 → 명함이 오가는 순서(단계와 화면) → 묻고 답하기(만든 방식) → 맡은 일과 다음 단계.
// 순서와 묻고 답하기는 스크롤에 맞춰 위에서부터 차례로 펼쳐지고, 다시 올리면 아래부터 접힌다
import React, { useEffect, useRef, useState } from 'react';
import type { Project, ProjectPoint } from '@/shared/profile';
import { Facts, Favicon, Links, Shot } from '@/apps/safari/project/parts';
import '@/apps/safari/project/CardPage.css';
import { scrollParent } from '@/apps/safari/project/scroll';

/** 한 칸씩 펼치거나 접는 사이 간격 (ms). 빠르게 스크롤해도 한꺼번에가 아니라 차례로 */
const STEP = 220;
/** 칸의 머리가 화면 위에서 이 비율만큼 내려온 선을 지나면 펼친다 (읽는 눈높이쯤) */
const LINE = 0.6;

/**
 * 스크롤에 맞춰 위 칸부터 차례로 펼치고, 다시 올리면 아래 칸부터 차례로 접는다.
 * 칸의 머리(`[data-index]`)가 기준선 위로 올라온 만큼이 목표이고, 지금 펼친 수를 한 칸씩 그 목표로 옮긴다.
 * 펼친 수를 돌려준다
 */
function useScrollUnfold(list: React.RefObject<HTMLElement | null>, count: number) {
	const supported = typeof window !== 'undefined' && 'requestAnimationFrame' in window;
	const [target, setTarget] = useState(supported ? 0 : count);
	const [opened, setOpened] = useState(supported ? 0 : count);

	useEffect(() => {
		const root = list.current;
		if (!root || !supported) return;
		const scroller = scrollParent(root);
		const source = scroller ?? window;
		let frame = 0;
		const measure = () => {
			frame = 0;
			const view = scroller?.getBoundingClientRect();
			const line = view ? view.top + view.height * LINE : window.innerHeight * LINE;
			const heads = root.querySelectorAll<HTMLElement>('[data-index]');
			let reached = 0;
			for (const head of heads) {
				if (head.getBoundingClientRect().top > line) break;
				reached += 1;
			}
			setTarget(reached);
		};
		const onScroll = () => {
			if (!frame) frame = requestAnimationFrame(measure);
		};
		measure();
		source.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onScroll);
		return () => {
			source.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onScroll);
			cancelAnimationFrame(frame);
		};
	}, [list, supported]);

	useEffect(() => {
		if (opened === target) return;
		const timer = window.setTimeout(() => setOpened((now) => now + Math.sign(target - now)), STEP);
		return () => window.clearTimeout(timer);
	}, [opened, target]);

	return opened;
}

/** 묻고 답하기: 스크롤에 맞춰 펼치고 접는다. 누르면 그 칸만 직접 접고 펼 수 있다(그 칸을 스크롤이 다시 지나면 스크롤을 따른다) */
const Answers: React.FC<{ points: ProjectPoint[] }> = ({ points }) => {
	const list = useRef<HTMLDivElement>(null);
	const opened = useScrollUnfold(list, points.length);
	const [toggled, setToggled] = useState<Record<number, boolean>>({});
	const [lastOpened, setLastOpened] = useState(opened);
	// 스크롤이 지나간 칸은 누른 뜻을 잊는다
	if (lastOpened !== opened) {
		setLastOpened(opened);
		const [from, to] = [Math.min(lastOpened, opened), Math.max(lastOpened, opened)];
		setToggled((prev) => Object.fromEntries(Object.entries(prev).filter(([i]) => Number(i) < from || Number(i) >= to)));
	}

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

/** 명함 한 장이 오가는 순서: 단계마다 번호와 제목은 늘 보이고, 스크롤에 맞춰 설명이 차례로 펼쳐지며 다음 단계로 선이 이어진다 */
const Steps: React.FC<{ points: ProjectPoint[] }> = ({ points }) => {
	const list = useRef<HTMLOListElement>(null);
	const opened = useScrollUnfold(list, points.length);
	return (
		<ol className="qc-steps" ref={list}>
			{points.map((point, i) => (
				<li key={point.title} data-index={i} data-open={i < opened}>
					<span className="qc-step">{i + 1}</span>
					<h3>{point.title}</h3>
					<div className="qc-step-body">
						<p>{point.body}</p>
					</div>
				</li>
			))}
		</ol>
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
				<Steps points={project.highlights} />
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
