// HYEONIVERSE (포트폴리오): 왼쪽에 제목과 차례가 붙어 있고, 오른쪽만 장(기능, 더 들려줄 장들, 진행 과정 또는 만든 방식, 맡은 일, 기술 사양)을 넘기며 내려간다.
// 왼쪽 위에는 그 사이트의 마스코트 몽이가 서서, 지금 읽는 장에 따라 표정을 바꾼다
import React, { useEffect, useRef, useState } from 'react';
import type { Project, ProjectChapter, ProjectFact, ProjectPoint } from '@/shared/profile';
import { FactValue, Favicon, Links, Shot } from '@/apps/safari/project/parts';
import '@/apps/safari/project/CreativePage.css';
import { useReveal } from '@/apps/safari/project/reveal';
import { Bars, Clip, Compare, FeatureMedia, ZoomImage } from '@/apps/safari/project/CreativeParts';
import { Demo, Themes } from '@/apps/safari/project/CreativeDemos';
import { onScrollFrame, scrollParent, viewOf } from '@/apps/safari/project/scroll';

/** 진행 과정이 있으면 만든 방식을 그 장에 품질 장치로 함께 싣는다 */
const buildTitle = (project: Project) => (project.timeline ? '진행 과정과 품질' : '만든 방식');

/** 차례: 주요 기능 → 더 들려줄 장들 → 진행 과정(만든 방식) → 맡은 일 → 기술 사양 */
const chaptersOf = (project: Project) => [
	'주요 기능',
	...(project.chapters ?? []).map((chapter) => chapter.title),
	buildTitle(project),
	'맡은 일',
	'기술 사양',
];

const BUNNY = '/imgs/projects/hyeoniverse/bunny';
const MOODS = ['normal', 'wave', 'star', 'happy', 'surprised', 'sleep'] as const;
type Mood = (typeof MOODS)[number];
/** 장마다 몽이의 표정: 들어가기 전엔 그냥, 장마다 손 흔들기·별·웃음·놀람을 돌아가며, 끝에선 잔다 (마우스를 올리면 웃는다) */
const READING: Mood[] = ['wave', 'star', 'happy', 'surprised'];
const moodOf = (chapter: number, total: number): Mood =>
	chapter < 0 ? 'normal' : chapter >= total ? 'sleep' : READING[chapter % READING.length];

/** 장 안의 숫자 한 줄 */
const ChapterFacts: React.FC<{ facts: ProjectFact[] }> = ({ facts }) => (
	<ul className="cr-chapter-facts" data-reveal="">
		{facts.map((fact) => (
			<li key={fact.label}>
				<FactValue text={fact.value} />
				<span>{fact.label}</span>
			</li>
		))}
	</ul>
);

/** 실제 화면 여러 장: 영상(.mp4)은 넓게 두고 화면에 보일 때만 돌리고, 그림은 눌러 크게 본다 */
const Shots: React.FC<{ shots: NonNullable<ProjectPoint['shots']> }> = ({ shots }) => (
	<div className="cr-shots">
		<p>실제 화면</p>
		<ul>
			{shots.map((shot) => (
				<li key={shot.src} data-video={shot.src.endsWith('.mp4') || undefined}>
					{shot.src.endsWith('.mp4') ? (
						<Clip src={shot.src} label={shot.alt} />
					) : (
						<ZoomImage src={shot.src} alt={shot.alt} />
					)}
					<span>{shot.alt}</span>
				</li>
			))}
		</ul>
	</div>
);

