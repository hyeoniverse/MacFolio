// 앱 목록의 단일 출처. React에 의존하지 않는 정보만 둔다.
// 컴포넌트 연결은 registry.tsx에서 한다.

export const APP_NAMES = [
	'finder',
	'music',
	'safari',
	'photos',
	'messages',
	'memo',
	'github',
	'blog',
	'notion',
	'mail',
	'share',
	'settings',
	'bin',
] as const;

export type AppName = (typeof APP_NAMES)[number];

export interface AppManifest {
	/** 아이콘 파일 이름 (env.imageUrl 기준) */
	icon: string;
	/** Dock 왼쪽 영역에 표시할지 여부. bin은 오른쪽에 따로 표시한다. */
	inDock: boolean;
	/** 처음 화면에 들어왔을 때 실행 중인 상태로 시작할지 여부 */
	runningAtStart?: boolean;
	/** Dock 아이콘의 둥근 모서리를 없앨지 여부 */
	squareIcon?: boolean;
	/** 창을 여는 대신 실행할 동작 */
	action?: { type: 'link'; url: string } | { type: 'share' };
}

export const APP_MANIFEST: Record<AppName, AppManifest> = {
	finder: { icon: 'finder.png', inDock: true, runningAtStart: true },
	music: { icon: 'music.png', inDock: true, runningAtStart: true },
	safari: { icon: 'safari.png', inDock: true, runningAtStart: true },
	photos: { icon: 'photos.png', inDock: true },
	messages: { icon: 'messages.png', inDock: true },
	memo: { icon: 'memo.png', inDock: true },
	github: { icon: 'github.png', inDock: true },
	blog: { icon: 'blog.png', inDock: true },
	notion: {
		icon: 'notion.png',
		inDock: true,
		squareIcon: true,
		action: {
			type: 'link',
			url: 'https://calico-octave-0a0.notion.site/62b2692248d045bdb1796368054b3ac2?pvs=74',
		},
	},
	mail: { icon: 'mail.png', inDock: true },
	share: { icon: 'share.png', inDock: true, action: { type: 'share' } },
	settings: { icon: 'settings.png', inDock: true },
	bin: { icon: 'bin.png', inDock: false },
};

/** Dock 왼쪽 영역에 표시할 앱 (APP_NAMES 순서) */
export const DOCK_APPS = APP_NAMES.filter((name) => APP_MANIFEST[name].inDock);
