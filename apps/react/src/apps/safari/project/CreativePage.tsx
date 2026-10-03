// HYEONIVERSE (포트폴리오): 왼쪽에 제목과 차례가 붙어 있고, 오른쪽만 장(01 기능, 02 만든 방식, 03 맡은 일, 04 기술 사양)을 넘기며 내려간다.
// 왼쪽 위에는 그 사이트의 마스코트 몽이가 서서, 지금 읽는 장에 따라 표정을 바꾼다
import React, { useEffect, useRef, useState } from 'react';
import type { Project } from '@/shared/profile';
import { Favicon, Links, Shot } from '@/apps/safari/project/parts';
import '@/apps/safari/project/CreativePage.css';
import { useReveal } from '@/apps/safari/project/reveal';
import { onScrollFrame, viewOf } from '@/apps/safari/project/scroll';

const CHAPTERS = ['주요 기능', '만든 방식', '맡은 일', '기술 사양'] as const;

const BUNNY = '/imgs/projects/hyeoniverse/bunny';
/** 장마다 몽이의 표정: 처음, 01~04, 끝 (마우스를 올리면 웃는다) */
const MOODS = ['normal', 'wave', 'star', 'happy', 'surprised', 'sleep'] as const;
type Mood = (typeof MOODS)[number];
const moodOf = (chapter: number): Mood => MOODS[Math.min(chapter + 1, MOODS.length - 1)];

const CreativePage: React.FC<{ project: Project }> = ({ project }) => {
	const main = useRef<HTMLDivElement>(null);
	// -1은 장에 들어가기 전, CHAPTERS.length는 끝(맺음말)
	const [chapter, setChapter] = useState(-1);
	const [petted, setPetted] = useState(false);
	// 몽이를 누르면 하트가 퐁퐁 (하트마다 id와 날아갈 방향)
	const [hearts, setHearts] = useState<{ id: number; dx: number }[]>([]);
	const heartId = useRef(0);
	const index = useRef<HTMLElement>(null);
	const root = useReveal<HTMLDivElement>();
	const pet = () => {
		const burst = Array.from({ length: 6 }, (_, i) => ({ id: (heartId.current += 1), dx: (i - 2.5) * 22 }));
		setHearts((now) => [...now, ...burst]);
		window.setTimeout(() => setHearts((now) => now.filter((heart) => !burst.includes(heart))), 1100);
	};

	// 차례마다 그 장을 얼마나 읽었는지(화면 가운데가 장의 어디쯤인지) 막대로 채운다
	useEffect(() => {
		const body = main.current;
		const nav = index.current;
		if (!body || !nav) return;
		return onScrollFrame(body, (scroller) => {
			const view = viewOf(scroller);
			const middle = view.top + view.height / 2;
			const buttons = nav.querySelectorAll<HTMLElement>('button');
			body.querySelectorAll<HTMLElement>('.cr-chapter').forEach((chapterNode, i) => {
				const box = chapterNode.getBoundingClientRect();
				const read = Math.min(1, Math.max(0, (middle - box.top) / box.height));
				buttons[i]?.style.setProperty('--read', read.toFixed(3));
			});
		});
	}, []);

	// 화면 가운데를 지나는 장이 지금 읽는 장
	useEffect(() => {
		const root = main.current;
		if (!root || typeof IntersectionObserver === 'undefined') return;
		const parts = [...root.querySelectorAll<HTMLElement>('.cr-chapter, .cr-foot')];
		const seen = new Set<number>();
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					const index = parts.indexOf(entry.target as HTMLElement);
					if (entry.isIntersecting) seen.add(index);
					else seen.delete(index);
				}
				setChapter(seen.size ? Math.max(...seen) : -1);
			},
			{ rootMargin: '-45% 0px -45% 0px' }
		);
		parts.forEach((part) => observer.observe(part));
		return () => observer.disconnect();
	}, []);
	const mood: Mood = petted ? 'happy' : moodOf(chapter);
	const open = (index: number) => {
		const chapters = main.current?.querySelectorAll<HTMLElement>('.cr-chapter');
		chapters?.[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};
	const number = (index: number) => String(index + 1).padStart(2, '0');

	return (
		<div className="cr" ref={root}>
			<div className="cr-side" data-reading={chapter >= 0 || undefined}>
				<Favicon project={project} className="cr-icon" />
				<p className="cr-name">{project.name}</p>
				<h1>{project.tagline}</h1>
				<p className="cr-lead">{project.description}</p>
				<Links project={project} className="cr-links" />
				<nav className="cr-index" aria-label="차례" ref={index}>
					<ol>
						{CHAPTERS.map((title, i) => (
							<li key={title}>
								<button type="button" onClick={() => open(i)} aria-current={chapter === i ? 'step' : undefined}>
									<span>{number(i)}</span>
									{title}
								</button>
							</li>
						))}
					</ol>
				</nav>
				<figure
					className="cr-mascot"
					aria-hidden="true"
					data-mood={mood}
					onPointerEnter={() => setPetted(true)}
					onPointerLeave={() => setPetted(false)}
					onClick={pet}
					data-hop={hearts.length > 0 || undefined}
				>
					{MOODS.map((name) => (
						<img key={name} src={`${BUNNY}/${name}-front.webp`} alt="" data-on={name === mood} />
					))}
					{hearts.map((heart) => (
						<i
							key={heart.id}
							className="cr-heart fa-solid fa-heart"
							style={{ '--dx': heart.dx } as React.CSSProperties}
						/>
					))}
				</figure>
			</div>

			<div className="cr-main" ref={main}>
				<Shot project={project} className="cr-shot" />

				<section className="cr-facts" aria-label="한눈에 보기" data-reveal="">
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
						{project.highlights.map((point, i) => (
							<li key={point.title} data-reveal="left" style={{ '--d': i } as React.CSSProperties}>
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
						{project.build.map((point, i) => (
							<article key={point.title} data-reveal="" style={{ '--d': i % 2 } as React.CSSProperties}>
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
						{project.contributions.map((item, i) => (
							<li key={item} data-reveal="left" style={{ '--d': i } as React.CSSProperties}>
								{item}
							</li>
						))}
					</ul>
				</section>

				<section className="cr-chapter" aria-label="기술 사양">
					<p className="cr-no">{number(3)}</p>
					<h2>기술 사양</h2>
					<dl className="cr-specs">
						{project.specs.map((spec, i) => (
							<div key={spec.label} data-reveal="" style={{ '--d': i % 3 } as React.CSSProperties}>
								<dt>{spec.label}</dt>
								<dd>{spec.value}</dd>
							</div>
						))}
					</dl>
				</section>

				<footer className="cr-foot" data-reveal="">
					<p>{project.tagline}</p>
					<Links project={project} className="cr-links" />
				</footer>
			</div>
		</div>
	);
};

export default CreativePage;
