// creative: 큰 타이포와 스크롤 챕터. 첫 화면은 화면을 꽉 채운 이름·한 줄 소개 글자, 왼쪽에 붙은 차례가 지금 읽는 장을 가리키고,
// 장마다 거대한 번호가 바탕에 흐리게 깔린 채 바탕 톤이 번갈아 내려간다. 데모·장 모양(look) 조각은 그대로 가져다 쓰고,
// HYEONIVERSE에서는 마스코트 몽이가 데모를 거든다 (creative/Mascot.tsx)
import React, { useEffect, useRef, useState } from 'react';
import { cssVars } from '@/shared/lib/cssVars';
import type { Project, ProjectChapter, ProjectPoint } from '@/shared/profile';
import { Facts, Links } from '@/apps/safari/project/parts';
import { useReveal } from '@/apps/safari/project/reveal';
import { scrollParent } from '@/apps/safari/project/scroll';
import { Bars, Compare, FeatureMedia, ScrollFrames, ZoomImage } from '@/apps/safari/project/CreativeParts';
import { ChapterFacts, ChapterPoints, Shots } from '@/apps/safari/project/CreativeChapters';
import { Demo } from '@/apps/safari/project/creative/Demo';
import { Themes } from '@/apps/safari/project/creative/Themes';
import { Mascot } from '@/apps/safari/project/creative/Mascot';
import '@/apps/safari/project/CreativePage.css';

/** 장의 바탕 톤: 밝은 바탕, 한 단 어두운 바탕, 어두운 바탕을 돌아가며 리듬을 준다 */
const TONES = ['bg', 'alt', 'dark'] as const;
const number = (index: number) => String(index + 1).padStart(2, '0');

/** 장 하나의 뼈대: 바탕에 깔린 거대한 번호, 번호와 큰 제목, 첫머리 글, 그 아래 내용. .cr-chapter는 장 모양 조각(CreativeChapters.css)이 타일 색의 기준으로 삼는다 */
const Section: React.FC<{
	index: number;
	title: string;
	lead?: string;
	look?: ProjectChapter['look'];
	children: React.ReactNode;
}> = ({ index, title, lead, look, children }) => (
	<section
		className="ct-chapter cr-chapter"
		aria-label={title}
		data-tone={TONES[index % TONES.length]}
		data-look={look}
	>
		<span className="ct-ghost" aria-hidden="true">
			{number(index)}
		</span>
		<header className="ct-chapter-head">
			<p className="ct-chapter-no">
				<span>{number(index)}</span>
			</p>
			<h2>{title}</h2>
			{lead && (
				<p className="ct-chapter-lead" data-reveal="">
					{lead}
				</p>
			)}
		</header>
		<div className="ct-chapter-body">{children}</div>
	</section>
);

/** 주요 기능 한 항목: 번호 붙은 글 뒤에 스크롤 장면, 화면(그림·영상·레이아웃), 데모, 실제 화면 중 있는 것 */
const Feature: React.FC<{ point: ProjectPoint; index: number }> = ({ point, index }) => (
	<li className="ct-feature" style={cssVars({ d: index % 3 })}>
		<div className="ct-feature-text" data-reveal="left">
			<span className="ct-feature-idx" aria-hidden="true">
				{number(index)}
			</span>
			<h3>{point.title}</h3>
			<p>{point.body}</p>
		</div>
		{point.scrollFrames && <ScrollFrames frames={point.scrollFrames} title={point.title} />}
		{(point.image || point.video || point.variants) && (
			<figure className="cr-feature-media" data-reveal="zoom">
				<FeatureMedia point={point} />
			</figure>
		)}
		{point.demo && (
			<div className="cr-point-demo" data-demo={point.demo}>
				<Demo kind={point.demo} />
			</div>
		)}
		{point.shots && !point.demo && (
			<div className="cr-point-demo">
				<Shots shots={point.shots} />
			</div>
		)}
	</li>
);

