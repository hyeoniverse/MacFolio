import { useExitMotion } from '@/shared/ui/motion/useExitMotion';
import React, { useEffect, useRef, useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import { PROJECTS, type Project } from '@/shared/profile';
import { useProjectsVersion } from '@/shared/site/siteContent';
import ProjectPage, { Favicon } from '@/apps/safari/ProjectPage';
import { linkedId, setAppAddress, shareLink } from '@/shared/lib/appLink';
import { useAppMenus } from '@/desktop/status-bar/appMenus';
import { useOpenRequest } from '@/shared/lib/openRequest';
import ShareIcon from '@/shared/ui/ShareIcon';
import '@/apps/safari/Safari.css';
import IconButton from '@/shared/ui/button/IconButton';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import SafariMobile from '@/apps/safari/SafariMobile';
import { loadSerifKorean } from '@/apps/safari/serifFont';
import { useAppWindowShown } from '@/desktop/useAppWindowShown';
import Toolbar from '@/shared/ui/toolbar/Toolbar';
import FilePage from '@/apps/safari/FilePage';
import { FILE_TAB_PREFIX, fileNameOf } from '@/shared/lib/fileApps';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** 탭 하나: 프로젝트 id, 새 탭을 열었을 때의 시작 페이지, 또는 메모 글의 첨부 파일(file:<주소>, HTML 문서) */
const START = 'start';
type TabId = string;

const findProject = (id: TabId) => PROJECTS.find((project) => project.id === id);
/** 첨부 파일 탭이면 그 파일 주소 */
const fileOf = (id: TabId) => (id.startsWith(FILE_TAB_PREFIX) ? id.slice(FILE_TAB_PREFIX.length) : null);
/** 탭 제목. 지금 탭은 넓어서 다 보이고, 다른 탭은 좁아서 앞부분만 보인다 (말줄임) */
const tabTitle = (project?: Project) => project?.name ?? '시작 페이지';
const titleOf = (id: TabId) => {
	const file = fileOf(id);
	return file ? fileNameOf(file) : tabTitle(findProject(id));
};
/** 탭 본문: 프로젝트 페이지, 첨부 파일, 시작 페이지 */
const pageOf = (id: TabId, onOpen: (id: string) => void) => {
	const project = findProject(id);
	const file = fileOf(id);
	return project ? <ProjectPage project={project} /> : file ? <FilePage url={file} /> : <StartPage onOpen={onOpen} />;
};

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
 * 공유 버튼은 이 프로젝트 페이지의 주소(/safari/<프로젝트>)를 보낸다.
 */
const Safari: React.FC = () => {
	const mobile = useIsMobile();
	const [tabs, setTabs] = useState<TabId[]>(() => PROJECTS.map((project) => project.id));
	// 프로젝트 주소(/safari/<프로젝트>)로 들어왔으면 그 탭부터 (shared/lib/appLink.ts)
	const [activeId, setActiveId] = useState<TabId>(() => {
		const linked = linkedId('safari');
		return linked && findProject(linked) ? linked : PROJECTS[0].id;
	});
	// 시스템 설정에서 프로젝트를 저장하면 새로고침 없이 탭을 맞춘다: 빠진(숨긴) 프로젝트의 탭은 닫고,
	// 새로 생긴 프로젝트만 끝에 연다 (사용자가 닫아 둔 탭은 다시 열지 않는다). 페이지 모양·내용은 다시 그리면 바로 바뀐다
	const projectsVersion = useProjectsVersion();
	const knownIds = useRef(PROJECTS.map((project) => project.id));
	useEffect(() => {
		const ids = PROJECTS.map((project) => project.id);
		const added = ids.filter((id) => !knownIds.current.includes(id));
		knownIds.current = ids;
		// 순서도 시스템 설정에서 정한 차례로 (닫아 둔 탭은 닫힌 채, 시작 페이지 탭은 끝에)
		setTabs((previous) => [
			...ids.filter((id) => previous.includes(id) || added.includes(id)),
			...previous.filter((id) => id === START || fileOf(id)),
		]);
		setActiveId((current) =>
			current === START || fileOf(current) || findProject(current) ? current : (ids[0] ?? START)
		);
	}, [projectsVersion]);
	const index = Math.max(0, tabs.indexOf(activeId));
	const active = findProject(activeId);
	const activeFile = fileOf(activeId);
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

	// 한글 명조는 Safari를 실제로 볼 때 받는다 (serifFont.ts). 바탕화면은 Safari 창이 처음부터 열려 있으므로,
	// 창 안을 누르거나 스크롤·키 입력, 탭을 고름(주소로 들어온 경우 포함), 닫았던 창을 다시 엶 중 하나가 있을 때.
	// 휴대폰은 앱을 열어야 이 화면이 그려진다
	const [engaged, setEngaged] = useState(false);
	const engage = engaged ? undefined : () => setEngaged(true);
	const shown = useAppWindowShown('safari');
	const wasShown = useRef(shown);
	useEffect(() => {
		if (shown && !wasShown.current) setEngaged(true);
		wasShown.current = shown;
	}, [shown]);
	useEffect(() => {
		if (mobile || chosen || engaged) loadSerifKorean();
	}, [mobile, chosen, engaged]);

	const go = (offset: number) => choose(tabs[index + offset]);

	const tabExit = useExitMotion<HTMLDivElement>('pop-out');
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
	// 메모 글의 첨부 파일(file:<주소>)은 그 파일의 탭을 연다 (같은 파일이면 그 탭으로)
	useOpenRequest('safari', (id) => {
		if (!findProject(id) && !fileOf(id)) return;
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

	const share = active ? () => void shareLink({ app: 'safari', id: active.id }, active.name) : null;
	/** 탭을 바꾸면 페이지를 새로 그린다: 맨 위부터 보이고, 나타나는 애니메이션이 다시 돈다 */
	const page = (
		<div
			key={activeId}
			// 탭을 바꾸면 서서히 바뀐다 (휴대폰은 SafariMobile의 넘기기)
			className={`safari-page ${mobile ? '' : 'motion-swap'}`}
			role="tabpanel"
			id="safari-tabpanel"
			aria-labelledby={mobile ? undefined : `safari-tab-${activeId}`}
			aria-label={mobile ? titleOf(activeId) : undefined}
		>
			{pageOf(activeId, openFromStart)}
		</div>
	);

	return (
		<AppWindow title="Safari" appName="safari" chrome="unified">
			{/* 휴대폰은 iOS Safari처럼 따로 짠다 (SafariMobile): 페이지가 화면을 다 쓰고 아래 떠 있는 막대 하나 */}
			{mobile ? (
				<div className="safari">
					<SafariMobile
						tabs={tabs}
						activeId={activeId}
						projectOf={findProject}
						titleOf={titleOf}
						renderPage={(id) => pageOf(id, () => undefined)}
						page={page}
						address={
							active
								? { href: addressOf(active), text: displayAddress(addressOf(active)) }
								: activeFile
									? { href: activeFile, text: fileNameOf(activeFile) }
									: null
						}
						onChoose={choose}
						onCloseTab={closeTab}
						onNewTab={newTab}
						onShare={share}
					/>
				</div>
			) : (
				<div className="safari" onPointerDownCapture={engage} onWheelCapture={engage} onKeyDownCapture={engage}>
					{/* 도구 막대: 신호등 버튼 자리, 이전·다음 탭, 주소창, 새 탭에서 열기, 새 탭 */}
					<Toolbar className="safari-toolbar">
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
						) : activeFile ? (
							<a className="safari-address" href={activeFile} {...external} title="새 탭에서 열기">
								<i className="fa-regular fa-file-code" aria-hidden="true" />
								<span>{fileNameOf(activeFile)}</span>
							</a>
						) : (
							<span className="safari-address placeholder">
								<i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
								<span>검색 또는 웹 사이트 이름 입력</span>
							</span>
						)}
						{/* 공유: 이 프로젝트 페이지(MacFolio 안의 주소)를 보낸다. 데모·저장소는 주소창을 눌러 연다 */}
						{active && (
							<IconButton className="safari-share" label="링크 공유" onClick={share!}>
								<ShareIcon />
							</IconButton>
						)}
						<IconButton label="새 탭" onClick={newTab} icon="fa-solid fa-plus" />
					</Toolbar>

					{/* 탭 막대: 프로젝트마다 탭 하나. 지금 탭은 넉넉하게, 나머지는 짧게 나눠 갖는다. 올리면 닫기 버튼이 보인다 */}
					<div ref={tabList} className="safari-tabs" role="tablist" aria-label="프로젝트 탭">
						{tabs.map((id) => {
							const project = findProject(id);
							const title = titleOf(id);
							const selected = id === activeId;
							return (
								// 새 탭은 톡 나타나고, 닫은 탭은 작아지며 사라진다
								<div key={id} ref={tabExit} className={`safari-tab ${selected ? 'active' : ''}`}>
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
										{fileOf(id) ? (
											<i className="fa-regular fa-file-code safari-file-favicon" aria-hidden="true" />
										) : (
											<Favicon project={project} />
										)}
										<span title={title}>{title}</span>
									</button>
								</div>
							);
						})}
					</div>

					{page}
				</div>
			)}
		</AppWindow>
	);
};

export default Safari;
