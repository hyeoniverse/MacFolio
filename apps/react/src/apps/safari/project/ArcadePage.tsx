// 아케이드 모양: 네온·CRT. 캐비닛 화면, HIGH SCORE 점수판, 캐릭터 선택 카드, 버튼 조작법, STAGE 목록, 어트랙트 모드 갤러리, 크레딧 롤
import React, { useEffect, useRef, useState } from 'react';
import type { Project, ProjectPoint } from '@/shared/profile';
import { Favicon, FactValue, Links, Region } from '@/apps/safari/project/parts';
import { prefersReducedMotion, useReveal } from '@/apps/safari/project/reveal';
import { onScrollFrame } from '@/apps/safari/project/scroll';
import { cssVars } from '@/shared/lib/cssVars';
import { FeatureVisual, LogoStrip, MockScreen } from '@/apps/safari/project/landing';
import '@/apps/safari/project/ArcadePage.css';

/** 글자 하나씩 불이 켜지는 네온 간판 (읽는 쪽에는 이름 전체를 준다). 낱말 단위로 묶어 낱말 중간에서 줄이 바뀌지 않게 */
const NeonSign: React.FC<{ text: string }> = ({ text }) => {
	let index = 0;
	return (
		<h1 className="ac-sign" aria-label={text}>
			{text.split(' ').map((word, w) => (
				<span key={w} className="ac-sign-word" aria-hidden="true">
					{Array.from(word).map((ch, c) => (
						<span key={c} style={{ '--i': index++ } as React.CSSProperties}>
							{ch}
						</span>
					))}
				</span>
			))}
		</h1>
	);
};

/** 캐릭터 선택 카드: 마우스 위치에 따라 3D로 기울고 네온 테두리가 흐른다 */
const CharCard: React.FC<{ project: Project; point: ProjectPoint; index: number }> = ({ project, point, index }) => {
	const { title, body, detail, image } = point;
	const ref = useRef<HTMLLIElement>(null);
	const tilt = (event: React.MouseEvent<HTMLLIElement>) => {
		const node = ref.current;
		if (!node || prefersReducedMotion()) return;
		const box = node.getBoundingClientRect();
		const x = (event.clientX - box.left) / box.width - 0.5;
		const y = (event.clientY - box.top) / box.height - 0.5;
		node.style.setProperty('--rx', `${(-y * 14).toFixed(2)}deg`);
		node.style.setProperty('--ry', `${(x * 14).toFixed(2)}deg`);
		node.style.setProperty('--mx', `${((x + 0.5) * 100).toFixed(1)}%`);
		node.style.setProperty('--my', `${((y + 0.5) * 100).toFixed(1)}%`);
	};
	const reset = () => {
		const node = ref.current;
		if (!node) return;
		node.style.removeProperty('--rx');
		node.style.removeProperty('--ry');
	};
	return (
		<li ref={ref} className="ac-char" onMouseMove={tilt} onMouseLeave={reset} data-reveal="up">
			<span className="ac-char-no">P{index + 1}</span>
			{image ? (
				<img src={image} alt="" className="ac-char-img" />
			) : (
				<span className="ac-char-glyph" aria-hidden="true">
					<FeatureVisual point={point} index={index} project={project} tone="dark" />
				</span>
			)}
			<h3>{title}</h3>
			<p>{body}</p>
			{detail && <p className="ac-char-detail">{detail}</p>}
		</li>
	);
};

/** 화면 모음: 어트랙트 모드로 저절로 넘어가고(움직임 줄이기에서는 멈춤), 단추로도 넘긴다 */
const Attract: React.FC<{ shots: { src: string; caption: string }[] }> = ({ shots }) => {
	const [index, setIndex] = useState(0);
	const [paused, setPaused] = useState(false);
	useEffect(() => {
		if (paused || shots.length < 2 || prefersReducedMotion()) return;
		const timer = setInterval(() => setIndex((i) => (i + 1) % shots.length), 3200);
		return () => clearInterval(timer);
	}, [paused, shots.length]);
	const go = (step: number) => setIndex((i) => (i + step + shots.length) % shots.length);
	return (
		<div className="ac-attract" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
			<div className="ac-attract-screen">
				{shots.map((shot, i) => (
					<img
						key={shot.src}
						src={shot.src}
						alt={shot.caption}
						className={i === index ? 'is-on' : undefined}
						aria-hidden={i !== index}
					/>
				))}
				<span className="ac-attract-tag" aria-hidden="true">
					DEMO PLAY
				</span>
			</div>
			<div className="ac-attract-bar">
				<button type="button" className="ac-btn ac-btn-small" onClick={() => go(-1)} aria-label="이전 화면">
					◀
				</button>
				<p className="ac-attract-caption" aria-live="polite">
					<span className="ac-attract-count">
						{index + 1}/{shots.length}
					</span>
					{shots[index].caption}
				</p>
				<button type="button" className="ac-btn ac-btn-small" onClick={() => go(1)} aria-label="다음 화면">
					▶
				</button>
			</div>
		</div>
	);
};

