// 앱 목록의 단일 출처. React에 의존하지 않는 정보만 둔다.
// 컴포넌트 연결은 registry.tsx에서 한다. 프로젝트 앱은 shared/profile.ts의 PROJECTS에서 만든다.
import { PROJECTS, type Project, type ProjectAppInfo } from '@/shared/profile';

/** 이 사이트에 들어 있는 앱 (프로젝트 앱은 아래에서 PROJECTS로 만든다) */
const BUILTIN_APP_NAMES = [
	'finder',
	'music',
	'safari',
	'photos',
	'messages',
	'memo',
	'github',
	'mail',
	'share',
	'terminal',
	'settings',
	'passwords',
	'bin',
] as const;

export type BuiltinAppName = (typeof BUILTIN_APP_NAMES)[number];

declare const projectApp: unique symbol;
/** 프로젝트 앱의 이름 = 그 프로젝트의 id. 목록은 PROJECTS가 정하므로 문자열에 표시만 붙여 내장 앱과 구별한다 */
export type ProjectAppName = string & { readonly [projectApp]: true };

export type AppName = BuiltinAppName | ProjectAppName;

/** 데모를 창으로 띄우는 프로젝트 (shared/profile.ts의 app, PROJECTS 순서) */
export const PROJECT_APPS = PROJECTS.filter((project): project is Project & { app: ProjectAppInfo; demo: string } =>
	Boolean(project.app && project.demo)
);

/** 프로젝트 id가 앱이면 그 앱 이름 */
export const projectAppName = (id: string): ProjectAppName | null =>
	PROJECT_APPS.some((project) => project.id === id) ? (id as ProjectAppName) : null;

/**
 * 모든 앱. 프로젝트 앱은 시스템 설정 다음에 PROJECTS 순서로 둔다. Dock은 화면 폭에 들어가지 않는 뒤쪽 앱을
 * Launchpad로 보내므로, 창이 좁으면 공유·터미널·시스템 설정 대신 프로젝트 앱이 먼저 Launchpad로 간다
 */
export const APP_NAMES: AppName[] = [
	...BUILTIN_APP_NAMES.slice(0, BUILTIN_APP_NAMES.indexOf('settings') + 1),
	...PROJECT_APPS.map((project) => project.id as ProjectAppName),
	...BUILTIN_APP_NAMES.slice(BUILTIN_APP_NAMES.indexOf('settings') + 1),
];

export interface AppManifest {
	/** 화면에 보여줄 이름 (터미널 open 명령에서도 쓴다) */
	label: string;
	/** 아이콘 파일 이름 (env.imageUrl 기준) */
	icon: string;
	/** Dock 왼쪽 영역에 표시할지 여부. bin은 오른쪽에 따로 표시한다. */
	inDock: boolean;
	/** Dock에 고정하지 않고 Launchpad에 늘 두는 앱 (실행 중에는 Dock에도 나타난다) */
	inLaunchpad?: boolean;
	/** 처음 화면에 들어왔을 때 실행 중인 상태로 시작할지 여부 */
	runningAtStart?: boolean;
	/** Dock 아이콘의 둥근 모서리를 없앨지 여부 */
	squareIcon?: boolean;
	/** 처음 열 때 창 크기. 없으면 화면 크기에 맞춘 기본값 (desktop/window/geometry.ts) */
	windowSize?: { width: number; height: number };
	/** 모바일에서 다른 이름·아이콘으로 보여줄 때 (휴대폰에 더 어울리는 앱으로 바꿔 보여준다) */
	mobile?: { label: string; icon: string };
	/** 창을 여는 대신 실행할 동작 */
	action?: { type: 'link'; url: string } | { type: 'share' };
}

const BUILTIN_MANIFEST: Record<BuiltinAppName, AppManifest> = {
	// 사이트의 문서·프로젝트·블로그 글·앱을 파일처럼 둘러본다. 휴대폰에서는 iOS처럼 '파일'
	finder: {
		label: 'Finder',
		icon: 'finder.png',
		inDock: true,
		mobile: { label: '파일', icon: 'finder.png' },
		windowSize: { width: 820, height: 520 },
	},
	music: { label: '음악', icon: 'music.png', inDock: true, windowSize: { width: 960, height: 600 } },
	safari: { label: 'Safari', icon: 'safari.png', inDock: true, runningAtStart: true },
	photos: { label: '사진', icon: 'photos.png', inDock: true },
	messages: { label: '메시지', icon: 'messages.png', inDock: true, windowSize: { width: 860, height: 560 } },
	memo: { label: '메모', icon: 'memo.png', inDock: true, windowSize: { width: 900, height: 600 } },
	github: { label: 'GitHub', icon: 'github.png', inDock: true },
	mail: { label: '메일', icon: 'mail.png', inDock: true, windowSize: { width: 900, height: 560 } },
	share: { label: '공유', icon: 'share.svg', inDock: true, action: { type: 'share' } },
	// 휴대폰 키보드로 명령어를 치기는 불편해서, 모바일에서는 같은 명령을 눌러서 실행하는 '단축어'로 보여준다
	terminal: {
		label: '터미널',
		icon: 'terminal.svg',
		inDock: true,
		mobile: { label: '단축어', icon: 'shortcuts.svg' },
		windowSize: { width: 596, height: 420 },
	},
	settings: { label: '시스템 설정', icon: 'settings.png', inDock: true },
	// 관리자 로그인 (iOS 암호 앱 모양). 데스크톱에서는 Apple 메뉴와 시스템 설정에서 같은 일을 하므로 Dock에 두지 않는다
	passwords: { label: '암호', icon: 'passwords.svg', inDock: false, windowSize: { width: 560, height: 520 } },
	bin: { label: '휴지통', icon: 'bin.png', inDock: false },
};

/**
 * 앱마다의 정보. 프로젝트 앱은 배포한 사이트를 창 안에 띄운다 (apps/project/ProjectApp.tsx). Safari의 프로젝트 페이지에서도 연다.
 * Dock에 고정한다 (화면 폭에 다 들어가지 않으면 뒤쪽 앱은 Launchpad로 간다). app.inDock이 false면 Launchpad에 두고 실행 중에만 Dock에 나타난다
 */
export const APP_MANIFEST = {
	...BUILTIN_MANIFEST,
	...Object.fromEntries(
		PROJECT_APPS.map(({ id, app }) => [
			id,
			{
				label: app.label,
				icon: app.icon,
				inDock: app.inDock !== false,
				inLaunchpad: app.inDock === false,
				windowSize: app.windowSize,
			} satisfies AppManifest,
		])
	),
} as Record<AppName, AppManifest>;

/** Dock 왼쪽 영역에 표시할 앱 (APP_NAMES 순서) */
export const DOCK_APPS = APP_NAMES.filter((name) => APP_MANIFEST[name].inDock);

/** Launchpad에 늘 있는 앱 (APP_NAMES 순서) */
export const LAUNCHPAD_APPS = APP_NAMES.filter((name) => APP_MANIFEST[name].inLaunchpad);
