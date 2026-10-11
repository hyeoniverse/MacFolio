import React from 'react';
import type { Project, ProjectLook } from '@/shared/profile';
// 공통 값을 먼저 읽어야 페이지마다의 CSS가 그 위에 덮인다
import '@/apps/safari/ProjectPage.css';
import ShowcasePage from '@/apps/safari/project/ShowcasePage';
import CinemaPage from '@/apps/safari/project/CinemaPage';
import PhonePage from '@/apps/safari/project/PhonePage';
import HorizontalPage from '@/apps/safari/project/HorizontalPage';
import BrutalPage from '@/apps/safari/project/BrutalPage';
import ArcadePage from '@/apps/safari/project/ArcadePage';
import AtelierPage from '@/apps/safari/project/AtelierPage';
import InboxPage from '@/apps/safari/project/InboxPage';
import ChecklistPage from '@/apps/safari/project/ChecklistPage';
import RepoPage from '@/apps/safari/project/RepoPage';
import DialoguePage from '@/apps/safari/project/DialoguePage';
import DeckPage from '@/apps/safari/project/DeckPage';
import AssistantPage from '@/apps/safari/project/AssistantPage';
import { CUSTOM_PAGES } from '@/apps/safari/project/custom';

export { Favicon } from '@/apps/safari/project/parts';

/**
 * 모양마다 페이지의 짜임과 읽는 방식이 다르다 (색만 바꾸지 않는다). 어떤 모양이 무엇인지는 desktop-core의 PROJECT_LOOKS 주석에.
 * custom은 프로젝트 id로 등록한 직접 짠 페이지(project/custom/)이고, 등록이 없으면 showcase로 그린다
 */
const PAGES: Record<Exclude<ProjectLook, 'custom'>, React.FC<{ project: Project }>> = {
	showcase: ShowcasePage,
	cinema: CinemaPage,
	phone: PhonePage,
	horizontal: HorizontalPage,
	brutal: BrutalPage,
	arcade: ArcadePage,
	atelier: AtelierPage,
	inbox: InboxPage,
	checklist: ChecklistPage,
	repo: RepoPage,
	dialogue: DialoguePage,
	deck: DeckPage,
	assistant: AssistantPage,
};

/** Safari 탭 안의 페이지: 프로젝트를 소개한다 */
const ProjectPage: React.FC<{ project: Project }> = ({ project }) => {
	const custom = project.look === 'custom' ? CUSTOM_PAGES[project.id] : undefined;
	const Page = project.look === 'custom' ? (custom?.page ?? ShowcasePage) : PAGES[project.look];
	// 직접 짠 페이지는 자기 CSS가 알아보는 이름(tone)을 data-look에 둔다
	return (
		<article className="sp" data-look={custom?.tone ?? project.look} aria-label={project.name}>
			<Page project={project} />
		</article>
	);
};

export default ProjectPage;
