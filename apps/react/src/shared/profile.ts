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

export interface Project {
	id: string;
	name: string;
	/** 한 줄 소개 */
	description: string;
	/** 어떤 프로젝트인지 (팀·과정 등) */
	context: string;
	/** 맡은 일 (팀 프로젝트) */
	role?: string;
	stack: string[];
	/** 주요 기능 (저장소 README에서) */
	features: string[];
	/** GitHub의 주 언어 */
	language: string;
	/** GitHub 저장소 */
	url: string;
	/** 실제로 써 볼 수 있는 주소 */
	demo?: string;
	/** 화면 캡처 (public/imgs/projects) */
	image: string;
}

/**
 * 프로젝트. GitHub 프로필에 고정한 저장소와 같은 순서다 (apps/github/githubProfile.ts의 PINNED_REPOS).
 * Safari(포트폴리오), 터미널 projects, 단축어가 함께 쓴다.
 */
export const PROJECTS: Project[] = [
	{
		id: 'newpick',
		name: 'NewPick 뉴픽',
		description: '관심사에 맞춰 AI가 요약한 뉴스를 매일 아침 메일로 보내 주는 맞춤형 뉴스레터 서비스',
		context: '프로그래머스 데브코스 팀 프로젝트 (2인)',
		role: '기획, 유저 인증, API 연동',
		stack: ['Next.js', 'TypeScript', 'Zustand', 'React Query', 'styled-components', 'OpenAI API'],
		features: [
			'관심사(카테고리)를 고르면 그 분야 뉴스만 골라 보여준다',
			'최신 뉴스를 모아 OpenAI API로 요약한 뉴스레터를 만든다',
			'구독한 사람에게 매일 오전 8시 요약 뉴스레터를 메일로 보낸다',
			'구독한 카테고리에 맞춘 개인화 추천, 구독·취소 관리',
		],
		language: 'TypeScript',
		url: 'https://github.com/Devcourse-NewPick/front',
		demo: 'https://newpick-tan.vercel.app',
		image: '/imgs/projects/newpick.jpg',
	},
	{
		id: 'whattodo',
		name: 'WTD (What To Do)',
		description: '할 일과 세부 할 일을 끌어서 정리하고, 매일 반복되는 일은 루틴으로 관리하는 할 일 관리 웹 앱',
		context: '프로그래머스 데브코스 팀 프로젝트',
		stack: ['React', 'styled-components', 'Tailwind CSS', 'react-beautiful-dnd', 'Node.js', 'Express'],
		features: [
			'할 일(Task)과 세부 할 일(SubTask)을 추가·수정·삭제한다',
			'할 일과 세부 할 일의 순서를 끌어서 바꾼다',
			'매일 반복되는 일은 루틴으로 등록하면 정한 요일·시간에 초기화된다',
			'회원가입 없이도 브라우저 저장소로 기본 기능을 쓸 수 있다',
		],
		language: 'JavaScript',
		url: 'https://github.com/Devcourse-WhatToDo/todo-front',
		demo: 'https://what-to-do-chi.vercel.app/',
		image: '/imgs/projects/whattodo.jpg',
	},
	{
		id: 'qru',
		name: 'QRU 큐알유',
		description: '내 정보를 담은 QR 디지털 명함을 만들어 공유하고, 공개된 명함을 셔플로 찾아보는 웹 앱',
		context: '개인 프로젝트',
		stack: ['React', 'TypeScript', 'Redux Toolkit', 'React Query', 'styled-components', 'Firebase'],
		features: [
			'이름·MBTI·취미 등을 입력하고 사진 위치·크기를 맞춰 명함을 만든다',
			'명함마다 고유 주소·QR 코드(PNG 저장)·일련번호로 공유한다',
			'공개된 명함을 무작위 다섯 장씩 셔플로 보고, 조건·검색어로 좁힌다',
			'항목별 공개 설정. 비공개 항목은 공개 문서에 아예 저장하지 않는다',
			'로그인 없이 만들고, 나중에 Google 로그인하면 같은 명함이 계정으로 옮겨진다',
		],
		language: 'TypeScript',
		url: 'https://github.com/hyeoniverse/QRU',
		demo: 'https://qryou-app.web.app',
		image: '/imgs/projects/qru.jpg',
	},
	{
		id: 'sproutfarm',
		name: 'SproutFarm 새싹 농장',
		description: '도망친 동물 20마리를 자정 전에 울타리로 데려오는 탑다운 2D 픽셀 캐주얼 게임',
		context: '개인 프로젝트 (PC 전용)',
		stack: ['Unity 6', 'C#', 'WebGL', 'Vercel'],
		features: [
			'방향키로 움직이고 Shift로 달리며, 도망친 동물을 잡아 울타리에 넣는다',
			'체력·열매·잠자기·흙길 등 시간과 체력을 관리하는 규칙',
			'시간이 흐르면 노을·밤으로 화면 색이 바뀐다',
			'점수 공식과 TOP 10 랭킹 (이름을 넣어 기록)',
		],
		language: 'JavaScript',
		url: 'https://github.com/hyeoniverse/SproutFarm',
		demo: 'https://sprout-farm-beta.vercel.app',
		image: '/imgs/projects/sproutfarm.jpg',
	},
	{
		id: 'devcourse',
		name: 'DevCourse FullStack',
		description: '타입스크립트로 함께하는 웹 풀 사이클 개발(React, Node.js) 과정의 강의 노트와 실습 기록',
		context: '프로그래머스 데브코스 4기 학습 기록',
		stack: ['TypeScript', 'React', 'Node.js', 'Express', 'MySQL'],
		features: [
			'주차별 강의 수강·노트 진행 상황을 표로 기록한다',
			'Express 라우팅, Sequelize 모델 등 실습·예제 코드',
			'커밋 컨벤션(feat, fix, practice, example 등)으로 기록을 정리한다',
		],
		language: 'JavaScript',
		url: 'https://github.com/hyeoniverse/DevCourse-FullStack',
		image: '/imgs/projects/devcourse.jpg',
	},
];
