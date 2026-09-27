import type { ComponentType } from 'react';
import { APP_NAMES, type AppName } from '@/apps/manifest';

import Safari from '@/apps/safari/Safari';
import MusicPlayer from '@/apps/music/MusicPlayer';
import Memo from '@/apps/memo/Memo';
import { MemoProvider } from '@/apps/memo/MemoContext';
import Github from '@/apps/github/Github';
import Blog from '@/apps/blog/Blog';
import Mail from '@/apps/mail/Mail';

const MemoApp = () => (
	<MemoProvider>
		<Memo />
	</MemoProvider>
);

/** 창으로 열리는 앱의 컴포넌트. 여기 없는 앱은 Dock 아이콘만 있다. */
const APP_COMPONENTS: Partial<Record<AppName, ComponentType>> = {
	music: MusicPlayer,
	safari: Safari,
	memo: MemoApp,
	github: Github,
	blog: Blog,
	mail: Mail,
};

/** 데스크톱에 렌더링할 앱 (APP_NAMES 순서) */
export const WINDOW_APPS = APP_NAMES.flatMap((name) => {
	const Component = APP_COMPONENTS[name];
	return Component ? [{ name, Component }] : [];
});
