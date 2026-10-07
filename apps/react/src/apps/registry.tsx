import { lazy, type ComponentType } from 'react';
import { APP_NAMES, PROJECT_APPS, type AppName } from '@/apps/manifest';

import Safari from '@/apps/safari/Safari';
import Music from '@/apps/music/Music';
import Github from '@/apps/github/Github';
import Mail from '@/apps/mail/Mail';
import Settings from '@/apps/settings/Settings';
import Messages from '@/apps/messages/Messages';
import Terminal from '@/apps/terminal/Terminal';
import ProjectApp from '@/apps/project/ProjectApp';
import Passwords from '@/apps/passwords/Passwords';
import ApiDocs from '@/apps/apidocs/ApiDocs';
import Activity from '@/apps/activity/Activity';

// Markdown 렌더러가 무거워서 메모(블로그)는 처음 열 때 불러온다
const Memo = lazy(() => import('@/apps/memo/Memo'));
// Finder는 저장소 문서를 묶어 두어서 처음 열 때 불러온다. 이 목록(WINDOW_APPS)을 Finder가 다시 읽으므로 지연 로딩이어야 한다
const Finder = lazy(() => import('@/apps/finder/Finder'));

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
};

/** 프로젝트 앱: 데모 사이트를 창 안에 띄운다 (shared/profile.ts의 PROJECTS에서) */
for (const { id } of PROJECT_APPS) {
	const Component = () => <ProjectApp id={id} />;
	Component.displayName = `ProjectApp(${id})`;
	APP_COMPONENTS[id as AppName] = Component;
}

/** 웹 페이지를 화면 가득 보여 주는 앱: Safari와, 남의 페이지를 통째로 띄우는 앱(WebFrame).
 * 휴대폰에서는 페이지가 상태 표시줄 밑까지 그려져, 상태 표시줄에 흐린 유리를 깐다 */
export const WEB_PAGE_APPS: ReadonlySet<AppName> = new Set<AppName>([
	'safari',
	'apidocs',
	...PROJECT_APPS.map(({ id }) => id as AppName),
]);

/** 데스크톱에 렌더링할 앱 (APP_NAMES 순서) */
export const WINDOW_APPS = APP_NAMES.flatMap((name) => {
	const Component = APP_COMPONENTS[name];
	return Component ? [{ name, Component }] : [];
});
