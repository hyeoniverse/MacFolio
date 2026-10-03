import ProjectApp from '@/apps/project/ProjectApp';

// 배포한 사이트가 있는 프로젝트의 앱 (새싹 농장은 apps/sproutfarm). 사이트를 창 안에 띄운다
export const NewPick = () => <ProjectApp appName="newpick" projectId="newpick" />;
export const WhatToDo = () => <ProjectApp appName="whattodo" projectId="whattodo" />;
export const Qru = () => <ProjectApp appName="qru" projectId="qru" />;
