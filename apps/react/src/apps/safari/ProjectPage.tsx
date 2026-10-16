import React from 'react';
import { DEFAULT_LOOK } from '@macfolio/desktop-core/site';
import type { Project, ProjectLook } from '@/shared/profile';
// 공통 값을 먼저 읽어야 페이지마다의 CSS가 그 위에 덮인다
import '@/apps/safari/ProjectPage.css';
import { TEMPLATE_PAGES } from '@/apps/safari/project/templates';
import { CUSTOM_PAGES } from '@/apps/safari/project/custom';

export { Favicon } from '@/apps/safari/project/parts';

/**
 * 모양마다의 페이지. 랜딩 템플릿(project/templates/)은 같은 내용을 다른 디자인으로 그린다.
 * custom은 프로젝트 id로 등록한 직접 짠 페이지(project/custom/)이고, 등록이 없으면 기본 모양으로 그린다
 */
const PAGES: Record<Exclude<ProjectLook, 'custom'>, React.FC<{ project: Project }>> = TEMPLATE_PAGES;

/** Safari 탭 안의 페이지: 프로젝트를 소개한다 */
const ProjectPage: React.FC<{ project: Project }> = ({ project }) => {
	const custom = project.look === 'custom' ? CUSTOM_PAGES[project.id] : undefined;
	const look = project.look === 'custom' ? DEFAULT_LOOK : project.look;
	const Page = custom?.page ?? PAGES[look];
	// 직접 짠 페이지는 자기 CSS가 알아보는 이름(tone)을 data-look에 둔다. 랜딩 템플릿은 data-template을 달아 공통 요소 규칙을 받지 않는다
	return (
		<article
			className="sp"
			data-look={custom?.tone ?? look}
			data-template={custom ? undefined : ''}
			aria-label={project.name}
		>
			<Page project={project} />
		</article>
	);
};

export default ProjectPage;