/** 새싹 농장에서만: 픽셀 스프라이트 장식 (스크롤에 따라 조금씩 다르게 움직인다) */
const Sprites: React.FC = () => (
	<div className="ac-sprites" aria-hidden="true">
		<i className="ac-sprite ac-sprite-tree" style={{ '--p': 0.08 } as React.CSSProperties} />
		<i className="ac-sprite ac-sprite-tree ac-sprite-tree2" style={{ '--p': 0.14 } as React.CSSProperties} />
		<i className="ac-sprite ac-sprite-sunflower" style={{ '--p': 0.05 } as React.CSSProperties} />
		<i className="ac-sprite ac-sprite-mushroom" style={{ '--p': 0.04 } as React.CSSProperties} />
		<i className="ac-sprite ac-sprite-star ac-sprite-star1" />
		<i className="ac-sprite ac-sprite-star ac-sprite-star2" />
		<i className="ac-sprite ac-sprite-star ac-sprite-star3" />
		<i className="ac-sprite ac-sprite-chick" />
		<i className="ac-sprite ac-sprite-char" />
	</div>
);

/** 6칸 격자에서 항목마다 차지할 칸: 한 줄에 셋씩 두고, 마지막 줄에 남는 칸은 남은 항목이 나눠 채운다 */
const fillSpans = (count: number) =>
	Array.from({ length: count }, (_, i) => {
		const left = count % 3;
		if (left === 0 || i < count - left) return 2;
		return 6 / left;
	});

/** 점수판 순위: 1ST, 2ND, 3RD, 4TH … (11·12·13은 TH) */
const rank = (n: number) => {
	const teen = n % 100 >= 11 && n % 100 <= 13;
	const suffix = teen ? 'TH' : (['TH', 'ST', 'ND', 'RD'][n % 10] ?? 'TH');
	return `${n}${suffix}`;
};

