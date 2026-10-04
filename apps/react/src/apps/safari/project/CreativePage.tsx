// HYEONIVERSE (포트폴리오): Apple 제품 페이지처럼 가운데 정렬된 큰 첫머리 아래로, 화면 폭을 다 쓰는 띠(장)가 번갈아 바탕을 바꾸며 내려간다.
// 그 사이트의 마스코트 몽이는 첫머리에 서 있다가, 내려가면 화면 가장자리로 뛰어가 장마다 자리와 표정을 바꾸며 늘 따라다닌다
import React, { useEffect, useRef, useState } from 'react';
import type { Project, ProjectChapter } from '@/shared/profile';
import { Links, Shot } from '@/apps/safari/project/parts';
import '@/apps/safari/project/CreativePage.css';
import { useReveal } from '@/apps/safari/project/reveal';
import { Bars, Compare, FeatureMedia, ScrollFrames } from '@/apps/safari/project/CreativeParts';
import { ChapterFacts, ChapterPoints } from '@/apps/safari/project/CreativeChapters';
import { Themes } from '@/apps/safari/project/CreativeDemos';
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

/** 몽이가 장마다 옮겨 가는 자리: 오른쪽·왼쪽 아래, 오른쪽·왼쪽 가운데, 오른쪽 위를 돌아가며 (좁은 창은 아래 두 곳만) */
type Spot = 'hero' | 'br' | 'bl' | 'rm' | 'lm' | 'tr' | 'end';
const SPOTS: Spot[] = ['br', 'bl', 'rm', 'lm', 'tr', 'bl', 'br', 'lm'];
const spotOf = (chapter: number, total: number, narrow: boolean): Spot => {
	if (chapter >= total) return 'end';
	const spot = SPOTS[Math.max(0, chapter) % SPOTS.length];
	if (!narrow) return spot;
	return spot === 'bl' || spot === 'lm' ? 'bl' : 'br';
};
/** 몽이 그림 크기 (px): 몸 폭 140, 높이 124. 내용 옆 여백이 좁으면 줄인다 */
const BUDDY_W = 140;
const BUDDY_H = 124;

