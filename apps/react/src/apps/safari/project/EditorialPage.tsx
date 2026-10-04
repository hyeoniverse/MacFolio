// NewPick (뉴스레터): 신문 1면. 제호 → 속보 띠 → 머리기사와 옆 단(숫자, 진행 과정) → 기사 꼭지 → 두 단 해설 → 기획 기사(장마다) → 아래 칸(맡은 일, 기술 사양)
// 기사는 화면에 들어오면 잉크가 번지듯 나타난다. 주요 기능은 머리 사진 기사, 사진 기사, 단신으로 짠 지면
import React from 'react';
import type { Project, ProjectPoint } from '@/shared/profile';
import { Facts, Links, Shot } from '@/apps/safari/project/parts';
import '@/apps/safari/project/EditorialPage.css';
import { useReveal } from '@/apps/safari/project/reveal';

/** 사진 기사의 사진과 그 아래 설명 */
const Photo: React.FC<{ point: ProjectPoint }> = ({ point }) =>
	point.image ? (
		<figure className="np-photo">
			<img src={point.image} alt={`${point.title} 화면`} loading="lazy" />
			<figcaption>▲ 실제 서비스 화면 · {point.title}</figcaption>
		</figure>
	) : null;

/**
 * 기사 꼭지: 신문 지면처럼 처음부터 다 펼쳐 둔다. 첫 꼭지는 머리 사진 기사(큰 제목, 본문, 사진),
 * 사진이 있는 꼭지는 단을 나눈 사진 기사, 사진이 없는 꼭지는 단신 상자에 모은다. 사진에는 실제 서비스 화면이라는 설명을 단다
 */
const Articles: React.FC<{ points: ProjectPoint[] }> = ({ points }) => {
	const [lead, ...rest] = points;
	const photos = rest.filter((point) => point.image);
	const briefs = rest.filter((point) => !point.image);

	return (
		<section className="np-articles" aria-label="주요 기능">
			<h2 className="np-section">주요 기능</h2>
			{lead && (
				<article className="np-story-lead" data-reveal="ink">
					<div>
						<p className="np-kicker">머리 기사</p>
						<h3>{lead.title}</h3>
						<p className="np-story-dek">{lead.body}</p>
						{lead.detail && <p className="np-story-body">{lead.detail}</p>}
					</div>
					<Photo point={lead} />
				</article>
			)}
			{photos.length > 0 && (
				<div className="np-stories">
					{photos.map((point, i) => (
						<article key={point.title} data-reveal="ink" style={{ '--d': i } as React.CSSProperties}>
							<Photo point={point} />
							<h3>{point.title}</h3>
							<p className="np-story-dek">{point.body}</p>
							{point.detail && <p className="np-story-body">{point.detail}</p>}
						</article>
					))}
				</div>
			)}
			{briefs.length > 0 && (
				<aside className="np-briefs" aria-label="단신" data-reveal="ink">
					<p className="np-briefs-title">단신</p>
					{briefs.map((point) => (
						<article key={point.title}>
							<h3>{point.title}</h3>
							<p>
								{point.body} {point.detail}
							</p>
						</article>
					))}
				</aside>
			)}
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
