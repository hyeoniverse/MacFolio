import React, { useEffect, useRef, useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import { useAppState } from '@/desktop/AppStateContext';
import { PROJECT_APPS, type AppName } from '@/apps/manifest';
import '@/apps/project/ProjectApp.css';

/** 이만큼 지나도 사이트가 다 불러지지 않으면 새 탭에서 여는 길을 알려 준다 */
const SLOW_MS = 8000;

interface ProjectAppProps {
	/** shared/profile.ts의 프로젝트 id (= 앱 이름) */
	id: string;
}

/**
 * 배포한 프로젝트 사이트를 창 안에 그대로 띄운다 (iframe). PROJECTS에서 app이 있는 프로젝트가 모두 같은 틀을 쓴다.
 * 사이트를 불러오는 동안은 프로젝트 아이콘을 보여 주고, 오래 걸리면 새 탭에서 여는 링크를 띄운다
 * (사이트가 다른 곳에 들어가는 것을 막아 두었으면 iframe에는 빈 화면만 남기 때문이다).
 */
const ProjectApp: React.FC<ProjectAppProps> = ({ id }) => {
	const project = PROJECT_APPS.find((item) => item.id === id);
	const appName = id as AppName;
	const tone = project?.app.tone ?? 'light';
	const frame = useRef<HTMLIFrameElement>(null);
	const { bringAppToFront } = useAppState();
	const [loaded, setLoaded] = useState(false);
	const [slow, setSlow] = useState(false);

	// iframe 안을 누르면 이벤트가 창까지 오지 않는다. 대신 이 문서가 포커스를 잃으니, 그때 창을 맨 앞으로
	useEffect(() => {
		const onBlur = () => {
			if (document.activeElement === frame.current) bringAppToFront(appName);
		};
		window.addEventListener('blur', onBlur);
		return () => window.removeEventListener('blur', onBlur);
	}, [appName, bringAppToFront]);

	useEffect(() => {
		if (loaded) return;
		const timer = setTimeout(() => setSlow(true), SLOW_MS);
		return () => clearTimeout(timer);
	}, [loaded]);

	if (!project?.demo) return null;

	return (
		<AppWindow title={project.name} appName={appName}>
			<div className={`project-app ${tone}`}>
				<iframe
					ref={frame}
					src={project.demo}
					title={project.name}
					allow="autoplay; fullscreen; gamepad; clipboard-write"
					allowFullScreen
					onLoad={() => setLoaded(true)}
				/>
				{!loaded && (
					<div className="project-app-loading" role="status">
						{project.icon && <img src={project.icon} alt="" />}
						<span>{project.name} 불러오는 중…</span>
						{slow && (
							<a href={project.demo} target="_blank" rel="noopener noreferrer">
								열리지 않으면 새 탭에서 열기
							</a>
						)}
					</div>
				)}
			</div>
		</AppWindow>
	);
};

export default ProjectApp;
