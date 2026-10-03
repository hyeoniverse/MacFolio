// NewPick (뉴스레터): 신문 1면. 제호 → 속보 띠 → 머리기사와 옆 단(숫자, 진행 과정) → 기사 네 꼭지 → 두 단 해설 → 아래 칸(맡은 일, 기술 사양)
// 기사는 화면에 들어오면 잉크가 번지듯 나타나고, 가위 단추로 오려 두면 제호 옆 스크랩 수가 는다
import React, { useState } from 'react';
import type { Project } from '@/shared/profile';
import { Facts, Links, Shot } from '@/apps/safari/project/parts';
import '@/apps/safari/project/EditorialPage.css';
import { useReveal } from '@/apps/safari/project/reveal';

const EditorialPage: React.FC<{ project: Project }> = ({ project }) => {
	const root = useReveal<HTMLDivElement>();
	// 오려 둔 기사 제목
	const [clipped, setClipped] = useState<string[]>([]);
	const toggleClip = (title: string) =>
		setClipped((list) => (list.includes(title) ? list.filter((item) => item !== title) : [...list, title]));
	// 속보 띠: 기능과 만든 방식의 제목이 흘러간다 (끊김 없이 돌도록 두 번 잇는다)
	const headlines = [...project.highlights, ...project.build].map((point) => point.title);

	return (
		<div className="np" ref={root}>
			<header className="np-masthead">
				<p className="np-topline">
					<span>{project.context}</span>
					{project.period && <span>{project.period}</span>}
				</p>
				{project.logo ? (
					<img src={project.logo} alt={project.name} className="np-logo" />
				) : (
					<strong className="np-title">{project.name}</strong>
				)}
				<p className="np-rule" aria-hidden="true">
					<span>NO. 01</span>
					<span>{project.name}</span>
					<span>{project.language}</span>
				</p>
				<div className="np-ticker" aria-hidden="true">
					<strong>속보</strong>
					<div className="np-ticker-window">
						<div className="np-ticker-track">
							{[0, 1].map((copy) => (
								<span key={copy}>
									{headlines.map((title) => (
										<React.Fragment key={title}>
											{title}
											<i>◆</i>
										</React.Fragment>
									))}
								</span>
							))}
						</div>
					</div>
				</div>
			</header>

			<div className="np-front">
				<section className="np-lead" aria-label="머리기사" data-reveal="ink">
					<p className="np-kicker">오늘의 머리기사</p>
					<h1>{project.tagline}</h1>
					<p className="np-dek">{project.description}</p>
					<Links project={project} className="np-links" />
					<Shot project={project} className="np-shot" />
					<p className="np-caption">▲ {project.name} 첫 화면</p>
				</section>

				<div className="np-side">
					<section
						className="np-box"
						aria-label="한눈에 보기"
						data-reveal=""
						style={{ '--d': 1 } as React.CSSProperties}
					>
						<h2>숫자로 보면</h2>
						<Facts project={project} className="np-facts" />
					</section>
					{project.timeline && (
						<section
							className="np-box"
							aria-label="진행 과정"
							data-reveal=""
							style={{ '--d': 2 } as React.CSSProperties}
						>
							<h2>진행 과정</h2>
							<ol className="np-timeline">
								{project.timeline.map((step) => (
									<li key={step.date}>
										<time>{step.date}</time>
										<span>{step.label}</span>
									</li>
								))}
							</ol>
						</section>
					)}
				</div>
			</div>

			<section className="np-articles" aria-label="주요 기능">
				<div className="np-section np-section-row">
					<h2>주요 기능</h2>
					{/* 기사를 가위로 오려 두면 여기 모인다 */}
					<p className="np-scrap" aria-live="polite">
						<i className="fa-solid fa-scissors" aria-hidden="true" />
						{clipped.length > 0 ? `오려 둔 기사 ${clipped.length}개` : '기사에 마우스를 올려 가위로 오려 두세요'}
					</p>
				</div>
				<ol>
					{project.highlights.map((point, i) => {
						const on = clipped.includes(point.title);
						return (
							<li
								key={point.title}
								data-reveal="ink"
								data-clipped={on || undefined}
								style={{ '--d': i % 4 } as React.CSSProperties}
							>
								<h3>{point.title}</h3>
								<p>{point.body}</p>
								<button
									type="button"
									className="np-clip"
									aria-pressed={on}
									aria-label={`${point.title} 오려 두기`}
									onClick={() => toggleClip(point.title)}
								>
									<i className="fa-solid fa-scissors" aria-hidden="true" />
									{on ? '오려 둠' : '오려 두기'}
								</button>
							</li>
						);
					})}
				</ol>
			</section>

			<section className="np-column" aria-label="만든 방식">
				<h2 className="np-section">해설 · 만든 방식</h2>
				<div className="np-body">
					{project.build.map((point, i) => (
						<p key={point.title} data-reveal="ink" style={{ '--d': i % 2 } as React.CSSProperties}>
							<strong>{point.title}.</strong> {point.body}
						</p>
					))}
				</div>
			</section>

			<div className="np-bottom">
				<section className="np-byline" aria-label="맡은 일" data-reveal="">
					<h2 className="np-section">맡은 일</h2>
					{project.role && <p className="np-role">{project.role}</p>}
					<ul>
						{project.contributions.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				</section>
				<section
					className="np-classified"
					aria-label="기술 사양"
					data-reveal=""
					style={{ '--d': 1 } as React.CSSProperties}
				>
					<h2 className="np-section">기술 사양</h2>
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

			<footer className="np-foot" data-reveal="ink">
				<p>{project.tagline}</p>
				<Links project={project} className="np-links" />
			</footer>
		</div>
	);
};

export default EditorialPage;
