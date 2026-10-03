// SproutFarm (게임): 게임 화면 흐름. 타이틀 화면 → HUD(숫자) → 퀘스트(기능, 게임 대화창)와 조작법 → 하루(화면 모음)
// → 흙길을 따라가는 개발 일지 지도(만든 방식) → 인벤토리(기술 사양) → 크레딧(맡은 일).
// 그림은 게임에 쓴 Sprout Lands 에셋에서 필요한 조각만 잘라 쓴다 (public/imgs/projects/sproutfarm/sprites)
import React, { useRef, useState } from 'react';
import type { Project } from '@/shared/profile';
import { Favicon, Links } from '@/apps/safari/project/parts';
import '@/apps/safari/project/GamePage.css';

const SPRITES = '/imgs/projects/sproutfarm/sprites';

/** 장식 스프라이트 (글을 읽는 데는 필요 없다) */
const Sprite: React.FC<{ name: string; className: string }> = ({ name, className }) => (
	<img className={`gm-sprite ${className}`} src={`${SPRITES}/${name}.png`} alt="" aria-hidden="true" />
);

/** 개발 일지 지도의 흙길: 칸마다 왼쪽·오른쪽 표지판 옆을 지나 구불구불 내려간다 (칸 높이 100) */
function roadPath(count: number) {
	let d = 'M50 0';
	let y = 0;
	for (let i = 0; i < count; i++) {
		const x = i % 2 === 0 ? 64 : 36;
		const next = 100 * i + 50;
		d += ` C${i === 0 ? 50 : i % 2 === 0 ? 36 : 64} ${y + 35} ${x} ${next - 35} ${x} ${next}`;
		y = next;
	}
	const last = count % 2 === 0 ? 36 : 64;
	return `${d} C${last} ${y + 35} 50 ${100 * count - 20} 50 ${100 * count}`;
}

const GamePage: React.FC<{ project: Project }> = ({ project }) => {
	const hud = useRef<HTMLElement>(null);
	const [started, setStarted] = useState(false);

	// 게임처럼 START를 누르면 화면이 한 번 번쩍이고 첫 화면(HUD와 퀘스트)으로 내려간다
	const start = () => {
		setStarted(true);
		window.setTimeout(() => {
			hud.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
			setStarted(false);
		}, 260);
	};

	return (
		<div className="gm" data-started={started}>
			<header className="gm-title">
				<Sprite name="chicken-house" className="gm-house" />
				<Sprite name="tree" className="gm-tree a" />
				<Sprite name="fruit-tree" className="gm-tree b" />
				<Sprite name="tree" className="gm-tree c" />
				<Sprite name="sunflower" className="gm-sunflower" />
				<Sprite name="flower-pink" className="gm-flower a" />
				<Sprite name="flower-blue" className="gm-flower b" />
				<Sprite name="mushroom" className="gm-flower c" />
				<Sprite name="bush" className="gm-flower d" />
				<span className="gm-walker gm-cow" aria-hidden="true" />
				<span className="gm-walker gm-chick a" aria-hidden="true" />
				<span className="gm-walker gm-chick b" aria-hidden="true" />

				<div className="gm-title-body">
					<Favicon project={project} className="gm-icon" />
					<p className="gm-sign">{project.name}</p>
					<h1>{project.tagline}</h1>
					<p className="gm-lead">{project.description}</p>
					<Links project={project} className="gm-links" />
					<button type="button" className="gm-press" onClick={start} aria-label="시작: 퀘스트로 내려가기">
						PRESS START
					</button>
				</div>
			</header>

			<section className="gm-hud" aria-label="한눈에 보기" ref={hud}>
				{project.facts.map((fact) => (
					<div key={fact.label}>
						<span>{fact.label}</span>
						<strong>{fact.value}</strong>
					</div>
				))}
			</section>

			<div className="gm-row">
				<section className="gm-quests" aria-label="주요 기능">
					<h2>
						<img src={`${SPRITES}/star.png`} alt="" aria-hidden="true" /> 퀘스트
					</h2>
					{project.art && <img className="gm-art" src={project.art} alt={`${project.name} 장면`} />}
					<ol>
						{project.highlights.map((point) => (
							<li key={point.title} className="gm-dialog">
								<span className="gm-portrait" aria-hidden="true">
									<Favicon project={project} className="gm-face" />
								</span>
								<div className="gm-bubble">
									<h3>{point.title}</h3>
									<p>{point.body}</p>
									{point.image && <img className="gm-shot" src={point.image} alt={`${point.title} 장면`} />}
								</div>
							</li>
						))}
					</ol>
				</section>
				{project.controls && (
					<section className="gm-panel gm-controls" aria-label="조작법">
						<h2>조작법</h2>
						<ul>
							{project.controls.map((control) => (
								<li key={control.label}>
									<span className="gm-keys">
										{control.keys.map((key) => (
											<kbd key={key}>{key}</kbd>
										))}
									</span>
									<span>{control.label}</span>
								</li>
							))}
						</ul>
						<span className="gm-walker gm-runner" aria-hidden="true" />
					</section>
				)}
			</div>

			{project.gallery && (
				<section className="gm-day" aria-label="화면 모음">
					<h2>
						<img src={`${SPRITES}/heart.png`} alt="" aria-hidden="true" /> 하루
					</h2>
					<ol>
						{project.gallery.map((shot) => (
							<li key={shot.src}>
								<img src={shot.src} alt={shot.caption} loading="lazy" />
								<p>{shot.caption}</p>
							</li>
						))}
					</ol>
				</section>
			)}

			<section className="gm-map" aria-label="만든 방식">
				<h2 className="gm-map-title">개발 일지</h2>
				<div className="gm-road" style={{ '--stages': project.build.length } as React.CSSProperties}>
					<svg
						className="gm-road-line"
						viewBox={`0 0 100 ${project.build.length * 100}`}
						preserveAspectRatio="none"
						aria-hidden="true"
					>
						<path d={roadPath(project.build.length)} className="dirt" />
						<path d={roadPath(project.build.length)} className="edge" />
					</svg>
					<span className="gm-walker gm-hero" aria-hidden="true" />
					<ol>
						{project.build.map((point, i) => (
							<li key={point.title}>
								<span className="gm-marker" aria-hidden="true">
									{i + 1}
								</span>
								<div className="gm-stage">
									<span className="gm-stage-no">STAGE {i + 1}</span>
									<h3>{point.title}</h3>
									<p>{point.body}</p>
									{point.image && <img src={point.image} alt={`${point.title} 그림`} loading="lazy" />}
								</div>
							</li>
						))}
					</ol>
					<p className="gm-goal">
						<img src={`${SPRITES}/star.png`} alt="" aria-hidden="true" /> CLEAR
					</p>
				</div>
			</section>

			<section className="gm-inventory" aria-label="기술 사양">
				<h2>인벤토리</h2>
				<ul>
					{project.specs.map((spec) => (
						<li key={spec.label}>
							<span>{spec.label}</span>
							{spec.value}
						</li>
					))}
				</ul>
			</section>

			<section className="gm-credits" aria-label="맡은 일">
				<h2>CREDITS</h2>
				<p className="gm-credit-role">{project.context}</p>
				{project.period && <p className="gm-credit-role">{project.period}</p>}
				<ul>
					{project.contributions.map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
				{project.credits && (
					<ul className="gm-asset-credits">
						{project.credits.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				)}
				<p className="gm-end">{project.tagline}</p>
				<Links project={project} className="gm-links" />
			</section>
		</div>
	);
};

export default GamePage;
