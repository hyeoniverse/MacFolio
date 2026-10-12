// deck: 발표 슬라이드(키노트 덱). 페이지가 발표 자료다 — 16:9 슬라이드 한 장이 창 가운데에 창 크기에 맞춰 축소되어 놓이고,
// 위 진행 막대와 'n / N', 좌우 화살표와 ←→ 키, 아래 점으로 넘긴다. Esc는 슬라이드 소터(모든 장의 썸네일 격자).
// 표지 → 숫자 → 주요 기능(항목마다 한 장) → 장마다 제목 장 + 내용 장 → 만든 방식 → 진행 과정 → 맡은 일 → 기술 사양 → 고맙습니다.
// 긴 내용은 그 장 안에서 스크롤한다. 좁은 창에서는 슬라이드가 세로로 쌓인 목록으로 풀린다.
// 데모·장 모양 조각은 그대로 가져다 쓰고, HYEONIVERSE에서는 몽이가 발표자처럼 표지에 서 있다가 데모 곁으로 간다
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cssVars } from '@/shared/lib/cssVars';
import { PROFILE, type Project, type ProjectChapter, type ProjectPoint } from '@/shared/profile';
import { Links, Region } from '@/apps/safari/project/parts';
import { prefersReducedMotion, useReveal } from '@/apps/safari/project/reveal';
import { scrollParent } from '@/apps/safari/project/scroll';
import { Bars, Compare, FeatureMedia, ScrollFrames, ZoomImage } from '@/apps/safari/project/CreativeParts';
import { ChapterFacts, ChapterPoints, Shots } from '@/apps/safari/project/CreativeChapters';
import { Demo } from '@/apps/safari/project/creative/Demo';
import { Themes } from '@/apps/safari/project/creative/Themes';
import { Mascot } from '@/apps/safari/project/creative/Mascot';
import {
	DeviceFrame,
	GlowBackdrop,
	LogoStrip,
	MockScreen,
	StatBand,
	pickMockKind,
} from '@/apps/safari/project/landing';
import '@/apps/safari/project/DeckPage.css';

/** 슬라이드 원본 크기 (여기 맞춰 그리고, 창에 맞게 축소한다) */
const SLIDE_W = 1280;
const SLIDE_H = 720;
/** 슬라이드 좌우 여백과, 위아래 조작부(진행 막대·점)에 비워 둘 높이 */
const PAD_X = 56;
const CHROME_Y = 96;
/** 이보다 좁으면(모바일) 슬라이드를 세로로 쌓는다. 기본 Safari 창(약 630px)은 덱으로 */
const STACK_BELOW = 600;
/** 부분(표지, 기능, 장…)마다 돌아가며 쓰는 강조 색상(hue) */
const HUES = [222, 268, 318, 12, 38, 160, 190, 96, 280, 340];

type Kind =
	| 'cover'
	| 'facts'
	| 'feature'
	| 'gallery'
	| 'chapter'
	| 'content'
	| 'figure'
	| 'build'
	| 'usage'
	| 'timeline'
	| 'roles'
	| 'structure'
	| 'specs'
	| 'end';

interface Slide {
	key: string;
	kind: Kind;
	/** 소터·점·노트에 보이는 제목 */
	title: string;
	/** 보조 기술이 읽는 구역 이름 (없으면 제목) */
	region?: string;
	hue: number;
	/** 들어오는 모양: 밀기(push) 또는 확대(zoom) */
	fx: 'push' | 'zoom';
	/** 발표자 노트 (문단마다) */
	notes: string[];
	body: React.ReactNode;
}

const two = (n: number) => String(n).padStart(2, '0');

