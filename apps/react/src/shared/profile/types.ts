// 프로젝트 하나의 모양. 값은 projects/ 아래 프로젝트마다 한 파일

/** 큰 글씨로 보여줄 숫자 한 줄 (예: 6주 / 개발 기간) */
export interface ProjectFact {
	value: string;
	label: string;
}

/** 제목과 설명 한 덩어리 */
export interface ProjectPoint {
	title: string;
	body: string;
	/** 펼쳐 읽을 때 더 보여 줄 설명 */
	detail?: string;
	/** 곁들일 그림 (public/imgs/projects/{id}/…) */
	image?: string;
	/** 같은 화면의 다크 테마 그림: 있으면 밀대로 라이트와 나눠 비교한다 */
	imageDark?: string;
	/** 스크롤 장면: 페이지를 스크롤하는 만큼 차례로 넘어가는 화면들 (위에서 아래로 내려가며 찍은 캡처) */
	scrollFrames?: string[];
	/** 그림 대신 보여 줄 짧은 영상 (화면에 보일 때만 재생) */
	video?: string;
	/** 갈래 여러 개 (예: 레이아웃 여섯 가지): 이름과 한 줄 설명. 그림이 없으면 갈래마다 움직이는 도식으로 그린다 */
	variants?: { label: string; note: string }[];
	/** 그림 대신 직접 만져 보는 데모 (슬라이드 갤러리, 음성 만들기, 파형 편집, 문서 변환, 번역, AI 요약, AI 커버) */
	demo?:
		| 'slides'
		| 'voice'
		| 'wave'
		| 'convert'
		| 'translate'
		| 'summary'
		| 'cover'
		| 'autosave'
		| 'lifecycle'
		| 'comments'
		| 'mailbox'
		| 'invite'
		| 'roles'
		| 'kitchen'
		| 'providers';
	/** 데모 아래나 글 옆에 붙일 실제 화면 여러 장 (.mp4는 화면에 보일 때만 도는 영상) */
	shots?: { src: string; alt: string }[];
	/** 카드에 붙일 아이콘 (Font Awesome 이름, 예: fa-lock) */
	icon?: string;
	/** 같은 장 안에서 묶는 이름 (예: 쓰기, 운영): 묶음마다 큰 칸 하나와 작은 칸들로 짠다 */
	group?: string;
}

/** 테마 하나를 이루는 다섯 색 (강조색, 라이트·다크의 바탕과 글자) */
export interface ThemeSwatch {
	name: string;
	accent: string;
	lightBg: string;
	lightText: string;
	darkBg: string;
	darkText: string;
}

/** 주요 기능과 만든 방식 말고 더 들려줄 이야기 한 장 (예: 관리자 화면, 테마, 성능) */
export interface ProjectChapter {
	title: string;
	/** 장 첫머리의 한두 문장 */
	lead?: string;
	/** 이 장에서 내세울 숫자 */
	facts?: ProjectFact[];
	points: ProjectPoint[];
	/** 장 끝에 둘 그림 (public/imgs/projects/{id}/…). dark가 있으면 밀대로 라이트와 나눠 비교한다 */
	image?: { src: string; alt: string; dark?: string };
	/** 전후 비교: 화면에 들어오면 막대가 전에서 후로 줄어든다 */
	compare?: { label: string; before: number; after: number; unit: string }[];
	/**
	 * 장 모양 (글 묶음의 짜임): showcase 항목을 고르면 큰 화면이 바뀜, stage 데모마다 큰 무대, bento 크기가 다른 타일,
	 * dashboard 숫자 타일과 큰 화면, gauges 점수 고리와 번호 목록, shield 겹겹이 쌓인 방어, palette 작은 타일. 없으면 두 칸 글 묶음
	 */
	look?: 'showcase' | 'stage' | 'bento' | 'dashboard' | 'gauges' | 'shield' | 'palette' | 'architecture';
	/** 테마 프리셋: 고르면 미리보기 화면의 색이 그 테마로 바뀐다 */
	palette?: ThemeSwatch[];
	/** 데이터베이스 구조: 문서(테이블) 경로, 누가 읽는지, 필드, 한 줄 설명. parent가 있으면 그 문서의 하위 문서 */
	schema?: { path: string; access: string; fields: string[]; note: string; parent?: string; locked?: boolean }[];
}

/**
 * 프로젝트 페이지 모양. 모양마다 페이지의 짜임과 읽는 순서가 다르다 (apps/safari/project/).
 * editorial 신문 1면(뉴스레터), playful 칸반 보드(할 일), minimal 명함 앞뒤와 단계(명함), game 타이틀 화면부터 크레딧까지(게임),
 * terminal 명령과 결과가 이어지는 터미널(학습 기록), product Apple 제품 페이지(이 사이트), creative 붙어 있는 차례와 장(포트폴리오)
 */
