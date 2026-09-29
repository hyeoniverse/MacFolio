import React, { useEffect, useRef, useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import { PROJECTS, type Project } from '@/shared/profile';
import '@/apps/safari/Safari.css';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** 탭 하나: 프로젝트 id, 또는 새 탭을 열었을 때의 시작 페이지 */
const START = 'start';
type TabId = string;

const findProject = (id: TabId) => PROJECTS.find((project) => project.id === id);
/** 탭에 보일 짧은 제목 (예: 'QRU 큐알유' → 'QRU') */
const tabTitle = (project?: Project) => (project ? project.name.split(/\s|\(/)[0] : '시작 페이지');

/** 주소창에 보일 주소 (데모가 있으면 데모, 없으면 저장소) */
const addressOf = (project: Project) => project.demo ?? project.url;
const displayAddress = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');

/** 탭과 즐겨찾기에 쓰는 작은 아이콘. 아이콘이 없는 프로젝트와 시작 페이지는 기본 모양 */
const Favicon: React.FC<{ project?: Project; className?: string }> = ({ project, className = 'safari-favicon' }) =>
	project?.icon ? (
		<img src={project.icon} alt="" className={className} />
	) : (
		<span className={`${className} fallback`} aria-hidden="true">
			<i className={project ? 'fa-solid fa-book' : 'fa-regular fa-star'} />
		</span>
	);

/** 섹션 제목: 굵은 제목 뒤에 흐린 글씨로 한 줄 덧붙인다 (Apple 홈페이지 방식) */
const Headline: React.FC<{ title: string; sub?: string }> = ({ title, sub }) => (
	<h2 className="sp-headline">
		{title}
		{sub && <span> {sub}</span>}
	</h2>
);

/** 탭 안의 페이지: Apple 제품 소개 페이지처럼 프로젝트를 소개한다 */
const ProjectPage: React.FC<{ project: Project }> = ({ project }) => {
	const links = (
		<div className="sp-links">
			{project.demo && (
				<a className="sp-pill" href={project.demo} {...external}>
					데모 보기
				</a>
			)}
			<a className="sp-link" href={project.url} {...external}>
				GitHub에서 보기 <i className="fa-solid fa-chevron-right" aria-hidden="true" />
			</a>
		</div>
	);

	return (
		<article className="sp" aria-label={project.name}>
			{/* 첫 화면: 아이콘, 이름, 큰 제목, 링크, 화면 캡처 */}
			<section className="sp-hero">
				<Favicon project={project} className="sp-app-icon" />
				<p className="sp-eyebrow">{project.name}</p>
				<h1>{project.tagline}</h1>
				<p className="sp-lead">{project.description}</p>
				{links}
				<figure className="sp-shot">
					<img src={project.image} alt={`${project.name} 화면`} />
				</figure>
			</section>

			{/* 한눈에 보는 숫자 */}
			<section className="sp-band" aria-label="한눈에 보기">
				<div className="sp-inner">
					<p className="sp-meta">
						{project.context}
						{project.period && ` · ${project.period}`}
					</p>
					<ul className="sp-facts">
						{project.facts.map((fact) => (
							<li key={fact.label}>
								<strong>{fact.value}</strong>
								<span>{fact.label}</span>
							</li>
						))}
					</ul>
				</div>
			</section>

			<section className="sp-section" aria-label="주요 기능">
				<div className="sp-inner">
					<Headline title="주요 기능." sub="써 보면 바로 보이는 것들." />
					<ul className="sp-tiles">
						{project.highlights.map((point, i) => (
							<li key={point.title} className={i === 0 ? 'wide' : undefined}>
								<h3>{point.title}</h3>
								<p>{point.body}</p>
							</li>
						))}
					</ul>
				</div>
			</section>

			<section className="sp-section sp-dark" aria-label="만든 방식">
				<div className="sp-inner">
					<Headline title="만든 방식." sub="보이지 않는 곳에서 신경 쓴 것들." />
					<ul className="sp-points">
						{project.build.map((point) => (
							<li key={point.title}>
								<h3>{point.title}</h3>
								<p>{point.body}</p>
							</li>
						))}
					</ul>
				</div>
			</section>

			{project.timeline && (
				<section className="sp-section" aria-label="진행 과정">
					<div className="sp-inner">
						<Headline title="진행 과정." sub={project.period} />
						<ol className="sp-timeline">
							{project.timeline.map((step) => (
								<li key={step.date}>
									<time>{step.date}</time>
									<span>{step.label}</span>
								</li>
							))}
						</ol>
					</div>
				</section>
			)}

			<section className="sp-section sp-alt" aria-label="맡은 일">
				<div className="sp-inner sp-split">
					<Headline title="맡은 일." sub={project.role} />
					<ul className="sp-checks">
						{project.contributions.map((item) => (
							<li key={item}>
								<i className="fa-solid fa-circle-check" aria-hidden="true" />
								{item}
							</li>
						))}
					</ul>
				</div>
			</section>

			{project.next && (
				<section className="sp-section" aria-label="다음 단계">
					<div className="sp-inner sp-split">
						<Headline title="다음 단계." sub="아직 남은 것들." />
						<ul className="sp-checks next">
							{project.next.map((item) => (
								<li key={item}>
									<i className="fa-regular fa-circle" aria-hidden="true" />
									{item}
								</li>
							))}
						</ul>
					</div>
				</section>
			)}

			{/* 기술 사양: Apple 제품의 '기술 사양' 표처럼 */}
			<section className="sp-section" aria-label="기술 사양">
				<div className="sp-inner">
					<h2 className="sp-specs-title">기술 사양</h2>
					<dl className="sp-specs">
						{project.specs.map((spec) => (
							<div key={spec.label}>
								<dt>{spec.label}</dt>
								<dd>{spec.value}</dd>
							</div>
						))}
					</dl>
				</div>
			</section>

			<footer className="sp-cta">
				<p>{project.tagline}</p>
				{links}
			</footer>
		</article>
	);
};

/** 새 탭: 즐겨찾기에 프로젝트를 늘어놓은 시작 페이지 */
const StartPage: React.FC<{ onOpen: (id: string) => void }> = ({ onOpen }) => (
	<section className="safari-start" aria-label="시작 페이지">
		<h2>즐겨찾기</h2>
		<ul>
			{PROJECTS.map((project) => (
				<li key={project.id}>
					<button type="button" onClick={() => onOpen(project.id)}>
						<Favicon project={project} className="safari-start-icon" />
						<span>{project.name}</span>
					</button>
				</li>
			))}
		</ul>
	</section>
);

/**
 * Safari: 프로젝트마다 탭이 하나씩 열린 브라우저. 탭을 고르면 그 프로젝트를 소개하는 페이지가 보인다.
 * 탭은 닫을 수 있고, + 로 연 새 탭(시작 페이지)에서 다시 연다.
 * 주소창을 누르면 실제 데모(없으면 저장소)를 새 탭에서 연다. 프로젝트는 GitHub 고정 저장소와 같다 (shared/profile.ts).
 */
const Safari: React.FC = () => {
	const [tabs, setTabs] = useState<TabId[]>(() => PROJECTS.map((project) => project.id));
	const [activeId, setActiveId] = useState<TabId>(PROJECTS[0].id);
	const index = Math.max(0, tabs.indexOf(activeId));
	const active = findProject(activeId);
	const tabList = useRef<HTMLDivElement>(null);

	// 고른 탭이 탭 막대 밖에 있으면 보이게 넘긴다
	useEffect(() => {
		const list = tabList.current;
		const tab = list?.querySelector<HTMLElement>('.safari-tab.active');
		if (!list || !tab) return;
		if (tab.offsetLeft < list.scrollLeft) list.scrollLeft = tab.offsetLeft;
		else if (tab.offsetLeft + tab.offsetWidth > list.scrollLeft + list.clientWidth)
			list.scrollLeft = tab.offsetLeft + tab.offsetWidth - list.clientWidth;
	}, [activeId]);

	const go = (offset: number) => setActiveId(tabs[index + offset]);

	const newTab = () => {
		if (!tabs.includes(START)) setTabs([...tabs, START]);
		setActiveId(START);
	};

	/** 시작 페이지에서 프로젝트를 고르면 그 탭이 프로젝트로 바뀐다. 이미 열려 있으면 그 탭으로 간다 */
	const openFromStart = (id: string) => {
		setTabs(tabs.includes(id) ? tabs.filter((tab) => tab !== START) : tabs.map((tab) => (tab === START ? id : tab)));
		setActiveId(id);
	};

	const closeTab = (id: TabId) => {
		const rest = tabs.filter((tab) => tab !== id);
		// 마지막 탭을 닫으면 빈 시작 페이지를 남긴다
		if (rest.length === 0) {
			setTabs([START]);
			setActiveId(START);
			return;
		}
		setTabs(rest);
		if (id === activeId) {
			const at = tabs.indexOf(id);
			setActiveId(rest[Math.min(at, rest.length - 1)]);
		}
	};

	return (
		<AppWindow title="Safari" appName="safari" chrome="unified">
			<div className="safari">
				{/* 도구 막대: 신호등 버튼 자리, 이전·다음 탭, 주소창, 새 탭에서 열기, 새 탭 */}
				<div className="safari-toolbar">
					<span className="safari-lights-space" aria-hidden="true" />
					<button
						type="button"
						className="safari-tool"
						aria-label="이전 탭"
						disabled={index === 0}
						onClick={() => go(-1)}
					>
						<i className="fa-solid fa-chevron-left" aria-hidden="true" />
					</button>
					<button
						type="button"
						className="safari-tool"
						aria-label="다음 탭"
						disabled={index === tabs.length - 1}
						onClick={() => go(1)}
					>
						<i className="fa-solid fa-chevron-right" aria-hidden="true" />
					</button>
					{active ? (
						<a className="safari-address" href={addressOf(active)} {...external} title="새 탭에서 열기">
							<i className="fa-solid fa-lock" aria-hidden="true" />
							<span>{displayAddress(addressOf(active))}</span>
						</a>
					) : (
						<span className="safari-address placeholder">
							<i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
							<span>검색 또는 웹 사이트 이름 입력</span>
						</span>
					)}
					{active && (
						<a className="safari-tool" href={addressOf(active)} {...external} aria-label="새 탭에서 열기">
							<i className="fa-solid fa-arrow-up-from-bracket" aria-hidden="true" />
						</a>
					)}
					<button type="button" className="safari-tool" aria-label="새 탭" onClick={newTab}>
						<i className="fa-solid fa-plus" aria-hidden="true" />
					</button>
				</div>

				{/* 탭 막대: 프로젝트마다 탭 하나. 올리면 닫기 단추가 보인다 */}
				<div ref={tabList} className="safari-tabs" role="tablist" aria-label="프로젝트 탭">
					{tabs.map((id) => {
						const project = findProject(id);
						const title = tabTitle(project);
						const selected = id === activeId;
						return (
							<div key={id} className={`safari-tab ${selected ? 'active' : ''}`}>
								<button
									type="button"
									className="safari-tab-close"
									aria-label={`${project?.name ?? title} 탭 닫기`}
									onClick={() => closeTab(id)}
								>
									<i className="fa-solid fa-xmark" aria-hidden="true" />
								</button>
								<button
									type="button"
									role="tab"
									id={`safari-tab-${id}`}
									aria-selected={selected}
									aria-controls="safari-tabpanel"
									className="safari-tab-button"
									onClick={() => setActiveId(id)}
								>
									<Favicon project={project} />
									<span>{title}</span>
								</button>
							</div>
						);
					})}
				</div>

				{/* 탭을 바꾸면 페이지를 새로 그린다: 맨 위부터 보이고, 나타나는 애니메이션이 다시 돈다 */}
				<div
					key={activeId}
					className="safari-page"
					role="tabpanel"
					id="safari-tabpanel"
					aria-labelledby={`safari-tab-${activeId}`}
				>
					{active ? <ProjectPage project={active} /> : <StartPage onOpen={openFromStart} />}
				</div>
			</div>
		</AppWindow>
	);
};

export default Safari;
