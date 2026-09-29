// 사이트 주인의 프로필과 프로젝트. 여러 앱(GitHub, 터미널 등)이 함께 쓰는 단일 출처.

export const PROFILE = {
	name: '김정현',
	nameEn: 'Kim Jeong Hyeon',
	role: 'Frontend Focused Fullstack Developer',
	school: '서울여자대학교',
	location: 'Seoul, South Korea',
	github: 'https://github.com/hyeoniverse',
	email: 'hyeoniverse.dev@gmail.com',
} as const;

/** 다룰 수 있는 기술 (GitHub 프로필 README의 Tech Stack) */
export const SKILLS = {
	frontend: ['React', 'Next.js', 'TypeScript', 'JavaScript', 'TailwindCSS', 'Zustand'],
	backend: ['Node.js', 'Express', 'MySQL', 'Supabase', 'Firebase'],
	interaction: ['GSAP', 'Framer Motion', 'Three.js'],
} as const;

/** 이 사이트(MacFolio)를 만든 기술 */
export const SITE_STACK = [
	'React 19',
	'TypeScript',
	'Vite',
	'pnpm workspaces + Turborepo',
	'Vitest, Playwright',
	'Cloudflare Workers',
] as const;

/** 큰 글씨로 보여줄 숫자 한 줄 (예: 6주 / 개발 기간) */
export interface ProjectFact {
	value: string;
	label: string;
}

/** 제목과 설명 한 덩어리 */
export interface ProjectPoint {
	title: string;
	body: string;
}

export interface Project {
	id: string;
	name: string;
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
	/** 내가 한 일 */
	contributions: string[];
	/** 진행 과정 (날짜, 한 일) */
	timeline?: { date: string; label: string }[];
	/** 앞으로 할 일 */
	next?: string[];
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
	/** 화면 캡처 (public/imgs/projects/{id}/screenshot.jpg) */
	image: string;
}

const projectImage = (id: string, file: string) => `/imgs/projects/${id}/${file}`;

/**
 * 프로젝트. GitHub 프로필에 고정한 저장소와 같은 순서다 (apps/github/githubProfile.ts의 PINNED_REPOS).
 * Safari(포트폴리오), 터미널 projects, 단축어가 함께 쓴다. 내용은 각 저장소 README를 따른다.
 */
