// SproutFarm (게임): 게임 화면 흐름. 타이틀 화면 → HUD(숫자) → 퀘스트(기능)와 조작법 → 스테이지 지도(만든 방식) → 인벤토리(기술 사양) → 크레딧(맡은 일)
import React, { useRef, useState } from 'react';
import type { Project } from '@/shared/profile';
import { Favicon, Links } from '@/apps/safari/project/parts';
import '@/apps/safari/project/GamePage.css';

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
				<img className="gm-backdrop" src={project.image} alt={`${project.name} 화면`} />
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
				<section className="gm-panel gm-quests" aria-label="주요 기능">
					<h2>퀘스트</h2>
					{project.art && <img className="gm-art" src={project.art} alt={`${project.name} 장면`} />}
					<ol>
						{project.highlights.map((point) => (
							<li key={point.title}>
								<span className="gm-check" aria-hidden="true" />
								<div>
									<h3>{point.title}</h3>
									<p>{point.body}</p>
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
					</section>
				)}
			</div>

			<section className="gm-map" aria-label="만든 방식">
				<h2>개발 일지</h2>
				<ol>
					{project.build.map((point, i) => (
						<li key={point.title}>
							<span className="gm-stage">STAGE {i + 1}</span>
							<h3>{point.title}</h3>
							<p>{point.body}</p>
						</li>
					))}
				</ol>
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
				<p className="gm-end">{project.tagline}</p>
				<Links project={project} className="gm-links" />
			</section>
		</div>
	);
};

export default GamePage;
