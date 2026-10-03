// NewPick (뉴스레터): 신문 1면. 제호 → 속보 띠 → 머리기사와 옆 단(숫자, 진행 과정) → 기사 꼭지 → 두 단 해설 → 기획 기사(장마다) → 아래 칸(맡은 일, 기술 사양)
// 기사는 화면에 들어오면 잉크가 번지듯 나타나고, 기사 꼭지를 펼치면 그 줄 아래에 자세한 설명과 실제 서비스 화면이 이어진다
import React, { useRef, useState } from 'react';
import type { Project, ProjectPoint } from '@/shared/profile';
import { Facts, Links, Shot } from '@/apps/safari/project/parts';
import '@/apps/safari/project/EditorialPage.css';
import { useReveal } from '@/apps/safari/project/reveal';

/**
 * 기사 꼭지: 신문처럼 단으로 나뉘어 있고, "기사 펼쳐 읽기"를 누르면 그 꼭지가 있는 줄 바로 아래에
 * 자세한 설명과 실제 서비스 화면이 한 단 너비로 펼쳐진다. 한 번에 한 꼭지만 펼친다
 */
const Articles: React.FC<{ points: ProjectPoint[] }> = ({ points }) => {
	const list = useRef<HTMLOListElement>(null);
	const [open, setOpen] = useState<number | null>(null);
	// 한 줄의 단 수: 펼친 기사를 그 줄 끝 다음에 끼우려고, 누를 때 지금 격자에서 센다
	const [columns, setColumns] = useState(3);
	const toggle = (i: number) => {
		const grid = list.current && getComputedStyle(list.current).gridTemplateColumns;
		setColumns(grid ? grid.split(' ').length : 3);
		setOpen((now) => (now === i ? null : i));
	};
	const rowEnd = open === null ? -1 : Math.min(points.length - 1, Math.floor(open / columns) * columns + columns - 1);
	const opened = open === null ? null : points[open];

	return (
		<section className="np-articles" aria-label="주요 기능">
			<h2 className="np-section">주요 기능</h2>
			<ol ref={list}>
				{points.map((point, i) => (
					<React.Fragment key={point.title}>
						<li
							data-reveal="ink"
							data-row-start={i % 3 === 0 || undefined}
							data-open={open === i || undefined}
							style={{ '--d': i % 4 } as React.CSSProperties}
						>
							<h3>{point.title}</h3>
							<p>{point.body}</p>
							{(point.detail || point.image) && (
								<button
									type="button"
									className="np-more"
									aria-expanded={open === i}
									aria-controls="np-article-detail"
									onClick={() => toggle(i)}
								>
									{open === i ? '접기' : '기사 펼쳐 읽기'}
									<i className="fa-solid fa-chevron-down" aria-hidden="true" />
								</button>
							)}
						</li>
						{i === rowEnd && opened && (
							<li className="np-detail" id="np-article-detail" key={`detail:${opened.title}`}>
								<div className="np-detail-text">
									<p className="np-kicker">자세히 · {opened.title}</p>
									<p>{opened.detail ?? opened.body}</p>
								</div>
								{opened.image && (
									<figure>
										<img src={opened.image} alt={`${opened.title} 화면`} />
										<figcaption>▲ 실제 서비스 화면</figcaption>
									</figure>
								)}
							</li>
						)}
					</React.Fragment>
				))}
			</ol>
		</section>
	);
};

const EditorialPage: React.FC<{ project: Project }> = ({ project }) => {
	const root = useReveal<HTMLDivElement>();
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

			<Articles points={project.highlights} />

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

			{project.chapters?.map((chapter) => (
				<section key={chapter.title} className="np-feature" aria-label={chapter.title}>
					<h2 className="np-section">기획 · {chapter.title}</h2>
					{chapter.lead && (
						<p className="np-feature-dek" data-reveal="ink">
							{chapter.lead}
						</p>
					)}
					<ol>
						{chapter.points.map((point, i) => (
							<li key={point.title} data-reveal="ink" style={{ '--d': i % 2 } as React.CSSProperties}>
								<h3>{point.title}</h3>
								<p>{point.body}</p>
							</li>
						))}
					</ol>
				</section>
			))}

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