export const PROJECTS: Project[] = [
	{
		id: 'newpick',
		name: 'NewPick 뉴픽',
		tagline: '아침 뉴스, 요약해서 한 통에.',
		description: '관심사에 맞춰 AI가 요약한 뉴스를 매일 아침 메일로 보내 주는 맞춤형 뉴스레터 서비스',
		context: '프로그래머스 데브코스 팀 프로젝트 (2인)',
		role: '기획, 유저 인증, API 연동',
		period: '2024.12.26 – 2025.02.05',
		facts: [
			{ value: '6주', label: '기획부터 배포까지' },
			{ value: '2명', label: '팀 프로젝트' },
			{ value: '오전 8시', label: '매일 뉴스레터 발송' },
		],
		highlights: [
			{
				title: 'AI 뉴스 요약',
				body: '최신 뉴스를 모은 뒤 OpenAI API로 핵심만 추려 읽기 좋은 뉴스레터로 만듭니다.',
			},
			{
				title: '카테고리별 뉴스',
				body: '관심 있는 분야를 고르면 그 분야의 뉴스만 모아서 볼 수 있습니다.',
			},
			{
				title: '매일 아침 메일로',
				body: '구독한 사람에게 매일 오전 8시, 요약한 뉴스레터를 메일로 보냅니다.',
			},
			{
				title: '나에게 맞춘 추천',
				body: '구독한 카테고리에 맞춰 뉴스레터를 추천하고, 구독과 취소도 직접 관리합니다.',
			},
		],
		build: [
			{
				title: 'Next.js App Router',
				body: '페이지 성격에 따라 서버 렌더링과 클라이언트 렌더링을 나눴습니다. 마이페이지는 (protected) 경로로 묶어 로그인한 사람만 들어옵니다.',
			},
			{
				title: '상태를 둘로 나눠서',
				body: '서버에서 받아 오는 데이터는 React Query로, 화면 전체가 함께 쓰는 값은 Zustand로 관리했습니다.',
			},
			{
				title: 'API 연동과 에러 처리',
				body: '백엔드 API를 fetch 모듈로 모아 두고 화면과 연결했습니다. 배포 직전에는 Vercel에서 나온 오류를 잡으며 마무리했습니다.',
			},
		],
		contributions: ['주제 선정과 기획, 기능 정의', '로그인·회원 인증 흐름과 보호된 페이지', '뉴스레터·구독 API 연동'],
		timeline: [
			{ date: '12.26', label: '주제 선정과 기획' },
			{ date: '12.28', label: '기능 정의, 와이어프레임, 디자인' },
			{ date: '01.04', label: 'Next.js 초기 셋팅, 공통 컴포넌트' },
			{ date: '01.08', label: 'UI 설계' },
			{ date: '01.21', label: 'API 연동' },
			{ date: '02.01', label: 'Vercel 배포와 에러 처리' },
		],
		specs: [
			{ label: '프레임워크', value: 'Next.js (SSR · CSR), TypeScript' },
			{ label: '상태 관리', value: 'Zustand, React Query' },
			{ label: '스타일', value: 'styled-components' },
			{ label: 'AI', value: 'OpenAI API' },
			{ label: '배포', value: 'Vercel' },
			{ label: '협업', value: 'GitHub, Notion' },
		],
		stack: ['Next.js', 'TypeScript', 'Zustand', 'React Query', 'styled-components', 'OpenAI API'],
		language: 'TypeScript',
		url: 'https://github.com/Devcourse-NewPick/front',
		demo: 'https://newpick-tan.vercel.app',
		icon: projectImage('newpick', 'icon.png'),
		image: projectImage('newpick', 'screenshot.jpg'),
	},
	{
		id: 'whattodo',
		name: 'WTD (What To Do)',
		tagline: '할 일은 끌어서. 루틴은 알아서.',
		description: '할 일과 세부 할 일을 끌어서 정리하고, 매일 반복되는 일은 루틴으로 관리하는 할 일 관리 웹 앱',
		context: '프로그래머스 데브코스 팀 프로젝트 (4인)',
		role: '백엔드 연동, 드래그 앤 드롭',
		facts: [
			{ value: '4명', label: '팀 프로젝트' },
			{ value: '2단계', label: '할 일과 세부 할 일' },
			{ value: '0단계', label: '가입 없이 바로 쓰기' },
		],
		highlights: [
			{
				title: '할 일과 세부 할 일',
				body: '할 일(Task) 안에 세부 할 일(SubTask)을 두고 추가·수정·삭제합니다. 체크한 할 일은 대시보드에 보입니다.',
			},
			{
				title: '끌어서 순서 바꾸기',
				body: '할 일 카드는 좌우로, 세부 할 일은 위아래로 끌어서 순서를 바꿉니다.',
			},
			{
				title: '완료한 일은 보관함으로',
				body: '끝낸 세부 할 일은 보관함에 들어가고, 토글을 열어 다시 볼 수 있습니다.',
			},
			{
				title: '루틴',
				body: '매일 반복되는 일을 루틴으로 등록하면 정한 요일과 시간에 상태가 초기화됩니다.',
			},
		],
		build: [
			{
				title: '가입 없이도',
				body: '로그인하지 않으면 브라우저 로컬 스토리지에 저장해 기본 기능을 쓰고, 로그인하면 서버에 저장하고 루틴을 씁니다.',
			},
			{
				title: 'API는 한곳에서',
				body: 'Axios 호출을 api 모듈에 모으고 Context로 상태를 나눠 쓰며, 통신 오류를 처리하고 데이터를 유지했습니다.',
			},
			{
				title: '자연스러운 드래그',
				body: 'react-beautiful-dnd로 Task와 SubTask를 각각 끌 수 있게 하고, 놓는 위치와 움직임을 다듬었습니다.',
			},
		],
		contributions: [
			'Axios로 백엔드와 통신하고 Context로 상태 관리, API 오류 처리',
			'화면 컴포넌트 배치',
			'react-beautiful-dnd로 Task·SubTask 순서 바꾸기와 드래그 경험 다듬기',
			'README 작성',
		],
		specs: [
			{ label: '프론트엔드', value: 'React, JavaScript' },
			{ label: '스타일', value: 'Tailwind CSS' },
			{ label: '상태 관리', value: 'React Context API' },
			{ label: '드래그 앤 드롭', value: 'react-beautiful-dnd' },
			{ label: '백엔드 통신', value: 'Axios (Node.js · Express 서버)' },
			{ label: '배포', value: 'Vercel' },
		],
		stack: ['React', 'Tailwind CSS', 'Context API', 'react-beautiful-dnd', 'Axios', 'Node.js', 'Express'],
		language: 'JavaScript',
		url: 'https://github.com/Devcourse-WhatToDo/todo-front',
		demo: 'https://what-to-do-chi.vercel.app/',
		icon: projectImage('whattodo', 'icon.png'),
		image: projectImage('whattodo', 'screenshot.jpg'),
	},
	{
		id: 'qru',
		name: 'QRU 큐알유',
		tagline: 'QR 한 장에 담은 나.',
		description: '내 정보를 담은 QR 디지털 명함을 만들어 공유하고, 공개된 명함을 셔플로 찾아보는 웹 앱',
		context: '개인 프로젝트',
		role: '기획·설계, 프론트엔드, Firebase 연동과 보안 규칙',
		facts: [
			{ value: '1인', label: '기획부터 배포까지' },
			{ value: '5장', label: '셔플 한 번에 보는 명함' },
			{ value: '0개', label: '외워야 할 비밀번호' },
		],
		highlights: [
			{
				title: '명함 만들기',
				body: '한 줄 소개, MBTI, 취미 등을 채우고 항목을 5개까지 더합니다. 사진은 위치와 크기를 직접 맞춥니다.',
			},
			{
				title: '주소, QR, 일련번호',
				body: '명함마다 고유 주소와 QR 코드(PNG 저장), 옮겨 적기 쉬운 일련번호가 나옵니다. 번호로 명함을 찾을 수도 있습니다.',
			},
			{
				title: '셔플로 찾기',
				body: '공개된 명함에서 무작위로 다섯 장을 보여 줍니다. 성별·MBTI 같은 조건과 검색어로 좁힙니다.',
			},
			{
				title: '항목별 공개 설정',
				body: '비공개로 둔 항목은 화면에서 숨기는 게 아니라, 공개 문서에 아예 저장하지 않습니다.',
			},
		],
		build: [
			{
				title: '가입 없이, 나중에 계정으로',
				body: 'Firebase 익명 인증으로 로그인 없이 명함을 만들고, 나중에 Google 로그인하면 계정을 연결해 같은 명함을 그대로 옮깁니다.',
			},
			{
				title: '규칙으로 지키는 데이터',
				body: 'Firestore 보안 규칙에서 저장할 수 있는 필드를 hasOnly로 제한하고, 조회는 동등 조건만 써서 복합 색인 없이 돌아가게 했습니다.',
			},
			{
				title: '검색엔진에는 안 보이게',
				body: '명함·찾기·마이페이지는 noindex 헤더와 메타 태그로 검색 결과에 실리지 않고, 주소를 아는 사람만 봅니다.',
			},
			{
				title: 'PR마다 미리보기',
				body: 'GitHub Actions가 main을 Firebase Hosting에 배포하고, PR에는 미리보기 채널과 Playwright 스크린샷을 붙입니다.',
			},
		],
		contributions: [
			'서비스 기획과 데이터 구조 설계',
			'프론트엔드 전체',
			'Firebase 인증·Firestore·Hosting 연동과 보안 규칙',
			'배포 자동화',
		],
		next: [
			'비회원 명함의 수명: 만료 시각을 두고 지울지 정하기',
			'App Check나 서버 검증으로 비회원 명함 대량 생성 막기',
			'cards와 guestCards 컬렉션 하나로 합치기',
		],
		specs: [
			{ label: '프론트엔드', value: 'React 18, TypeScript, Vite, React Router v7' },
			{ label: '상태 관리', value: 'Redux Toolkit, React Query' },
			{ label: '스타일', value: 'styled-components, 다크·라이트 테마, 반응형' },
			{ label: '백엔드', value: 'Firebase Firestore, Authentication (Google, 익명)' },
			{ label: 'QR', value: 'qrcode.react' },
			{ label: '배포', value: 'Firebase Hosting, GitHub Actions, Playwright' },
		],
		stack: ['React', 'TypeScript', 'Redux Toolkit', 'React Query', 'styled-components', 'Firebase'],
		language: 'TypeScript',
		url: 'https://github.com/hyeoniverse/QRU',
		demo: 'https://qryou-app.web.app',
		icon: projectImage('qru', 'icon.png'),
		image: projectImage('qru', 'screenshot.jpg'),
	},
	{
		id: 'sproutfarm',
		name: 'SproutFarm 새싹 농장',
		tagline: '자정까지, 스무 마리.',
		description: '도망친 동물 20마리를 자정 전에 울타리로 데려오는 탑다운 2D 픽셀 캐주얼 게임',
		context: '개인 프로젝트 (PC 전용)',
		period: '2024.06.10 – 2024.06.24',
		facts: [
			{ value: '20마리', label: '자정 전에 데려올 동물' },
			{ value: '약 18분', label: '한 판 (게임 1분 = 1.2초)' },
			{ value: 'TOP 10', label: '서버에서 다시 계산하는 랭킹' },
		],
		highlights: [
			{
				title: '잡아서 울타리로',
				body: '방향키로 움직이고 Shift로 달립니다. 도망친 동물을 잡으면 따라오고, Space로 울타리에 넣습니다.',
			},
			{
				title: '체력과 시간',
				body: '달릴수록 빨리 지치고, 열매를 먹거나 집에서 자면 회복합니다. 흙길에서는 덜 지치고 1.25배 빨라집니다.',
			},
			{
				title: '끝없는 들판',
				body: '숲, 바위밭, 꽃밭, 과수원, 연못, 빈터가 이어지는 들판. 같은 곳에 다시 가면 같은 풍경이 나옵니다.',
			},
			{
				title: '노을, 그리고 밤',
				body: '시간이 흐르면 화면이 노을빛을 지나 어두워지고, 체력이 떨어지면 나침반이 집을 가리킵니다.',
			},
		],
		build: [
			{
				title: '무한 맵',
				body: '20×20칸 타일맵 4개가 플레이어를 따라다닙니다. 경계를 넘으면 가장 먼 덩어리를 진행 방향으로 40칸 옮겨 붙입니다.',
			},
			{
				title: '절차적 지형',
				body: '플레이어 주위를 12칸 구역으로 나눠 구역 위치로 풍경을 정하고, 24칸 간격으로 구불구불한 흙길을 냅니다.',
			},
			{
				title: 'A* 동물 AI',
				body: 'A* 길찾기로 장애물을 피해 도망치고 따라옵니다. 흩어질 자리는 플레이어가 실제로 걸어갈 수 있는 곳만 고릅니다.',
			},
			{
				title: '조작할 수 없는 랭킹',
				body: '서버리스 함수가 점수가 아닌 기록을 받아 범위를 자르고 직접 점수를 계산해 Redis에 저장합니다.',
			},
		],
		contributions: ['게임 기획과 규칙, 점수 공식', 'Unity C# 스크립트 전체', 'WebGL 빌드와 Vercel 배포, 랭킹 서버'],
		specs: [
			{ label: '엔진', value: 'Unity 6, C#' },
			{ label: '렌더링', value: 'URP 2D Renderer, Y축 기준 정렬' },
			{ label: '맵', value: 'Tilemap, Rule Tile (47조각 블롭), 런타임 절차적 생성' },
			{ label: 'AI', value: 'A* Pathfinding Project (Grid Graph)' },
			{ label: '입력 · UI', value: 'Input System, uGUI, TextMeshPro' },
			{ label: '배포', value: 'WebGL (Brotli 압축), Vercel' },
			{ label: '서버', value: 'Vercel 서버리스 함수, Redis' },
		],
		stack: ['Unity 6', 'C#', 'WebGL', 'Vercel', 'Redis'],
		language: 'JavaScript',
		url: 'https://github.com/hyeoniverse/SproutFarm',
		demo: 'https://sprout-farm-beta.vercel.app',
		icon: projectImage('sproutfarm', 'icon.png'),
		image: projectImage('sproutfarm', 'screenshot.jpg'),
	},
	{
		id: 'devcourse',
		name: 'DevCourse FullStack',
		tagline: '배운 것은 전부, 커밋으로.',
		description: '타입스크립트로 함께하는 웹 풀 사이클 개발(React, Node.js) 과정의 강의 노트와 실습 기록',
		context: '프로그래머스 데브코스 4기 학습 기록',
		period: '2024.08.12 –',
		facts: [
			{ value: '4기', label: '프로그래머스 데브코스' },
			{ value: '주차별', label: '강의·노트 진행 기록' },
			{ value: '11가지', label: '커밋 타입으로 정리' },
		],
		highlights: [
			{
				title: '주차별 기록',
				body: '주마다 들은 강의와 정리한 노트를 표로 남겨, 어디까지 왔는지 한눈에 봅니다.',
			},
			{
				title: '실습과 예제',
				body: 'Express 라우팅, 데이터베이스 모델 등 강의를 따라 만든 실습과 예제 코드를 모았습니다.',
			},
			{
				title: '커밋 컨벤션',
				body: 'feat, fix, docs 외에 practice, example, project 타입을 더해 기록의 성격을 구분했습니다.',
			},
		],
		build: [
			{
				title: '프론트엔드부터 백엔드까지',
				body: 'TypeScript, React로 화면을 만들고 Node.js, Express, MySQL로 서버를 만드는 풀 사이클 과정을 따라갔습니다.',
			},
		],
		contributions: ['강의 노트 정리', '실습·예제 코드 작성', '커밋 컨벤션 설계'],
		specs: [
			{ label: '언어', value: 'TypeScript, JavaScript' },
			{ label: '프론트엔드', value: 'React' },
			{ label: '백엔드', value: 'Node.js, Express, MySQL' },
		],
		stack: ['TypeScript', 'React', 'Node.js', 'Express', 'MySQL'],
		language: 'JavaScript',
		url: 'https://github.com/hyeoniverse/DevCourse-FullStack',
		image: projectImage('devcourse', 'screenshot.jpg'),
	},
];