const ArcadePage: React.FC<{ project: Project }> = ({ project }) => {
	const root = useReveal<HTMLDivElement>();
	// 스크롤한 만큼을 --ac-scroll로 두어 바닥 격자와 스프라이트가 시차를 두고 움직인다
	useEffect(() => {
		const node = root.current;
		if (!node || prefersReducedMotion()) return;
		return onScrollFrame(node, (scroller) => {
			node.style.setProperty('--ac-scroll', String(scroller ? scroller.scrollTop : window.scrollY));
		});
	}, [root]);

	const screen = project.art ?? project.image;
	const screenAlt = project.art ? `${project.name} 장면` : `${project.name} 화면`;
	const sprout = project.id === 'sproutfarm';
	const credits = project.credits ?? [];
	const roll = project.contributions.length + credits.length > 0;
	const usage = project.usage ?? [];
	const timeline = project.timeline ?? [];
	// 진행 과정 지도는 한 줄에 여섯까지, 더 많으면 두 줄로 고르게
	const mapColumns = timeline.length <= 6 ? timeline.length : Math.ceil(timeline.length / 2);
	const specSpans = fillSpans(project.specs.length);

	return (
		<div ref={root} className={`ac${sprout ? ' ac-sprout' : ''}`} data-lk-tone="dark">
			<div className="ac-scanlines" aria-hidden="true" />
			<div className="ac-vignette" aria-hidden="true" />

			{/* ─── 타이틀 화면 ─── */}
			<header className="ac-title">
				<div className="ac-floor" aria-hidden="true" />
				{sprout && <Sprites />}
				<div className="ac-hero-copy">
					<p className="ac-coin">INSERT COIN</p>
					<Favicon project={project} className="ac-icon" />
					<NeonSign text={project.name} />
					<p className="ac-tagline">{project.tagline}</p>
					{project.description && <p className="ac-hero-desc">{project.description}</p>}
					<Links project={project} className="ac-links" />
					<ul className="ac-meta" aria-label="정보">
						{[project.context, project.period, project.language].filter(Boolean).map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				</div>

				<figure className="ac-cabinet">
					<div className="ac-cabinet-top" aria-hidden="true">
						<span />
						<span />
						<span />
					</div>
					<div className="ac-cabinet-screen">
						{screen ? (
							<img src={screen} alt={screenAlt} />
						) : (
							<div className="ac-cabinet-mock">
								<MockScreen project={project} kind="game" tone="dark" tint={false} decorative />
							</div>
						)}
					</div>
					<div className="ac-cabinet-panel" aria-hidden="true">
						<span className="ac-stick">
							<span className="ac-stick-ball" />
						</span>
						<span className="ac-pads">
							<span className="ac-pad ac-pad-a" />
							<span className="ac-pad ac-pad-b" />
							<span className="ac-pad ac-pad-c" />
						</span>
					</div>
					<figcaption className="visually-hidden">{project.description}</figcaption>
				</figure>
			</header>

			{/* ─── HIGH SCORE: 숫자가 세어 올라간다 ─── */}
			{project.facts.length > 0 && (
				<Region label="한눈에" className="ac-board" data-reveal="up">
					<h2 className="ac-h2 ac-h2-pink">HIGH SCORE</h2>
					<ol className="ac-scores">
						{project.facts.map((fact, i) => (
							<li key={fact.label}>
								<span className="ac-rank">{rank(i + 1)}</span>
								<FactValue text={fact.value} />
								<span className="ac-score-label">{fact.label}</span>
							</li>
						))}
					</ol>
					<p className="ac-desc">{project.description}</p>
				</Region>
			)}

			{/* ─── SELECT PLAYER: 주요 기능 ─── */}
			{project.highlights.length > 0 && (
				<Region label="주요 기능" className="ac-select">
					<h2 className="ac-h2 ac-h2-cyan" data-reveal="up">
						SELECT PLAYER
					</h2>
					<ul className="ac-chars">
						{project.highlights.map((point, i) => (
							<CharCard key={point.title} project={project} point={point} index={i} />
						))}
					</ul>
				</Region>
			)}

			{/* ─── 조작법: 아케이드 버튼 배치 ─── */}
			{project.controls && project.controls.length > 0 && (
				<Region label="조작법" className="ac-controls" data-reveal="up">
					<h2 className="ac-h2 ac-h2-yellow">HOW TO PLAY</h2>
					<ul className="ac-control-list">
						{project.controls.map((control) => (
							<li key={control.label}>
								<span className="ac-keys">
									{control.keys.map((key) => (
										<kbd key={key} className="ac-key">
											{key}
										</kbd>
									))}
								</span>
								<span className="ac-control-label">{control.label}</span>
							</li>
						))}
					</ul>
				</Region>
			)}

			{/* ─── PRESS START: 쓰는 법 ─── */}
			{usage.length > 0 && (
				<Region label="쓰는 법" className="ac-start" data-reveal="up">
					<h2 className="ac-h2 ac-h2-cyan">PRESS START</h2>
					<ol className="ac-start-list" style={cssVars({ n: Math.min(usage.length, 3) })}>
						{usage.map((point, i) => (
							<li key={point.title}>
								<span className="ac-start-no">STEP {i + 1}</span>
								<h3>{point.title}</h3>
								<p>{point.body}</p>
								{point.detail && <p className="ac-start-detail">{point.detail}</p>}
							</li>
						))}
					</ol>
				</Region>
			)}

			{/* ─── STAGE: 만든 방식 ─── */}
			{project.build.length > 0 && (
				<Region label="만든 방식" className="ac-stages">
					<h2 className="ac-h2 ac-h2-pink" data-reveal="up">
						STAGE SELECT
					</h2>
					<ol className="ac-stage-list">
						{project.build.map((point, i) => (
							<li key={point.title} className="ac-stage" data-reveal={i % 2 ? 'up' : 'left'}>
								<span className="ac-stage-no">STAGE 1-{i + 1}</span>
								<div className="ac-stage-text">
									<h3>{point.title}</h3>
									<p>{point.body}</p>
									{point.detail && <p className="ac-stage-detail">{point.detail}</p>}
								</div>
								<span className="ac-stage-visual" aria-hidden="true">
									{point.image ? (
										<img src={point.image} alt="" className="ac-stage-img" />
									) : (
										<FeatureVisual point={point} index={i + 1} project={project} tone="dark" />
									)}
								</span>
							</li>
						))}
					</ol>
				</Region>
			)}

			{/* ─── WORLD MAP: 진행 과정 (레벨 지도처럼 점과 길) ─── */}
			{timeline.length > 0 && (
				<Region label="진행 과정" className="ac-map" data-reveal="up">
					<h2 className="ac-h2 ac-h2-yellow">WORLD MAP</h2>
					<ol className="ac-map-list" style={cssVars({ n: mapColumns })}>
						{timeline.map((entry, i) => (
							<li
								key={`${entry.date}-${entry.label}`}
								className={
									i === timeline.length - 1 ? 'is-goal' : (i + 1) % mapColumns === 0 ? 'is-row-end' : undefined
								}
							>
								<span className="ac-map-dot" aria-hidden="true">
									{i === timeline.length - 1 ? '★' : i + 1}
								</span>
								<time className="ac-map-date">{entry.date}</time>
								<span className="ac-map-label">{entry.label}</span>
							</li>
						))}
					</ol>
				</Region>
			)}

			{/* ─── 어트랙트 모드: 화면 모음 ─── */}
			{project.gallery && project.gallery.length > 0 && (
				<Region label="화면 모음" className="ac-gallery" data-reveal="zoom">
					<h2 className="ac-h2 ac-h2-cyan">ATTRACT MODE</h2>
					<Attract shots={project.gallery} />
				</Region>
			)}

			{/* ─── 기술 사양 ─── */}
			{project.specs.length > 0 && (
				<Region label="기술 사양" className="ac-specs" data-reveal="up">
					<h2 className="ac-h2 ac-h2-yellow">SPECS</h2>
					<dl className="ac-spec-list">
						{project.specs.map((spec, i) => (
							<div key={spec.label} style={cssVars({ span: specSpans[i] })}>
								<dt>{spec.label}</dt>
								<dd>{spec.value}</dd>
							</div>
						))}
					</dl>
					<LogoStrip items={project.stack} caption="POWERED BY" marquee className="ac-logos" />
				</Region>
			)}

			{/* ─── 크레딧 롤: 맡은 일 + 빌려 쓴 것 (아래에서 위로 흐른다. 움직임 줄이기에서는 정적) ─── */}
			{roll && (
				<Region label="맡은 일" className="ac-credits">
					<h2 className="ac-h2 ac-h2-pink">CREDITS</h2>
					<div className="ac-roll-window">
						<div className="ac-roll">
							{project.role && <p className="ac-roll-role">{project.role}</p>}
							{project.contributions.length > 0 && (
								<>
									<p className="ac-roll-head">PLAYER 1</p>
									<ul className="ac-roll-list">
										{project.contributions.map((item) => (
											<li key={item}>{item}</li>
										))}
									</ul>
								</>
							)}
							{credits.length > 0 && (
								<>
									<p className="ac-roll-head">SPECIAL THANKS</p>
									<ul className="ac-roll-list ac-roll-credits">
										{credits.map((credit) => (
											<li key={credit.name}>
												<span className="ac-roll-tag">{credit.role}</span>
												<span className="ac-roll-name">
													{credit.href ? (
														<a href={credit.href} target="_blank" rel="noopener noreferrer">
															{credit.name}
														</a>
													) : (
														credit.name
													)}{' '}
													<small>by {credit.by}</small>
												</span>
												{credit.note && <span className="ac-roll-note">{credit.note}</span>}
											</li>
										))}
									</ul>
								</>
							)}
							<p className="ac-roll-end">THANK YOU FOR PLAYING</p>
						</div>
					</div>
				</Region>
			)}

			<footer className="ac-foot">
				<div className="ac-floor ac-floor-foot" aria-hidden="true" />
				<p className="ac-coin ac-coin-small">GAME OVER? — CONTINUE</p>
				<p className="ac-foot-title">{project.tagline || project.name}</p>
				<Links project={project} className="ac-links" />
			</footer>
		</div>
	);
};

export default ArcadePage;
