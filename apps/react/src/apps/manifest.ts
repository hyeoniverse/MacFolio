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
	'notion',
	'mail',
	'share',
	'terminal',
	'settings',
	'bin',
] as const;

export type AppName = (typeof APP_NAMES)[number];

export interface AppManifest {
	/** 화면에 보여줄 이름 (터미널 open 명령에서도 쓴다) */
	label: string;
	/** 아이콘 파일 이름 (env.imageUrl 기준) */
	icon: string;
	/** Dock 왼쪽 영역에 표시할지 여부. bin은 오른쪽에 따로 표시한다. */
	inDock: boolean;
	/** 처음 화면에 들어왔을 때 실행 중인 상태로 시작할지 여부 */
	runningAtStart?: boolean;
	/** Dock 아이콘의 둥근 모서리를 없앨지 여부 */
	squareIcon?: boolean;
	/** 처음 열 때 창 크기. 없으면 화면 크기에 맞춘 기본값 (desktop/window/geometry.ts) */
	windowSize?: { width: number; height: number };
	/** 창을 여는 대신 실행할 동작 */
	action?: { type: 'link'; url: string } | { type: 'share' };
}

export const APP_MANIFEST: Record<AppName, AppManifest> = {
	finder: { label: 'Finder', icon: 'finder.png', inDock: true, runningAtStart: true },
	music: { label: '음악', icon: 'music.png', inDock: true, runningAtStart: true },
	safari: { label: 'Safari', icon: 'safari.png', inDock: true, runningAtStart: true },
	photos: { label: '사진', icon: 'photos.png', inDock: true },
	messages: { label: '메시지', icon: 'messages.png', inDock: true, windowSize: { width: 860, height: 560 } },
	memo: { label: '메모', icon: 'memo.png', inDock: true, windowSize: { width: 900, height: 600 } },
	github: { label: 'GitHub', icon: 'github.png', inDock: true },
	notion: {
		label: 'Notion',
		icon: 'notion.png',
		inDock: true,
		squareIcon: true,
		action: {
			type: 'link',
			url: 'https://calico-octave-0a0.notion.site/62b2692248d045bdb1796368054b3ac2?pvs=74',
		},
	},
	mail: { label: '메일', icon: 'mail.png', inDock: true, windowSize: { width: 900, height: 560 } },
	share: { label: '공유', icon: 'share.png', inDock: true, action: { type: 'share' } },
	terminal: { label: '터미널', icon: 'terminal.svg', inDock: true, windowSize: { width: 596, height: 420 } },
	settings: { label: '시스템 설정', icon: 'settings.png', inDock: true },
	bin: { label: '휴지통', icon: 'bin.png', inDock: false },
};

/** Dock 왼쪽 영역에 표시할 앱 (APP_NAMES 순서) */
export const DOCK_APPS = APP_NAMES.filter((name) => APP_MANIFEST[name].inDock);
