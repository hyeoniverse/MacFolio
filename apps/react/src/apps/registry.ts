// 앱 이름 → 창에 띄울 컴포넌트. 컴포넌트를 정의하는 파일이 아니라 목록이라 .ts로 둔다 (JSX 없이 createElement)
import { createElement, lazy, type ComponentType } from 'react';
import { PROJECT_APPS, WINDOW_APP_NAMES, type AppName } from '@/apps/manifest';

// 모든 앱은 처음 열 때 불러온다. 첫 화면(로딩·바탕화면)이 앱 코드를 기다리지 않게 하려고
// (예전에는 메모·Finder·텍스트 편집기만 따로 떼고 나머지 앱은 첫 묶음에 들어 있어 첫 방문에 890KB를 받았다)
const Safari = lazy(() => import('@/apps/safari/Safari'));
const Music = lazy(() => import('@/apps/music/Music'));
const Github = lazy(() => import('@/apps/github/Github'));
const Mail = lazy(() => import('@/apps/mail/Mail'));
const Settings = lazy(() => import('@/apps/settings/Settings'));
const Messages = lazy(() => import('@/apps/messages/Messages'));
const Terminal = lazy(() => import('@/apps/terminal/Terminal'));
const ProjectApp = lazy(() => import('@/apps/project/ProjectApp'));
const Passwords = lazy(() => import('@/apps/passwords/Passwords'));
const ApiDocs = lazy(() => import('@/apps/apidocs/ApiDocs'));
const Activity = lazy(() => import('@/apps/activity/Activity'));
const Photos = lazy(() => import('@/apps/photos/Photos'));
const Bin = lazy(() => import('@/apps/bin/Bin'));
const Weather = lazy(() => import('@/apps/weather/Weather'));
const Preview = lazy(() => import('@/apps/preview/Preview'));
const QuickTime = lazy(() => import('@/apps/quicktime/QuickTime'));
const Tips = lazy(() => import('@/apps/tips/Tips'));
const Memo = lazy(() => import('@/apps/memo/Memo'));
const Finder = lazy(() => import('@/apps/finder/Finder'));
const TextEdit = lazy(() => import('@/apps/textedit/TextEdit'));

/** 창으로 열리는 앱의 컴포넌트. 여기 없는 앱은 Dock 아이콘만 있다. */
const APP_COMPONENTS: Partial<Record<AppName, ComponentType>> = {
	finder: Finder,
	music: Music,
	safari: Safari,
	memo: Memo,
	github: Github,
	mail: Mail,
	settings: Settings,
	messages: Messages,
	terminal: Terminal,
	passwords: Passwords,
	apidocs: ApiDocs,
	activity: Activity,
	weather: Weather,
	preview: Preview,
	textedit: TextEdit,
	tips: Tips,
	quicktime: QuickTime,
	photos: Photos,
	bin: Bin,
};

/** 프로젝트 앱: 데모 사이트를 창 안에 띄운다 (shared/profile.ts의 PROJECTS에서) */
for (const { id } of PROJECT_APPS) {
	const Component = () => createElement(ProjectApp, { id });
	Component.displayName = `ProjectApp(${id})`;
	APP_COMPONENTS[id as AppName] = Component;
}

/** 데스크톱에 렌더링할 앱 (WINDOW_APP_NAMES 순서). 목록(manifest)에 있는데 컴포넌트가 없으면 여기서 바로 알 수 있게 한다 */
export const WINDOW_APPS = WINDOW_APP_NAMES.map((name) => {
	const Component = APP_COMPONENTS[name];
	if (!Component) throw new Error(`창으로 여는 앱인데 컴포넌트가 없다: ${name} (apps/registry.ts)`);
	return { name, Component };
});