/** 표지: 이름을 거대한 그라데이션 글자로, 한 줄 소개, 발표자(사이트 주인), 링크. 오른쪽에 대표 화면이 마우스를 따라 기운다 */
const Cover: React.FC<{ project: Project; seat: React.RefObject<HTMLDivElement | null>; mascot: boolean }> = ({
	project,
	seat,
	mascot,
}) => {
	const tilt = (event: React.PointerEvent<HTMLDivElement>) => {
		if (prefersReducedMotion()) return;
		const box = event.currentTarget.getBoundingClientRect();
		event.currentTarget.style.setProperty('--mx', (((event.clientX - box.left) / box.width) * 2 - 1).toFixed(3));
		event.currentTarget.style.setProperty('--my', (((event.clientY - box.top) / box.height) * 2 - 1).toFixed(3));
	};
	// 이름은 슬라이드 폭(1136px) 한 줄에 들어가게 글자를 줄인다 (한글·한자는 1em, 로마자는 약 0.7em으로 잰다)
	const width = [...project.name].reduce(
		(sum, ch) => sum + (/[\u1100-\u11ff\u3000-\u9fff\uac00-\ud7af]/.test(ch) ? 1 : 0.7),
		0
	);
	const size = Math.min(150, Math.floor(1136 / Math.max(4, width)));
	return (
		<div className="dk-cover" onPointerMove={tilt} data-shot="">
			<GlowBackdrop tone="dark" pattern="grid" focus="side" />
			<p className="dk-kicker">
				{project.icon && <img src={project.icon} alt="" className="dk-cover-icon" />}
				<span>{project.context}</span>
				{project.period && <span>{project.period}</span>}
			</p>
			<p className="dk-cover-name" style={cssVars({ size: `${size}px` })}>
				<span className="dk-grad">{project.name}</span>
			</p>
			<div className="dk-cover-text">
				<h1 className="dk-cover-tagline">{project.tagline}</h1>
				{project.description && <p className="dk-cover-lead">{project.description}</p>}
				<p className="dk-presenter">
					<span>발표</span>
					<strong>{PROFILE.name}</strong>
					<em>{PROFILE.role}</em>
				</p>
				<Links project={project} className="dk-links" />
			</div>
			<div className="dk-cover-side">
				{/* 신제품 발표처럼: 노트북 화면에 대표 화면(없으면 데이터로 그린 화면), 바닥에 비친다 */}
				<div className="dk-cover-device" aria-hidden="true">
					<DeviceFrame kind="laptop" src={project.image} glow reflection>
						<MockScreen project={project} kind={pickMockKind(project)} tone="dark" tint={false} decorative />
					</DeviceFrame>
				</div>
				{/* 몽이가 서는 자리 (몽이는 위 층에 떠서 이 자리에 맞춰 선다). 표지가 아닐 때는 자리를 감춰 몽이가 다른 데로 가게 */}
				<div className="dk-seat" ref={seat} data-mascot={mascot || undefined} />
			</div>
		</div>
	);
};

