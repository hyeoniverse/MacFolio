import React from 'react';
import type { Project, ProjectLook } from '@/shared/profile';
// 공통 값을 먼저 읽어야 페이지마다의 CSS가 그 위에 덮인다
import '@/apps/safari/ProjectPage.css';
import ProductPage from '@/apps/safari/project/ProductPage';
import EditorialPage from '@/apps/safari/project/EditorialPage';
import BoardPage from '@/apps/safari/project/BoardPage';
import CardPage from '@/apps/safari/project/CardPage';
import GamePage from '@/apps/safari/project/GamePage';
import TerminalPage from '@/apps/safari/project/TerminalPage';
import CreativePage from '@/apps/safari/project/CreativePage';
import ShowcasePage from '@/apps/safari/project/ShowcasePage';

export { Favicon } from '@/apps/safari/project/parts';

/**
 * 모양마다 페이지의 짜임과 읽는 순서가 다르다 (색만 바꾸지 않는다).
 * product 제품 페이지, editorial 신문 1면, playful 칸반 보드, minimal 명함 앞뒤와 단계,
 * game 타이틀 화면부터 크레딧까지, terminal 명령과 결과, creative 붙어 있는 차례와 장, showcase 어떤 프로젝트에나 맞는 카드 모양
 */
const PAGES: Record<ProjectLook, React.FC<{ project: Project }>> = {
	showcase: ShowcasePage,
	product: ProductPage,
	editorial: EditorialPage,
	playful: BoardPage,
	minimal: CardPage,
	game: GamePage,
	terminal: TerminalPage,
	creative: CreativePage,
};

/** Safari 탭 안의 페이지: 프로젝트를 소개한다 */
const ProjectPage: React.FC<{ project: Project }> = ({ project }) => {
	const Page = PAGES[project.look];
	return (
		<article className="sp" data-look={project.look} aria-label={project.name}>
			<Page project={project} />
		</article>
	);
};

export default ProjectPage;