export type ProjectLook = 'editorial' | 'playful' | 'minimal' | 'game' | 'terminal' | 'product' | 'creative';

/** 프로젝트 앱의 모양 (Project.app) */
export interface ProjectAppInfo {
	/** Dock·Launchpad에 보일 짧은 이름 */
	label: string;
	/** 아이콘 (env.imageUrl 기준 경로, 예: projects/newpick/app-icon.png) */
	icon: string;
	/** Dock에 고정하지 않으려면 false (Launchpad에 두고 실행 중에만 Dock에 나타난다). 기본은 고정 */
	inDock?: boolean;
	/** 게임이면 "여기서 플레이", 아니면 "여기서 열기" */
	play?: boolean;
	/** 사이트가 뜨기 전 창 바탕 (게임은 검은 화면) */
	tone?: 'light' | 'dark';
	/**
	 * 사이트가 맨 위 색을 알려 주기 전까지(postMessage, shared/ui/web-frame/WebFrame.tsx의 BAR_COLOR_MESSAGE) 상태 표시줄 뒤에 칠할 색.
	 * 다른 도메인의 페이지라 iframe 안을 직접 읽을 수 없다. 사이트가 색을 보내면 그 색을 따른다
	 */
	barColor?: string;
	/** 처음 열 때 창 크기 */
	windowSize?: { width: number; height: number };
}

export interface Project {
	id: string;
	name: string;
	look: ProjectLook;
	/** 페이지 첫머리의 큰 제목 */
	tagline: string;
	/** 한 줄 소개 */
	description: string;
	/** 어떤 프로젝트인지 (팀·과정 등) */
	context: string;
	/** 맡은 일 한 줄 (팀 프로젝트) */
	role?: string;
	/** 개발 기간 */
	period?: string;
	/** 한눈에 보는 숫자 */
	facts: ProjectFact[];
	/** 주요 기능 (저장소 README에서) */
	highlights: ProjectPoint[];
	/** 어떻게 만들었는지: 구현에서 신경 쓴 점 */
	build: ProjectPoint[];
	/** 더 들려줄 이야기: 모양마다 그 페이지에 맞는 꼴로 그린다 */
	chapters?: ProjectChapter[];
	/** 내가 한 일 */
	contributions: string[];
	/** 진행 과정 (날짜, 한 일) */
	timeline?: { date: string; label: string }[];
	/** 쓰는 법: 상황마다 (예: 가입 없이, 로그인하면) */
	usage?: ProjectPoint[];
	/** 폴더 구조 (저장소 README의 트리) */
	structure?: string;
	/** 화면 모음 (차례대로 넘겨 본다) */
	gallery?: { src: string; caption: string }[];
	/** 빌려 쓴 에셋·글꼴 출처: 맡은 부분, 이름, 만든 사람, 주소, 한 줄 설명 */
	credits?: { role: string; name: string; by: string; href?: string; note?: string }[];
	/** 기술 사양: 분류별 기술 */
	specs: { label: string; value: string }[];
	/** 기술 이름만 (터미널 등 짧게 보여줄 때) */
	stack: string[];
	/** GitHub의 주 언어 */
	language: string;
	/** GitHub 저장소 */
	url: string;
	/** 실제로 써 볼 수 있는 주소 */
	demo?: string;
	/** 앱 아이콘 (public/imgs/projects/{id}/icon.png). 없으면 기본 모양을 쓴다 */
	icon?: string;
	/**
	 * 이 사이트 안에서 데모를 창으로 띄우는 앱 (apps/project/ProjectApp.tsx). 있으면 앱 목록(apps/manifest.ts)에 이 id로
	 * 들어가 Launchpad·터미널 open·Safari의 "여기서 열기"에 나온다. 데모 주소(demo)가 있어야 한다
	 */
	app?: ProjectAppInfo;
	/** 주요 기능 위에 둘 그림 (public/imgs/projects/{id}/scene.png) */
	art?: string;
	/** 글자 로고 (public/imgs/projects/{id}/logo.png) */
	logo?: string;
	/** 화면 캡처 (public/imgs/projects/{id}/screenshot.jpg) */
	image: string;
	/** 게임 조작법 */
	controls?: { keys: string[]; label: string }[];
	/** 첫 화면 터미널에 보일 줄. '$ '로 시작하면 명령 */
	terminal?: string[];
	/** 커밋 컨벤션 (타입, 설명) */
	conventions?: { type: string; description: string }[];
}
