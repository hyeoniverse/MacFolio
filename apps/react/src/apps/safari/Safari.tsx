import React, { useEffect, useRef, useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import { PROJECTS, type Project } from '@/shared/profile';
import ProjectPage, { Favicon } from '@/apps/safari/ProjectPage';
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
