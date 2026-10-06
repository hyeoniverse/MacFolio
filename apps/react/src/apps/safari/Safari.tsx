import React, { useEffect, useRef, useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import { PROJECTS, type Project } from '@/shared/profile';
import ProjectPage, { Favicon } from '@/apps/safari/ProjectPage';
import { linkedId, setAppAddress, shareLink } from '@/shared/lib/appLink';
import { useAppMenus } from '@/desktop/status-bar/appMenus';
import { useOpenRequest } from '@/shared/lib/openRequest';
import ShareIcon from '@/shared/ui/ShareIcon';
import '@/apps/safari/Safari.css';
import IconButton from '@/shared/ui/button/IconButton';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** 탭 하나: 프로젝트 id, 또는 새 탭을 열었을 때의 시작 페이지 */
const START = 'start';
type TabId = string;

const findProject = (id: TabId) => PROJECTS.find((project) => project.id === id);
/** 탭 제목. 지금 탭은 넓어서 다 보이고, 다른 탭은 좁아서 앞부분만 보인다 (말줄임) */
const tabTitle = (project?: Project) => project?.name ?? '시작 페이지';

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
 * 공유 단추는 이 프로젝트 페이지의 주소(/safari/<프로젝트>)를 보낸다.
 */
const Safari: React.FC = () => {
	const [tabs, setTabs] = useState<TabId[]>(() => PROJECTS.map((project) => project.id));
	// 프로젝트 주소(/safari/<프로젝트>)로 들어왔으면 그 탭부터 (shared/lib/appLink.ts)
	const [activeId, setActiveId] = useState<TabId>(() => {
		const linked = linkedId('safari');
		return linked && findProject(linked) ? linked : PROJECTS[0].id;
	});
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

	// 주소 막대에 지금 탭의 주소를 둔다. 주소로 들어왔거나 직접 탭을 고른 뒤부터 (처음 탭으로 사이트 주소를 덮지 않게).
	// 시작 페이지는 주소가 없다. 창을 닫으면 없앤다
	const [chosen, setChosen] = useState(() => activeId === linkedId('safari'));
	const choose = (id: TabId) => {
		setChosen(true);
		setActiveId(id);
	};
	useEffect(() => setAppAddress('safari', chosen && active ? active.id : null), [chosen, active]);
	useEffect(() => () => setAppAddress('safari', null), []);

	const go = (offset: number) => choose(tabs[index + offset]);

	const newTab = () => {
		if (!tabs.includes(START)) setTabs([...tabs, START]);
		setActiveId(START);
	};

	/** 시작 페이지에서 프로젝트를 고르면 그 탭이 프로젝트로 바뀐다. 이미 열려 있으면 그 탭으로 간다 */
	const openFromStart = (id: string) => {
		setTabs(tabs.includes(id) ? tabs.filter((tab) => tab !== START) : tabs.map((tab) => (tab === START ? id : tab)));
		choose(id);
	};

	// Finder에서 프로젝트를 열면 그 탭으로 간다. 닫아 둔 탭이면 다시 연다 (shared/lib/openRequest.ts)
	useOpenRequest('safari', (id) => {
		if (!findProject(id)) return;
		setTabs((current) => (current.includes(id) ? current : [...current.filter((tab) => tab !== START), id]));
		choose(id);
	});

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

	// 메뉴 막대의 Safari 메뉴 (#96)
	useAppMenus('safari', [
		{
			title: '파일',
			items: [
				{ label: '새로운 탭', icon: 'fa-solid fa-plus', shortcut: { code: 'KeyT', alt: true }, onSelect: newTab },
				{ label: '탭 닫기', shortcut: { code: 'KeyW', alt: true }, onSelect: () => closeTab(activeId) },
			],
		},
		{
			// macOS Safari처럼 프로젝트를 책갈피로: 고르면 그 탭을 연다 (닫았으면 다시 연다)
			title: '책갈피',
			items: PROJECTS.map((project) => ({
				label: project.name,
				checked: activeId === project.id,
				onSelect: () => {
					setTabs((current) =>
						current.includes(project.id) ? current : [...current.filter((tab) => tab !== START), project.id]
					);
					choose(project.id);
				},
			})),
		},
		{
			// 탭 넘기기는 macOS Safari처럼 윈도우 메뉴에
			title: '윈도우',
			items: [
				{
					label: '이전 탭 보기',
					icon: 'fa-solid fa-chevron-left',
					disabled: index === 0,
					shortcut: { code: 'BracketLeft', alt: true, shift: true },
					onSelect: () => go(-1),
				},
				{
					label: '다음 탭 보기',
					icon: 'fa-solid fa-chevron-right',
					disabled: index >= tabs.length - 1,
					shortcut: { code: 'BracketRight', alt: true, shift: true },
					onSelect: () => go(1),
				},
			],
		},
	]);

	return (
		<AppWindow title="Safari" appName="safari" chrome="unified">
			<div className="safari">
				{/* 도구 막대: 신호등 버튼 자리, 이전·다음 탭, 주소창, 새 탭에서 열기, 새 탭 */}
				<div className="safari-toolbar">
					<span className="safari-lights-space" aria-hidden="true" />
					<IconButton label="이전 탭" disabled={index === 0} onClick={() => go(-1)} icon="fa-solid fa-chevron-left" />
					<IconButton
						label="다음 탭"
						disabled={index === tabs.length - 1}
						onClick={() => go(1)}
						icon="fa-solid fa-chevron-right"
					/>
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
					{/* 공유: 이 프로젝트 페이지(MacFolio 안의 주소)를 보낸다. 데모·저장소는 주소창을 눌러 연다 */}
					{active && (
						<IconButton
							className="safari-share"
							label="링크 공유"
							onClick={() => void shareLink({ app: 'safari', id: active.id }, active.name)}
						>
							<ShareIcon />
						</IconButton>
					)}
					<IconButton label="새 탭" onClick={newTab} icon="fa-solid fa-plus" />
				</div>

				{/* 탭 막대: 프로젝트마다 탭 하나. 지금 탭은 넉넉하게, 나머지는 짧게 나눠 갖는다. 올리면 닫기 단추가 보인다 */}
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
									onClick={() => choose(id)}
								>
									<Favicon project={project} />
									<span title={title}>{title}</span>
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