/** 주요 기능 한 장: 왼쪽 제목·글, 오른쪽에 스크롤 장면·화면·데모·실제 화면 (오른쪽은 장 안에서 스크롤) */
const Feature: React.FC<{ project: Project; point: ProjectPoint; index: number }> = ({ project, point, index }) => {
	const media = point.scrollFrames || point.image || point.video || point.variants || point.demo || point.shots;
	return (
		<div className="dk-feature" data-media={media ? '' : undefined}>
			<div className="dk-feature-text">
				<p className="dk-eyebrow">
					{point.icon && <i className={`dk-eyebrow-icon fa-solid ${point.icon}`} aria-hidden="true" />}
					주요 기능 {two(index + 1)}
				</p>
				<h2 data-reveal="left">{point.title}</h2>
				<p className="dk-feature-body" data-reveal="left" style={cssVars({ d: 1 })}>
					{point.body}
				</p>
				{point.detail && (
					<p className="dk-feature-more" data-reveal="left" style={cssVars({ d: 2 })}>
						{point.detail}
					</p>
				)}
			</div>
			{/* 화면이 없는 기능: 그 기능을 고른 제품 화면을 기울어진 브라우저 창에 (발표의 기능 소개 장처럼) */}
			{!media && (
				<div className="dk-feature-aside" data-reveal="zoom" aria-hidden="true">
					<DeviceFrame kind="browser" url={project.demo ?? project.url} tilt="right" glow>
						<MockScreen
							project={project}
							kind={pickMockKind(project)}
							focus={index}
							tone="dark"
							tint={false}
							decorative
						/>
					</DeviceFrame>
				</div>
			)}
			{media && (
				<div className="dk-scroll dk-feature-media" data-reveal="zoom">
					{point.scrollFrames && <ScrollFrames frames={point.scrollFrames} title={point.title} />}
					{(point.image || point.video || point.variants) && (
						<figure className="cr-feature-media dk-media">
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
				</div>
			)}
		</div>
	);
};

/** 장 제목 장: 큰 번호, 제목, 첫머리 글, 그 장의 숫자 */
const ChapterTitle: React.FC<{ chapter: ProjectChapter; index: number }> = ({ chapter, index }) => (
	<div className="dk-chapter">
		<p className="dk-chapter-no">
			<span className="dk-grad">{two(index + 1)}</span>
		</p>
		<div>
			<h2 data-reveal="left">{chapter.title}</h2>
			{chapter.lead && (
				<p className="dk-lead" data-reveal="left" style={cssVars({ d: 1 })}>
					{chapter.lead}
				</p>
			)}
			{chapter.facts?.length ? <ChapterFacts facts={chapter.facts} look={chapter.look} /> : null}
		</div>
	</div>
);

/** 그림·데모 없이 글만 있는 기본 모양의 항목들인지 (그러면 슬라이드용 번호 카드로 그린다) */
const plainPoints = (points: ProjectPoint[], chapter?: ProjectChapter) =>
	points.length > 0 &&
	!chapter?.look &&
	!chapter?.palette &&
	!chapter?.compare &&
	points.every(
		(point) => !point.image && !point.video && !point.demo && !point.shots && !point.variants && !point.scrollFrames
	);

/** 글만 있는 항목: 번호(또는 아이콘) 카드 격자. 항목 수에 맞춰 열을 정하고 자세히까지 슬라이드에 보인다 */
const DeckPoints: React.FC<{ points: ProjectPoint[] }> = ({ points }) => (
	<ol className="dk-points" data-count={Math.min(points.length, 7)}>
		{points.map((point, i) => (
			<li key={point.title} data-reveal="" style={cssVars({ d: i })}>
				<span className="dk-points-no" aria-hidden="true">
					{point.icon ? <i className={`fa-solid ${point.icon}`} /> : two(i + 1)}
				</span>
				<h3>{point.title}</h3>
				<p>{point.body}</p>
				{point.detail && <p className="dk-points-more">{point.detail}</p>}
			</li>
		))}
	</ol>
);

/**
 * 글 묶음 장(만든 방식·쓰는 법·장 내용): 글만 있으면 번호 카드, 아니면 장 모양 조각.
 * 머리 글(eyebrow)은 번호 카드에는 늘, 장 모양 조각에는 always일 때만 (장 내용은 앞 장이 제목 장이다)
 */
const PointsBody: React.FC<{ eyebrow: string; chapter: ProjectChapter; always?: boolean }> = ({
	eyebrow,
	chapter,
	always,
}) =>
	plainPoints(chapter.points, chapter) ? (
		<div className="dk-scroll dk-content dk-plain">
			<p className="dk-eyebrow">{eyebrow}</p>
			<DeckPoints points={chapter.points} />
		</div>
	) : (
		<div className="dk-scroll dk-content cr-chapter" data-look={chapter.look}>
			{always && <p className="dk-eyebrow">{eyebrow}</p>}
			{chapter.palette && <Themes palette={chapter.palette} />}
			{chapter.compare && <Bars rows={chapter.compare} />}
			<ChapterPoints chapter={chapter} />
		</div>
	);

/** 장 내용 장: 테마 미리보기, 전후 막대, 장 모양마다 다른 글 묶음. 길면 장 안에서 스크롤 */
const ChapterBody: React.FC<{ chapter: ProjectChapter }> = ({ chapter }) => (
	<PointsBody eyebrow={chapter.title} chapter={chapter} />
);

/** 진행 과정: 여섯 단계를 넘으면 두 줄로 나눠 날짜가 붙지 않게 한다 */
const Timeline: React.FC<{ steps: NonNullable<Project['timeline']> }> = ({ steps }) => (
	<ol
		className="dk-timeline"
		data-rows={steps.length > 6 ? 2 : undefined}
		style={cssVars({ n: steps.length > 6 ? Math.ceil(steps.length / 2) : steps.length })}
	>
		{steps.map((step, i) => (
			<li key={`${step.date}-${step.label}`} data-reveal="" style={cssVars({ d: i })}>
				<time>{step.date}</time>
				<i aria-hidden="true" />
				<span>{step.label}</span>
			</li>
		))}
	</ol>
);

/** 발표 순서를 슬라이드로 푼다 (없는 것은 뺀다) */
/** 표지 몸(Cover)은 몽이 자리 ref가 필요해 그릴 때 끼운다 (body는 비워 둔다) */
function slidesOf(project: Project): Slide[] {
	const slides: Slide[] = [];
	let part = 0;
	const hue = () => HUES[part % HUES.length];
	const next = () => (part += 1);

	slides.push({
		key: 'cover',
		kind: 'cover',
		title: project.name,
		region: '표지',
		hue: hue(),
		fx: 'zoom',
		notes: [project.description, [project.context, project.role, project.period].filter(Boolean).join(' · ')],
		body: null,
	});
	if (project.facts.length) {
		slides.push({
			key: 'facts',
			kind: 'facts',
			title: '숫자로 보기',
			hue: hue(),
			fx: 'push',
			notes: project.facts.map((fact) => `${fact.value} — ${fact.label}`),
			body: (
				<div className="dk-facts-wrap">
					<GlowBackdrop tone="dark" pattern="dots" focus="center" />
					<p className="dk-eyebrow">한눈에</p>
					<h2 className="dk-facts-title">{project.tagline}</h2>
					<StatBand facts={project.facts} tone="dark" label="숫자" className="dk-stats" />
				</div>
			),
		});
	}
	next();
	project.highlights.forEach((point, i) => {
		slides.push({
			key: `feature-${i}`,
			kind: 'feature',
			title: point.title,
			region: `주요 기능 · ${point.title}`,
			hue: hue(),
			fx: 'push',
			notes: [point.detail ?? point.body],
			body: <Feature project={project} point={point} index={i} />,
		});
	});
	if (project.gallery?.length) {
		slides.push({
			key: 'gallery',
			kind: 'gallery',
			title: '화면 모음',
			hue: hue(),
			fx: 'push',
			notes: project.gallery.map((shot) => shot.caption),
			body: (
				<ul className="dk-scroll dk-gallery">
					{project.gallery.map((shot, i) => (
						<li key={shot.src} data-reveal="zoom" style={cssVars({ d: i % 3 })}>
							<ZoomImage src={shot.src} alt={shot.caption} />
							<span>{shot.caption}</span>
						</li>
					))}
				</ul>
			),
		});
	}
	(project.chapters ?? []).forEach((chapter, i) => {
		next();
		const details = chapter.points.map((point) => point.detail).filter((text): text is string => Boolean(text));
		slides.push({
			key: `chapter-${i}`,
			kind: 'chapter',
			title: chapter.title,
			region: `${two(i + 1)} ${chapter.title}`,
			hue: hue(),
			fx: 'zoom',
			notes: [chapter.lead ?? chapter.title],
			body: <ChapterTitle chapter={chapter} index={i} />,
		});
		if (chapter.points.length || chapter.palette || chapter.compare || chapter.look === 'architecture')
			slides.push({
				key: `content-${i}`,
				kind: 'content',
				title: chapter.title,
				hue: hue(),
				fx: 'push',
				notes: details.length ? details : chapter.points.map((point) => `${point.title}: ${point.body}`),
				body: <ChapterBody chapter={chapter} />,
			});
		// 테마 장은 장 그림을 항목 화면으로 쓰므로 따로 두지 않는다
		if (chapter.image && chapter.look !== 'palette')
			slides.push({
				key: `figure-${i}`,
				kind: 'figure',
				title: `${chapter.title} 화면`,
				hue: hue(),
				fx: 'push',
				notes: [chapter.image.alt],
				body: (
					<figure className="dk-figure" data-reveal="zoom">
						{chapter.image.dark ? (
							<Compare light={chapter.image.src} dark={chapter.image.dark} alt={chapter.image.alt} />
						) : (
							<img src={chapter.image.src} alt={chapter.image.alt} loading="lazy" />
						)}
						<figcaption>{chapter.image.alt}</figcaption>
					</figure>
				),
			});
	});
	if (project.build.length) {
		next();
		slides.push({
			key: 'build',
			kind: 'build',
			title: '만든 방식',
			hue: hue(),
			fx: 'push',
			notes: project.build.map((point) => point.detail ?? `${point.title}: ${point.body}`),
			body: <PointsBody eyebrow="만든 방식" chapter={{ title: '만든 방식', points: project.build }} always />,
		});
	}
	if (project.usage?.length) {
		next();
		slides.push({
			key: 'usage',
			kind: 'usage',
			title: '쓰는 법',
			hue: hue(),
			fx: 'push',
			notes: project.usage.map((point) => `${point.title}: ${point.body}`),
			body: <PointsBody eyebrow="쓰는 법" chapter={{ title: '쓰는 법', points: project.usage }} always />,
		});
	}
	if (project.timeline?.length) {
		next();
		slides.push({
			key: 'timeline',
			kind: 'timeline',
			title: '진행 과정',
			hue: hue(),
			fx: 'push',
			notes: project.timeline.map((step) => `${step.date} ${step.label}`),
			body: (
				<div className="dk-timeline-wrap">
					<p className="dk-eyebrow">진행 과정</p>
					<h2>{project.period ?? '시간순으로'}</h2>
					<Timeline steps={project.timeline} />
				</div>
			),
		});
	}
	if (project.contributions.length || project.role) {
		next();
		slides.push({
			key: 'roles',
			kind: 'roles',
			title: '맡은 일',
			hue: hue(),
			fx: 'push',
			notes: [project.role ?? '', ...project.contributions].filter(Boolean),
			body: (
				<div className="dk-roles">
					<div>
						<p className="dk-eyebrow">맡은 일</p>
						<h2 data-reveal="left">{project.role ?? project.context}</h2>
					</div>
					<div className="dk-scroll">
						<ol className="dk-checks">
							{project.contributions.map((item, i) => (
								<li key={item} data-reveal="left" style={cssVars({ d: i })}>
									<i className="fa-solid fa-check" aria-hidden="true" />
									{item}
								</li>
							))}
						</ol>
						{project.credits?.length ? (
							<ul className="dk-credits" aria-label="빌려 쓴 것">
								{project.credits.map((credit) => (
									<li key={`${credit.role}-${credit.name}`}>
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
					</div>
				</div>
			),
		});
	}
	if (project.structure) {
		next();
		slides.push({
			key: 'structure',
			kind: 'structure',
			title: '폴더 구조',
			hue: hue(),
			fx: 'push',
			notes: ['저장소의 폴더 구조'],
			body: (
				<div className="dk-structure">
					<p className="dk-eyebrow">폴더 구조</p>
					<pre className="dk-scroll">{project.structure}</pre>
				</div>
			),
		});
	}
	if (project.specs.length) {
		next();
		slides.push({
			key: 'specs',
			kind: 'specs',
			title: '기술 사양',
			hue: hue(),
			fx: 'push',
			notes: project.specs.map((spec) => `${spec.label}: ${spec.value}`),
			body: (
				<div className="dk-specs-wrap">
					<p className="dk-eyebrow">기술 사양</p>
					<dl className="dk-specs dk-scroll">
						{project.specs.map((spec, i) => (
							<div key={spec.label} data-reveal="" style={cssVars({ d: i })}>
								<dt>{spec.label}</dt>
								<dd>{spec.value}</dd>
							</div>
						))}
					</dl>
					<LogoStrip
						items={[project.language, ...project.stack].filter(Boolean)}
						caption="만든 기술"
						className="dk-logos"
					/>
				</div>
			),
		});
	}
	next();
	slides.push({
		key: 'end',
		kind: 'end',
		title: '고맙습니다',
		region: '맺음말',
		hue: hue(),
		fx: 'zoom',
		notes: ['질문을 받습니다', project.url],
		body: (
			<div className="dk-end">
				<GlowBackdrop tone="dark" pattern="dots" focus="center" />
				{project.icon && <img className="dk-end-icon" src={project.icon} alt="" />}
				<p className="dk-end-big">
					<span className="dk-grad">고맙습니다</span>
				</p>
				<p className="dk-end-line">{project.tagline}</p>
				<Links project={project} className="dk-links" />
			</div>
		),
	});
	return slides;
}

/** 입력칸이나 데모 안에 포커스가 있으면 화살표 키를 가로채지 않는다 (데모가 제 키를 쓴다) */
const EDITING =
	'input, textarea, select, [contenteditable=""], [contenteditable="true"], [data-demo], .cd-wave, dialog[open]';

const DeckPage: React.FC<{ project: Project }> = ({ project }) => {
	const root = useReveal<HTMLDivElement>();
	const deck = useRef<HTMLDivElement>(null);
	const seat = useRef<HTMLDivElement>(null);
	// 몽이는 HYEONIVERSE의 것 (그 사이트의 그림을 쓴다)
	const mascot = project.id === 'hyeoniverse';
	const slides = useMemo(() => slidesOf(project), [project]);
	const total = slides.length;
	const [at, setAt] = useState(0);
	const [dir, setDir] = useState<'next' | 'back'>('next');
	const [sorter, setSorter] = useState(false);
	const [notes, setNotes] = useState(false);
	const [mode, setMode] = useState<'deck' | 'stack'>('deck');

	const go = useCallback(
		(index: number) => {
			const target = Math.max(0, Math.min(total - 1, index));
			setDir(target >= at ? 'next' : 'back');
			setAt(target);
			setSorter(false);
		},
		[total, at]
	);

	// 창(스크롤 상자) 크기에 맞춰 슬라이드 축척(--s)과 높이(--vh)를 정하고, 좁으면 세로 쌓기로
	useEffect(() => {
		const node = root.current;
		if (!node) return;
		const scroller = scrollParent(node);
		const measure = () => {
			const width = scroller?.clientWidth ?? window.innerWidth;
			const height = scroller?.clientHeight ?? window.innerHeight;
			setMode(width < STACK_BELOW ? 'stack' : 'deck');
			node.style.setProperty('--vh', `${height}px`);
			node.style.setProperty(
				'--s',
				Math.max(0.2, Math.min(1.2, (width - PAD_X * 2) / SLIDE_W, (height - CHROME_Y) / SLIDE_H)).toFixed(4)
			);
		};
		measure();
		const resized = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
		if (scroller) resized?.observe(scroller);
		window.addEventListener('resize', measure);
		return () => {
			resized?.disconnect();
			window.removeEventListener('resize', measure);
		};
	}, [root]);

	// 장을 바꾸면 몽이가 자리를 다시 잰다 (몽이는 스크롤 상자의 scroll을 듣는다). 장 안을 스크롤할 때도 같이 알린다
	useEffect(() => {
		const node = root.current;
		if (!node) return;
		const scroller = scrollParent(node);
		const nudge = () => scroller?.dispatchEvent(new Event('scroll'));
		nudge();
		node.addEventListener('scroll', nudge, true);
		return () => node.removeEventListener('scroll', nudge, true);
	}, [root, at, mode]);

	// ←→ 넘기기, Home·End, Esc 소터. 포커스가 이 페이지 밖(다른 창)이나 입력칸·데모 안에 있으면 건드리지 않는다
	useEffect(() => {
		const node = root.current;
		if (!node) return;
		const onKey = (event: KeyboardEvent) => {
			if (mode === 'stack' || event.metaKey || event.ctrlKey || event.altKey) return;
			const target = event.target as HTMLElement | null;
			const inside = target && node.contains(target);
			if (!inside && target !== document.body) return;
			if (!node.getClientRects().length) return;
			if (inside && target.closest(EDITING)) return;
			if (event.key === 'ArrowRight' || event.key === 'PageDown') go(at + 1);
			else if (event.key === 'ArrowLeft' || event.key === 'PageUp') go(at - 1);
			else if (event.key === 'Home') go(0);
			else if (event.key === 'End') go(total - 1);
			else if (event.key === 'Escape') setSorter((open) => !open);
			else return;
			event.preventDefault();
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [root, at, total, go, mode]);

	const current = slides[at];
	return (
		<div
			className="dk"
			ref={root}
			data-mode={mode}
			data-sorter={sorter || undefined}
			data-notes={notes || undefined}
			style={cssVars({ 'dk-hue': current.hue })}
		>
			{mascot && <Mascot page={root} body={deck} seat={seat} chapter={at > 0 ? at - 1 : -1} total={total - 2} />}

			{/* 위: 진행 막대, n / N, 노트·소터 단추 */}
			<div className="dk-top">
				<div
					className="dk-progress"
					role="progressbar"
					aria-label="진행"
					aria-valuemin={1}
					aria-valuemax={total}
					aria-valuenow={at + 1}
					style={cssVars({ p: (at + 1) / total })}
				>
					<i />
				</div>
				<div className="dk-top-row">
					<span className="dk-title">{current.title}</span>
					<span className="dk-count" aria-live="polite">
						{at + 1} / {total}
					</span>
					<div className="dk-tools">
						<button type="button" aria-pressed={notes} onClick={() => setNotes((open) => !open)}>
							<i className="fa-regular fa-note-sticky" aria-hidden="true" /> 노트
						</button>
						<button type="button" aria-pressed={sorter} onClick={() => setSorter((open) => !open)}>
							<i className="fa-solid fa-table-cells" aria-hidden="true" /> 소터 <kbd>Esc</kbd>
						</button>
					</div>
				</div>
			</div>

			<div className="dk-stage">
				<div className="dk-deck" ref={deck}>
					{slides.map((slide, i) => (
						<Region
							key={slide.key}
							label={slide.region ?? slide.title}
							className="dk-slide"
							data-lk-tone="dark"
							data-kind={slide.kind}
							data-fx={slide.fx}
							data-dir={dir}
							data-current={i === at || undefined}
							style={cssVars({ 'dk-hue': slide.hue })}
						>
							<span className="dk-no" aria-hidden="true">
								{two(i + 1)}
							</span>
							<div className="dk-slide-body">
								{slide.kind === 'cover' ? <Cover project={project} seat={seat} mascot={mascot} /> : slide.body}
							</div>
						</Region>
					))}
				</div>

				<button
					type="button"
					className="dk-arrow"
					data-side="prev"
					aria-label="이전"
					disabled={at === 0}
					onClick={() => go(at - 1)}
				>
					<i className="fa-solid fa-chevron-left" aria-hidden="true" />
				</button>
				<button
					type="button"
					className="dk-arrow"
					data-side="next"
					aria-label="다음"
					disabled={at === total - 1}
					onClick={() => go(at + 1)}
				>
					<i className="fa-solid fa-chevron-right" aria-hidden="true" />
				</button>

				{/* 발표자 노트: 옆 패널 */}
				<aside className="dk-notes" aria-label="발표자 노트" hidden={!notes}>
					<p className="dk-eyebrow">발표자 노트 · {at + 1}</p>
					<h3>{current.title}</h3>
					{current.notes.map((text, i) => (
						<p key={i}>{text}</p>
					))}
				</aside>
			</div>

			{/* 아래: 점 네비 */}
			<nav className="dk-dots" aria-label="슬라이드">
				{slides.map((slide, i) => (
					<button
						key={slide.key}
						type="button"
						aria-label={`${i + 1}. ${slide.title}`}
						aria-current={i === at ? 'true' : undefined}
						data-kind={slide.kind}
						style={cssVars({ 'dk-hue': slide.hue })}
						onClick={() => go(i)}
					/>
				))}
			</nav>

			{/* 소터: 모든 장의 썸네일 격자. 누르면 그 장으로 */}
			{sorter && (
				<div className="dk-sorter" role="dialog" aria-label="슬라이드 소터">
					<header>
						<h2>슬라이드 소터</h2>
						<button type="button" aria-label="소터 닫기" onClick={() => setSorter(false)}>
							<i className="fa-solid fa-xmark" aria-hidden="true" />
						</button>
					</header>
					<ol>
						{slides.map((slide, i) => (
							<li key={slide.key} style={cssVars({ 'dk-hue': slide.hue, d: i })}>
								<button
									type="button"
									aria-current={i === at ? 'true' : undefined}
									aria-label={`${i + 1}번 ${slide.title}`}
									data-slide-kind={slide.kind}
									data-slide-title={slide.title}
									onClick={() => go(i)}
								>
									<span className="dk-thumb" data-kind={slide.kind}>
										<b>{two(i + 1)}</b>
										<strong>{slide.title}</strong>
									</span>
									<span className="dk-thumb-kind">{KIND_LABEL[slide.kind]}</span>
								</button>
							</li>
						))}
					</ol>
				</div>
			)}
		</div>
	);
};

/** 소터 썸네일 아래 작은 꼬리표 */
const KIND_LABEL: Record<Kind, string> = {
	cover: '표지',
	facts: '숫자',
	feature: '주요 기능',
	gallery: '화면 모음',
	chapter: '장 제목',
	content: '장 내용',
	figure: '장 그림',
	build: '만든 방식',
	usage: '쓰는 법',
	timeline: '진행 과정',
	roles: '맡은 일',
	structure: '폴더 구조',
	specs: '기술 사양',
	end: '맺음말',
};

export default DeckPage;