/** 더 들려줄 장 하나: 첫머리, 숫자, 테마 미리보기, 전후 막대, 글 묶음(그림이나 데모가 있으면 옆에), 장 끝 그림(다크가 있으면 밀대) */
const Chapter: React.FC<{ chapter: ProjectChapter; no: string }> = ({ chapter, no }) => (
	<section className="cr-chapter" aria-label={chapter.title}>
		<p className="cr-no">{no}</p>
		<h2>{chapter.title}</h2>
		{chapter.lead && (
			<p className="cr-chapter-lead" data-reveal="">
				{chapter.lead}
			</p>
		)}
		{chapter.facts && <ChapterFacts facts={chapter.facts} />}
		{chapter.palette && <Themes palette={chapter.palette} />}
		{chapter.compare && <Bars rows={chapter.compare} />}
		<div className="cr-build">
			{chapter.points.map((point, i) => (
				<article
					key={point.title}
					data-reveal=""
					data-wide={point.image || point.demo || point.shots ? '' : undefined}
					data-demo={point.demo || point.shots ? '' : undefined}
					style={{ '--d': i % 2 } as React.CSSProperties}
				>
					{point.demo ? (
						<div className="cr-point-demo">
							<Demo kind={point.demo} />
							{point.shots && <Shots shots={point.shots} />}
						</div>
					) : point.shots ? (
						<div className="cr-point-demo">
							<Shots shots={point.shots} />
						</div>
					) : (
						point.image && (
							<figure className="cr-point-shot">
								<ZoomImage src={point.image} alt={`${point.title} 화면`} />
							</figure>
						)
					)}
					<div>
						<h3>{point.title}</h3>
						<p>{point.body}</p>
					</div>
				</article>
			))}
		</div>
		{chapter.image && (
			<figure className="cr-figure" data-reveal="">
				{chapter.image.dark ? (
					<Compare light={chapter.image.src} dark={chapter.image.dark} alt={chapter.image.alt} />
				) : (
					<img src={chapter.image.src} alt={chapter.image.alt} />
				)}
				<figcaption>{chapter.image.alt}</figcaption>
			</figure>
		)}
	</section>
);

const CreativePage: React.FC<{ project: Project }> = ({ project }) => {
	const main = useRef<HTMLDivElement>(null);
	const titles = chaptersOf(project);
	const extra = project.chapters ?? [];
	// 장 번호: 주요 기능이 01, 더 들려줄 장이 그다음, 그 뒤로 진행 과정·맡은 일·기술 사양
	const after = extra.length + 1;
	// -1은 장에 들어가기 전, titles.length는 끝(맺음말)
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
				const read = Math.min(1, Math.max(0, (middle - box.top) / box.height)).toFixed(3);
				buttons[i]?.style.setProperty('--read', read);
				chapterNode.style.setProperty('--read', read);
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
			// 기준은 페이지를 스크롤하는 칸의 가운데 (창이 작아도 칸 안에서 잰다)
			{ root: scrollParent(root), rootMargin: '-45% 0px -45% 0px' }
		);
		parts.forEach((part) => observer.observe(part));
		return () => observer.disconnect();
	}, []);
	const mood: Mood = petted ? 'happy' : moodOf(chapter, titles.length);
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
						{titles.map((title, i) => (
							<li key={title}>
								{/* 맺음말까지 내려와도 차례에서는 마지막 장을 읽는 중으로 둔다 */}
								<button
									type="button"
									onClick={() => open(i)}
									aria-current={
										chapter === i || (i === titles.length - 1 && chapter >= titles.length) ? 'step' : undefined
									}
								>
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
							<li key={point.title} style={{ '--d': i } as React.CSSProperties}>
								<div className="cr-feature-text" data-reveal="left">
									<h3>{point.title}</h3>
									<p>{point.body}</p>
								</div>
								{(point.image || point.video || point.variants || point.scrollFrames) && (
									<figure className="cr-feature-media" data-reveal="zoom">
										<FeatureMedia point={point} />
									</figure>
								)}
							</li>
						))}
					</ol>
				</section>

				{extra.map((item, i) => (
					<Chapter key={item.title} chapter={item} no={number(i + 1)} />
				))}

				<section className="cr-chapter" aria-label={buildTitle(project)}>
					<p className="cr-no">{number(after)}</p>
					<h2>{buildTitle(project)}</h2>
					{project.timeline && (
						<ol className="cr-timeline">
							{project.timeline.map((step, i) => (
								<li key={step.date} data-reveal="left" style={{ '--d': i % 4 } as React.CSSProperties}>
									<time>{step.date}</time>
									<span>{step.label}</span>
								</li>
							))}
						</ol>
					)}
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
					<p className="cr-no">{number(after + 1)}</p>
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
					<p className="cr-no">{number(after + 2)}</p>
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