/** 더 들려줄 장의 속: 숫자, 테마 미리보기, 전후 막대, 장 모양마다 다른 글 묶음, 장 끝 그림(다크가 있으면 밀대) */
const ChapterBody: React.FC<{ chapter: ProjectChapter }> = ({ chapter }) => (
	<>
		{chapter.facts && <ChapterFacts facts={chapter.facts} look={chapter.look} />}
		{chapter.palette && <Themes palette={chapter.palette} />}
		{chapter.compare && <Bars rows={chapter.compare} />}
		<ChapterPoints chapter={chapter} />
		{/* 테마 장은 장 그림을 항목 화면(붙은 화면)으로 쓰므로 끝에 따로 두지 않는다 */}
		{chapter.image && chapter.look !== 'palette' && (
			<figure className="ct-figure" data-reveal="">
				{chapter.image.dark ? (
					<Compare light={chapter.image.src} dark={chapter.image.dark} alt={chapter.image.alt} />
				) : (
					<img src={chapter.image.src} alt={chapter.image.alt} loading="lazy" />
				)}
				<figcaption>{chapter.image.alt}</figcaption>
			</figure>
		)}
	</>
);

/** 장 하나: 차례에 보일 제목과, 그릴 내용 */
interface Part {
	title: string;
	lead?: string;
	look?: ProjectChapter['look'];
	body: React.ReactNode;
}

/** 차례: 주요 기능 → 더 들려줄 장들 → 만든 방식 → 진행 과정 → 쓰는 법 → 맡은 일 → 기술 사양 (없는 것은 뺀다) */
const partsOf = (project: Project): Part[] => {
	const parts: Part[] = [];
	if (project.highlights.length)
		parts.push({
			title: '주요 기능',
			body: (
				<>
					<ol className="ct-features">
						{project.highlights.map((point, i) => (
							<Feature key={point.title} point={point} index={i} />
						))}
					</ol>
					{project.gallery?.length ? (
						<ul className="ct-gallery" aria-label="화면 모음">
							{project.gallery.map((shot) => (
								<li key={shot.src} data-reveal="zoom">
									<ZoomImage src={shot.src} alt={shot.caption} />
									<span>{shot.caption}</span>
								</li>
							))}
						</ul>
					) : null}
				</>
			),
		});
	for (const chapter of project.chapters ?? [])
		parts.push({
			title: chapter.title,
			lead: chapter.lead,
			look: chapter.look,
			body: <ChapterBody chapter={chapter} />,
		});
	if (project.build.length)
		parts.push({
			title: '만든 방식',
			// 장 모양 조각의 기본 꼴(두 칸 글 묶음, 그림·데모가 있으면 넓게)을 그대로 빌린다
			body: <ChapterPoints chapter={{ title: '만든 방식', points: project.build }} />,
		});
	if (project.timeline?.length)
		parts.push({
			title: '진행 과정',
			body: (
				<ol className="ct-timeline">
					{project.timeline.map((step, i) => (
						<li key={`${step.date}-${step.label}`} data-reveal="left" style={cssVars({ d: i % 4 })}>
							<time>{step.date}</time>
							<span>{step.label}</span>
						</li>
					))}
				</ol>
			),
		});
	if (project.usage?.length)
		parts.push({ title: '쓰는 법', body: <ChapterPoints chapter={{ title: '쓰는 법', points: project.usage }} /> });
	if (project.contributions.length || project.role)
		parts.push({
			title: '맡은 일',
			lead: project.role,
			body: (
				<>
					<ol className="ct-roles">
						{project.contributions.map((item, i) => (
							<li key={item} data-reveal="left" style={cssVars({ d: i % 4 })}>
								{item}
							</li>
						))}
					</ol>
					{project.credits?.length ? (
						<ul className="ct-credits" aria-label="빌려 쓴 것">
							{project.credits.map((credit) => (
								<li key={`${credit.role}-${credit.name}`} data-reveal="">
									<span>{credit.role}</span>
									<strong>
										{credit.href ? (
											<a href={credit.href} target="_blank" rel="noopener noreferrer">
												{credit.name}
											</a>
										) : (
											credit.name
										)}
									</strong>
									<em>
										{credit.by}
										{credit.note && ` · ${credit.note}`}
									</em>
								</li>
							))}
						</ul>
					) : null}
				</>
			),
		});
	if (project.specs.length)
		parts.push({
			title: '기술 사양',
			body: (
				<dl className="ct-specs">
					{project.specs.map((spec, i) => (
						<div key={spec.label} data-reveal="" style={cssVars({ d: i % 3 })}>
							<dt>{spec.label}</dt>
							<dd>{spec.value}</dd>
						</div>
					))}
				</dl>
			),
		});
	return parts;
};

