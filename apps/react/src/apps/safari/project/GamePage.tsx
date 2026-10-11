// 게임 모양: 픽셀 타이틀 화면 + 스테이지 셀렉트. PRESS START → HUD(한눈에 보기) → STAGE SELECT(주요 기능) → CONTROLS(조작법)
// → DEV LOG(만든 방식, 스크롤하면 주인공이 따라 내려간다) → GALLERY(화면 모음) → INVENTORY(기술 사양) → CREDITS(맡은 일) → THE END.
// 어떤 프로젝트든 고를 수 있다: 없는 필드는 그 구역을 빼고, 픽셀 스프라이트는 새싹 농장(sproutfarm)에만 있어 그때만 쓴다
import React, { useEffect, useRef, useState } from 'react';
import type { Project } from '@/shared/profile';
import { useProfile } from '@/shared/site/profileStore';
import { Favicon, FactValue, Links, Region } from '@/apps/safari/project/parts';
import { prefersReducedMotion, useReveal } from '@/apps/safari/project/reveal';
import { onScrollFrame, viewOf } from '@/apps/safari/project/scroll';
import { cssVars } from '@/shared/lib/cssVars';
import '@/apps/safari/project/GamePage.css';

const SPRITES = '/imgs/projects/sproutfarm/sprites';
const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** 인벤토리 칸의 아이템 그림 (새싹 농장의 기술 사양 분류 → Sprout Lands 아이템). 다른 분류는 돌아가며 쓴다 */
const ITEM_SPRITES: Record<string, string> = {
	엔진: 'pickaxe',
	렌더링: 'painting',
	맵: 'seeds',
	AI: 'egg',
	'입력 · UI': 'gamepad',
	배포: 'chest',
	서버: 'milk',
};
const ITEM_FALLBACKS = Object.values(ITEM_SPRITES);

/** 두 줄 머리글: 영어 픽셀 글씨와 한국어 이름 */
const Heading: React.FC<{ en: string; ko: string }> = ({ en, ko }) => (
	<h2 className="gm-heading" data-reveal="up">
		<span className="gm-heading-en">{en}</span>
		<span className="gm-heading-ko">{ko}</span>
	</h2>
);

/** 타이틀 화면과 크레딧 가장자리의 장식: 새싹 농장은 에셋 스프라이트, 아니면 CSS로만 그린 픽셀 별·풀 */
const Decor: React.FC<{ pixel: boolean; where: 'title' | 'end' }> = ({ pixel, where }) => (
	<div className={`gm-decor gm-decor-${where}`} aria-hidden="true">
		{pixel ? (
			<>
				<img className="gm-decor-a" src={`${SPRITES}/tree.png`} alt="" />
				<img className="gm-decor-b" src={`${SPRITES}/sunflower.png`} alt="" />
				<img className="gm-decor-c" src={`${SPRITES}/mushroom.png`} alt="" />
				<img className="gm-decor-d" src={`${SPRITES}/star.png`} alt="" />
			</>
		) : (
			<>
				<i className="gm-decor-a" />
				<i className="gm-decor-b" />
				<i className="gm-decor-c" />
				<i className="gm-decor-d" />
			</>
		)}
	</div>
);

/** 개발 일지 옆을 걸어 내려가는 주인공: 그 구역이 화면 가운데를 지난 만큼 아래로 */
function useWalker<T extends HTMLElement>() {
	const ref = useRef<T>(null);
	useEffect(() => {
		const node = ref.current;
		if (!node) return;
		return onScrollFrame(node, (scroller) => {
			const view = viewOf(scroller);
			const box = node.getBoundingClientRect();
			const center = view.top + view.height / 2;
			const walked = Math.min(1, Math.max(0, (center - box.top) / box.height));
			node.style.setProperty('--gm-walk', walked.toFixed(4));
		});
	}, []);
	return ref;
}

