import React from 'react';
import AppWindow from '@/desktop/window/Window';
import WebFrame from '@/shared/ui/web-frame/WebFrame';
import { PROJECT_APPS, type AppName } from '@/apps/manifest';

interface ProjectAppProps {
	/** shared/profile.ts의 프로젝트 id (= 앱 이름) */
	id: string;
}

/**
 * 배포한 프로젝트 사이트를 창 안에 그대로 띄운다 (iframe). PROJECTS에서 app이 있는 프로젝트가 모두 같은 틀을 쓴다.
 */
const ProjectApp: React.FC<ProjectAppProps> = ({ id }) => {
	const project = PROJECT_APPS.find((item) => item.id === id);
	if (!project?.demo) return null;

	return (
		<AppWindow title={project.name} appName={id as AppName}>
			<WebFrame
				src={project.demo}
				title={project.name}
				appName={id as AppName}
				icon={project.icon}
				tone={project.app.tone ?? 'light'}
				allow="autoplay; fullscreen; gamepad; clipboard-write"
			/>
		</AppWindow>
	);
};

export default ProjectApp;