/** 더 들려줄 장 하나: 첫머리, 숫자, 테마 미리보기, 전후 막대, 장 모양(look)마다 다른 글 묶음, 장 끝 그림(다크가 있으면 밀대) */
const Chapter: React.FC<{ chapter: ProjectChapter; no: string }> = ({ chapter, no }) => (
	<section className="cr-chapter" aria-label={chapter.title} data-look={chapter.look}>
		<p className="cr-no">{no}</p>
		<h2>{chapter.title}</h2>
		{chapter.lead && (
			<p className="cr-chapter-lead" data-reveal="">
				{chapter.lead}
			</p>
		)}
		{chapter.facts && <ChapterFacts facts={chapter.facts} look={chapter.look} />}
		{chapter.palette && <Themes palette={chapter.palette} />}
		{chapter.compare && <Bars rows={chapter.compare} />}
		<ChapterPoints chapter={chapter} />
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
	const root = useReveal<HTMLDivElement>();
	// 몽이(화면 위에 떠 있다)와, 첫머리에서 몽이가 서는 자리
	const buddy = useRef<HTMLElement>(null);
	const slot = useRef<HTMLDivElement>(null);
	const reading = useRef(chapter);
	useEffect(() => {
		reading.current = chapter;
	}, [chapter]);
	const pet = () => {
		const burst = Array.from({ length: 6 }, (_, i) => ({ id: (heartId.current += 1), dx: (i - 2.5) * 22 }));
		setHearts((now) => [...now, ...burst]);
		window.setTimeout(() => setHearts((now) => now.filter((heart) => !burst.includes(heart))), 1100);
	};

	// 장마다 그 장을 얼마나 읽었는지(화면 가운데가 장의 어디쯤인지)를 --read로 (진행 과정 세로줄이 차오른다)
	// 몽이 자리도 여기서 정한다: 첫머리 자리가 화면에 보이면 그 자리에 붙어 함께 스크롤되고, 지나가면 장마다 정한 가장자리로 뛰어간다
	useEffect(() => {
		const body = main.current;
		const page = root.current;
		if (!body || !page) return;
		return onScrollFrame(body, (scroller) => {
			const view = viewOf(scroller);
			const middle = view.top + view.height / 2;
			body.querySelectorAll<HTMLElement>('.cr-chapter').forEach((chapterNode) => {
				const box = chapterNode.getBoundingClientRect();
				chapterNode.style.setProperty('--read', Math.min(1, Math.max(0, (middle - box.top) / box.height)).toFixed(3));
			});
			const figure = buddy.current;
			const seat = slot.current?.getBoundingClientRect();
			if (!figure || !seat) return;
			const frame = page.getBoundingClientRect();
			const width = frame.width;
			const narrow = width <= 760;
			// 내용(가운데 1080px) 옆 여백에 맞춰 크기를 정한다
			const side = Math.max(24, (width - 1080) / 2);
			const scale = narrow ? 0.5 : Math.min(1, Math.max(0.6, (side - 12) / BUDDY_W));
			const w = BUDDY_W * scale;
			const h = BUDDY_H * scale;
			let spot: Spot;
			let x: number;
			let y: number;
			if (seat.bottom > view.top + 40) {
				spot = 'hero';
				x = seat.left - frame.left + (seat.width - BUDDY_W) / 2;
				y = seat.top - view.top;
			} else {
				spot = spotOf(reading.current, titles.length, narrow);
				// 좁은 창은 옆 여백이 없어, 가장자리 밖으로 몸 반쯤 내밀고 엿보게 둔다 (내용을 덜 가린다)
				const right = narrow ? width - w * 0.55 : width - w - 20;
				const left = narrow ? -w * 0.45 : 20;
				const bottom = view.height - h - 16;
				const mid = view.height * 0.42;
				[x, y] = {
					br: [right, bottom],
					bl: [left, bottom],
					rm: [right, mid],
					lm: [left, mid],
					tr: [right, 24],
					end: [(width - w) / 2, bottom],
					hero: [0, 0],
				}[spot];
			}
			figure.dataset.spot = spot;
			figure.style.setProperty('--x', `${Math.round(x)}px`);
			figure.style.setProperty('--y', `${Math.round(y)}px`);
			figure.style.setProperty('--s', spot === 'hero' ? '1' : scale.toFixed(3));
		});
	}, [root, titles.length, chapter]);

	// 화면 가운데를 지나는 장이 지금 읽는 장
	useEffect(() => {
		const root = main.current;
		if (!root || typeof IntersectionObserver === 'undefined') return;
		const parts = [...root.querySelectorAll<HTMLElement>('.cr-chapter, .cr-foot')];
		const seen = new Set<number>();
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					const at = parts.indexOf(entry.target as HTMLElement);
					if (entry.isIntersecting) seen.add(at);
					else seen.delete(at);
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
	const number = (index: number) => String(index + 1).padStart(2, '0');

	return (
		<div className="cr" ref={root} data-reading={chapter >= 0 || undefined}>
			{/* 몽이: 스크롤하는 칸 맨 위에 붙은 높이 0인 층 위에 떠서, 스크립트가 정한 자리(--x, --y)로 옮겨 다닌다 */}
			<div className="cr-buddy">
				<figure
					ref={buddy}
					className="cr-mascot"
					aria-hidden="true"
					data-mood={mood}
					data-spot="hero"
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

			<header className="cr-hero">
				{/* 첫머리에서 몽이가 서는 자리 (몽이는 위 층에 떠 있다) */}
				<div className="cr-hero-seat" ref={slot} />
				<p className="cr-name">{project.name}</p>
				<h1>{project.tagline}</h1>
				<p className="cr-lead">{project.description}</p>
				<Links project={project} className="cr-links" />
			</header>

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
								{point.scrollFrames && <ScrollFrames frames={point.scrollFrames} title={point.title} />}
								{(point.image || point.video || point.variants) && (
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