const GamePage: React.FC<{ project: Project }> = ({ project }) => {
	const owner = useProfile().name;
	const root = useReveal<HTMLDivElement>();
	const devlog = useWalker<HTMLDivElement>();
	// 스프라이트 그림은 새싹 농장 것이라 그 프로젝트에서만
	const pixel = project.id === 'sproutfarm';
	const [flash, setFlash] = useState(false);
	// 인벤토리: 누른 칸(picked)과 올려 둔 칸(peek). 올려 둔 칸이 있으면 그걸 먼저 보여 준다
	const [picked, setPicked] = useState(0);
	const [peek, setPeek] = useState<number | null>(null);
	const shown = project.specs[peek ?? picked] ?? project.specs[0];

	// PRESS START: 화면이 한 번 번쩍이고 HUD로 내려간다
	const start = () => {
		setFlash(true);
		window.setTimeout(() => setFlash(false), 420);
		root.current
			?.querySelector('[data-gm="hud"]')
			?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
	};

	const cover = project.art ?? project.image;
	const itemSprite = (label: string, i: number) =>
		`${SPRITES}/items/${ITEM_SPRITES[label] ?? ITEM_FALLBACKS[i % ITEM_FALLBACKS.length]}.png`;

	return (
		<div className={`gm${pixel ? ' gm-pixel' : ''}`} ref={root}>
			{/* ─── 타이틀 화면 ─── */}
			<header className="gm-title" data-flash={flash || undefined}>
				{cover && <img className="gm-title-art" src={cover} alt={`${project.name} 장면`} />}
				<Decor pixel={pixel} where="title" />
				<div className="gm-title-main">
					{project.logo ? (
						<img className="gm-logo" src={project.logo} alt={project.name} />
					) : (
						<h1 className="gm-name">{project.name}</h1>
					)}
					<p className="gm-tagline">{project.tagline}</p>
					<button type="button" className="gm-start" onClick={start} aria-label="시작: 한눈에 보기로 내려가기">
						▶ PRESS START
					</button>
					<p className="gm-copyright">
						<Favicon project={project} className="gm-favicon" />
						<span>
							© {owner} · {project.context}
						</span>
					</p>
				</div>
			</header>

			{/* ─── HUD: 한눈에 보기 ─── */}
			<Region label="한눈에 보기" className="gm-hud" data-gm="hud">
				<div className="gm-inner">
					<Heading en="STATUS" ko="한눈에 보기" />
					<p className="gm-desc" data-reveal="up">
						{project.description}
					</p>
					{project.facts.length > 0 && (
						<ul className="gm-stats">
							{project.facts.map((fact, i) => (
								<li key={fact.label} className="gm-panel" data-reveal="drop" style={cssVars({ d: i })}>
									<FactValue text={fact.value} />
									<span>{fact.label}</span>
								</li>
							))}
						</ul>
					)}
					<Links project={project} className="gm-links" />
				</div>
			</Region>

			{/* ─── STAGE SELECT: 주요 기능 ─── */}
			{project.highlights.length > 0 && (
				<Region label="주요 기능" className="gm-stages">
					<div className="gm-inner">
						<Heading en="STAGE SELECT" ko="주요 기능" />
						<ol className="gm-stage-grid">
							{project.highlights.map((point, i) => (
								<li key={point.title} className="gm-stage gm-panel" data-reveal="up" style={cssVars({ d: i % 4 })}>
									{point.image ? (
										<img className="gm-stage-thumb" src={point.image} alt="" />
									) : (
										<span className="gm-stage-thumb gm-stage-blank" aria-hidden="true" />
									)}
									<span className="gm-stage-no">STAGE {String(i + 1).padStart(2, '0')}</span>
									<h3>{point.title}</h3>
									<p>{point.body}</p>
								</li>
							))}
						</ol>
					</div>
				</Region>
			)}

			{/* ─── CONTROLS: 조작법 ─── */}
			{project.controls && project.controls.length > 0 && (
				<Region label="조작법" className="gm-controls">
					<div className="gm-inner">
						<Heading en="CONTROLS" ko="조작법" />
						<ul className="gm-keys gm-panel" data-reveal="up">
							{project.controls.map((control) => (
								<li key={control.label}>
									<span className="gm-keycaps">
										{control.keys.map((key) => (
											<kbd key={key}>{key}</kbd>
										))}
									</span>
									<span className="gm-key-label">{control.label}</span>
								</li>
							))}
						</ul>
					</div>
				</Region>
			)}

			{/* ─── DEV LOG: 만든 방식 ─── */}
			{project.build.length > 0 && (
				<Region label="만든 방식" className="gm-devlog">
					<div className="gm-inner">
						<Heading en="DEV LOG" ko="만든 방식" />
						<div className="gm-log-track" ref={devlog}>
							{/* 길: 스크롤한 만큼 주인공이 아래로 걸어 내려간다 */}
							<div className="gm-road" aria-hidden="true">
								<span className="gm-hero" />
							</div>
							<ol className="gm-log">
								{project.build.map((point, i) => (
									<li
										key={point.title}
										className="gm-log-entry gm-panel"
										data-reveal="left"
										style={cssVars({ d: i % 3 })}
									>
										<span className="gm-log-no">LOG {String(i + 1).padStart(2, '0')}</span>
										<h3>{point.title}</h3>
										<p>{point.body}</p>
										{point.image && <img className="gm-log-shot" src={point.image} alt={`${point.title} 화면`} />}
									</li>
								))}
							</ol>
						</div>
					</div>
				</Region>
			)}

			{/* ─── GALLERY: 화면 모음 ─── */}
			{project.gallery && project.gallery.length > 0 && (
				<Region label="화면 모음" className="gm-gallery">
					<div className="gm-inner">
						<Heading en="GALLERY" ko="화면 모음" />
					</div>
					<ul className="gm-reel" data-reveal="up">
						{project.gallery.map((shot) => (
							<li key={shot.src}>
								<figure className="gm-panel">
									<img src={shot.src} alt={shot.caption} loading="lazy" />
									<figcaption>{shot.caption}</figcaption>
								</figure>
							</li>
						))}
					</ul>
				</Region>
			)}

			{/* ─── INVENTORY: 기술 사양 ─── */}
			{project.specs.length > 0 && (
				<Region label="기술 사양" className="gm-inventory">
					<div className="gm-inner">
						<Heading en="INVENTORY" ko="기술 사양" />
						<div className="gm-bag gm-panel" data-reveal="up" onMouseLeave={() => setPeek(null)}>
							<div className="gm-slots">
								{project.specs.map((spec, i) => (
									<button
										key={spec.label}
										type="button"
										className="gm-slot"
										aria-label={spec.label}
										aria-pressed={picked === i}
										onClick={() => setPicked(i)}
										onMouseEnter={() => setPeek(i)}
										onFocus={() => setPeek(i)}
										onBlur={() => setPeek(null)}
									>
										{pixel ? (
											<img src={itemSprite(spec.label, i)} alt="" />
										) : (
											<span className="gm-slot-tile" aria-hidden="true">
												{spec.label.slice(0, 1)}
											</span>
										)}
									</button>
								))}
							</div>
							{shown && (
								<div className="gm-item" aria-live="polite">
									<strong>{shown.label}</strong>
									<p>{shown.value}</p>
								</div>
							)}
						</div>
						{/* 보조 기술에는 목록 전체를 */}
						<ul className="visually-hidden">
							{project.specs.map((spec) => (
								<li key={spec.label}>
									{spec.label}: {spec.value}
								</li>
							))}
						</ul>
						{project.stack.length > 0 && (
							<p className="gm-stack" data-reveal="up">
								{project.stack.map((tech) => (
									<span key={tech}>{tech}</span>
								))}
							</p>
						)}
					</div>
				</Region>
			)}

			{/* ─── CREDITS: 맡은 일 ─── */}
			<Region label="맡은 일" className="gm-credits">
				<Decor pixel={pixel} where="end" />
				<div className="gm-inner">
					<Heading en="CREDITS" ko="맡은 일" />
					<p className="gm-credit-meta" data-reveal="up">
						{project.context}
						{project.period && <span> · {project.period}</span>}
						{project.role && <span> · {project.role}</span>}
					</p>
					{project.contributions.length > 0 && (
						<ul className="gm-roll" data-reveal="up">
							{project.contributions.map((job) => (
								<li key={job}>
									<span className="gm-roll-role">{job}</span>
									<span className="gm-roll-dots" aria-hidden="true" />
									<span className="gm-roll-name">{owner}</span>
								</li>
							))}
						</ul>
					)}
					{project.credits && project.credits.length > 0 && (
						<>
							<h3 className="gm-thanks" data-reveal="up">
								SPECIAL THANKS
							</h3>
							<ul className="gm-roll gm-roll-thanks" data-reveal="up">
								{project.credits.map((credit) => (
									<li key={credit.name}>
										<span className="gm-roll-role">{credit.role}</span>
										<span className="gm-roll-dots" aria-hidden="true" />
										<span className="gm-roll-name">
											{credit.href ? (
												<a href={credit.href} {...external}>
													{credit.name}
												</a>
											) : (
												credit.name
											)}
											<small> by {credit.by}</small>
										</span>
										{credit.note && <p className="gm-roll-note">{credit.note}</p>}
									</li>
								))}
							</ul>
						</>
					)}
					<p className="gm-end" data-reveal="zoom">
						THE END
					</p>
					<Links project={project} className="gm-links gm-links-end" />
				</div>
			</Region>
		</div>
	);
};

export default GamePage;