const CreativePage: React.FC<{ project: Project }> = ({ project }) => {
	const root = useReveal<HTMLDivElement>();
	const main = useRef<HTMLDivElement>(null);
	const seat = useRef<HTMLDivElement>(null);
	const parts = partsOf(project);
	// -1은 장에 들어가기 전, parts.length는 맺음말
	const [current, setCurrent] = useState(-1);
	// 몽이는 HYEONIVERSE의 것 (그 사이트의 그림을 쓴다)
	const mascot = project.id === 'hyeoniverse';

	// 스크롤하는 칸 가운데 띠를 지나는 장이 지금 읽는 장 (차례 표시와 몽이의 표정)
	useEffect(() => {
		const body = main.current;
		if (!body || typeof IntersectionObserver === 'undefined') return;
		const nodes = [...body.querySelectorAll<HTMLElement>('.ct-chapter, .ct-end')];
		const seen = new Set<number>();
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					const at = nodes.indexOf(entry.target as HTMLElement);
					if (entry.isIntersecting) seen.add(at);
					else seen.delete(at);
				}
				setCurrent(seen.size ? Math.max(...seen) : -1);
			},
			{ root: scrollParent(body), rootMargin: '-45% 0px -45% 0px' }
		);
		nodes.forEach((node) => observer.observe(node));
		return () => observer.disconnect();
	}, [parts.length]);

	const go = (index: number) => {
		const node = main.current?.querySelectorAll<HTMLElement>('.ct-chapter')[index];
		node?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};

	return (
		<div className="ct" ref={root} data-reading={current >= 0 || undefined}>
			{mascot && <Mascot page={root} body={main} seat={seat} chapter={current} total={parts.length} />}

			{/* 첫 화면: 화면을 꽉 채운 이름(그라데이션)과 한 줄 소개(테두리 글자), 작은 설명과 링크, 아래에 스크롤 표시 */}
			<header className="ct-hero" aria-label="첫머리">
				<p className="ct-hero-kicker">
					<span>{project.context}</span>
					{project.period && <span>{project.period}</span>}
				</p>
				{/* 제목(h1)은 다른 모양처럼 tagline. 이름은 그 위에 거대한 글자로 */}
				<p className="ct-hero-name">
					<span className="ct-grad">{project.name}</span>
				</p>
				<h1 className="ct-hero-tagline">{project.tagline}</h1>
				<div className="ct-hero-row">
					<div>
						<p className="ct-hero-desc">{project.description}</p>
						<Links project={project} className="ct-links" />
					</div>
					{/* 몽이가 서는 자리 (몽이는 위 층에 떠서 이 자리에 맞춰 선다) */}
					<div className="ct-hero-seat" ref={seat} data-mascot={mascot || undefined} />
				</div>
				<p className="ct-scroll" aria-hidden="true">
					<i />
					<span>스크롤</span>
				</p>
			</header>

			{/* 차례: 넓은 창에서는 왼쪽에 붙어 따라오고, 좁은 창에서는 위에 붙은 가로 띠 */}
			<nav className="ct-toc" aria-label="차례">
				<ol>
					{parts.map((part, i) => (
						<li key={part.title} data-current={i === current || undefined}>
							<button type="button" onClick={() => go(i)} aria-current={i === current ? 'true' : undefined}>
								<span className="ct-toc-no">{number(i)}</span>
								<span className="ct-toc-title">{part.title}</span>
							</button>
						</li>
					))}
				</ol>
			</nav>

			<div className="ct-body" ref={main}>
				{(project.image || project.facts.length > 0) && (
					<section className="ct-glance" aria-label="한눈에 보기">
						{project.image && (
							<figure className="ct-shot" data-reveal="zoom">
								<img src={project.image} alt={`${project.name} 화면`} />
							</figure>
						)}
						{project.facts.length > 0 && <Facts project={project} className="ct-facts" />}
					</section>
				)}

				{parts.map((part, i) => (
					<Section key={part.title} index={i} title={part.title} lead={part.lead} look={part.look}>
						{part.body}
					</Section>
				))}

				<footer className="ct-end" aria-label="맺음말" data-reveal="">
					<p className="ct-end-big">
						<span className="ct-grad">고맙습니다</span>
					</p>
					<p className="ct-end-line">{project.tagline}</p>
					<Links project={project} className="ct-links" />
				</footer>
			</div>
		</div>
	);
};

export default CreativePage;
