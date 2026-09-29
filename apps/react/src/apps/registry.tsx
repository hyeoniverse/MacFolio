import { lazy, type ComponentType } from 'react';
import { APP_NAMES, type AppName } from '@/apps/manifest';

import Safari from '@/apps/safari/Safari';
import Music from '@/apps/music/Music';
import Github from '@/apps/github/Github';
import Mail from '@/apps/mail/Mail';
import Settings from '@/apps/settings/Settings';
import Messages from '@/apps/messages/Messages';
import Terminal from '@/apps/terminal/Terminal';
import SproutFarm from '@/apps/sproutfarm/SproutFarm';
import Passwords from '@/apps/passwords/Passwords';

// Markdown 렌더러가 무거워서 메모(블로그)는 처음 열 때 불러온다
const Memo = lazy(() => import('@/apps/memo/Memo'));

/** 창으로 열리는 앱의 컴포넌트. 여기 없는 앱은 Dock 아이콘만 있다. */
const APP_COMPONENTS: Partial<Record<AppName, ComponentType>> = {
	music: Music,
	safari: Safari,
	memo: Memo,
	github: Github,
	mail: Mail,
	settings: Settings,
	messages: Messages,
	terminal: Terminal,
	sproutfarm: SproutFarm,
	passwords: Passwords,
};

/** 데스크톱에 렌더링할 앱 (APP_NAMES 순서) */
export const WINDOW_APPS = APP_NAMES.flatMap((name) => {
	const Component = APP_COMPONENTS[name];
	return Component ? [{ name, Component }] : [];
});
