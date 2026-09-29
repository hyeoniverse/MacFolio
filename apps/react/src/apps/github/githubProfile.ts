// GitHub 앱에 보여 줄 프로필. https://github.com/hyeoniverse (2026-09-28 기준)을 옮겨 적었다.
// 방문자마다 GitHub API를 부르지 않도록(요청 제한) 고정 데이터로 두고, 통계 카드만 프로필 저장소가 매일 새로 만든 이미지를 쓴다.

export const GITHUB_PROFILE = {
	login: 'hyeoniverse',
	name: 'KIMJEONGHYEON',
	url: 'https://github.com/hyeoniverse',
	avatar: 'https://avatars.githubusercontent.com/u/68999618?v=4',
	bio: '🧑‍💻 Frontend Focused FullStack Developer | React & Next.js enthusiast :: 프론트엔드 집중 풀스택 개발자, React와 Next.js를 좋아합니다.',
	location: 'Seoul',
	website: 'https://www.hyeoniverse.com/',
	followers: 3,
	following: 4,
	repositories: 15,
} as const;

/** 프로필 README (hyeoniverse/hyeoniverse) */
export const README = {
	banner: { title: 'Hyeoniverse', subtitle: 'Frontend Focused Fullstack Developer' },
	about: [
		{ emoji: '🎨', title: 'Frontend', text: 'React · Next.js · TypeScript로 인터랙티브한 UI 구축' },
		{ emoji: '⚙️', title: 'Backend', text: '화면에 필요한 API와 데이터 구조는 Node.js · MySQL · Supabase로 직접 설계' },
		{
			emoji: '✨',
			title: 'Interaction',
			text: 'GSAP · Framer Motion · Three.js로 스크롤과 마우스에 반응하는 경험 실험 중',
		},
		{ emoji: '🤖', title: 'AI', text: 'AI API를 서비스 안에 자연스럽게 녹여내는 방법에 관심' },
		{ emoji: '🚀', title: 'Principle', text: '성능과 접근성은 옵션이 아니라 설계 단계의 기본' },
	],
	now: [
		{ emoji: '🔭', label: 'Building', text: 'Next.js · Supabase로 만드는 개인 포트폴리오 & 블로그' },
		{ emoji: '🌱', label: 'Learning', text: '디자인 시스템 · 웹 성능 최적화 · AI 서비스 통합' },
		{ emoji: '💬', label: 'Ask me about', text: 'React · Next.js · TypeScript · 인터랙션 애니메이션' },
		{ emoji: '📍', label: 'Based in', text: 'Seoul, South Korea 🇰🇷' },
	],
	/** skillicons.dev에서 받아 둔 아이콘 (public/imgs/github/skills.svg) */
	stackImage: '/imgs/github/skills.svg',
	stackAlt: 'React, Next.js, TypeScript, JavaScript, TailwindCSS, Node.js, Express, MySQL, Supabase, Firebase',
	stackSummary: 'React · Next.js · TypeScript · TailwindCSS · Zustand | Node.js · Express · MySQL · Supabase',
	contact: [
		{ label: 'Gmail', icon: 'fa-solid fa-envelope', color: '#EA4335', href: 'mailto:hyeoniverse.dev@gmail.com' },
		{ label: 'Portfolio', icon: 'fa-solid fa-globe', color: '#D40063', href: 'https://www.hyeoniverse.com/' },
		{ label: 'solved.ac', icon: 'fa-solid fa-code', color: '#17CE3A', href: 'https://solved.ac/hyeoniverse' },
	],
} as const;

/** 프로필 저장소의 GitHub Actions가 매일 새로 만드는 통계 카드 */
const STATS_BASE = 'https://raw.githubusercontent.com/hyeoniverse/hyeoniverse/main/profile';
export const statsCard = (name: 'stats' | 'top-langs', theme: 'light' | 'dark') => `${STATS_BASE}/${name}-${theme}.svg`;

export interface PinnedRepo {
	owner: string;
	name: string;
	description: string | null;
	url: string;
	homepage?: string;
	language: string;
	stars: number;
	forks: number;
}

/** GitHub 언어 색 */
export const LANGUAGE_COLORS: Record<string, string> = {
	TypeScript: '#3178c6',
	JavaScript: '#f1e05a',
};

/** 프로필에 고정한 저장소 (GitHub 순서) */
export const PINNED_REPOS: PinnedRepo[] = [
	{
		owner: 'Devcourse-NewPick',
		name: 'front',
		description: 'A code repository designed to show the best GitHub has to offer.',
		url: 'https://github.com/Devcourse-NewPick/front',
		homepage: 'https://newpick-tan.vercel.app',
		language: 'TypeScript',
		stars: 0,
		forks: 0,
	},
	{
		owner: 'Devcourse-WhatToDo',
		name: 'todo-front',
		description: null,
		url: 'https://github.com/Devcourse-WhatToDo/todo-front',
		language: 'JavaScript',
		stars: 0,
		forks: 1,
	},
	{
		owner: 'hyeoniverse',
		name: 'QRU',
		description:
			'QRU는 “QR” + “Who Are You”를 결합한 말로, 사용자가 자신의 정보를 입력하여 QR 코드를 생성하고 이를 통해 디지털 명함을 공유할 수 있는 웹 애플리케이션입니다.',
		url: 'https://github.com/hyeoniverse/QRU',
		language: 'TypeScript',
		stars: 0,
		forks: 0,
	},
	{
		owner: 'hyeoniverse',
		name: 'SproutFarm',
		description: null,
		url: 'https://github.com/hyeoniverse/SproutFarm',
		homepage: 'https://sprout-farm-beta.vercel.app',
		language: 'JavaScript',
		stars: 0,
		forks: 0,
	},
	{
		owner: 'hyeoniverse',
		name: 'DevCourse-FullStack',
		description: '타입스크립트로 함께하는 웹 풀 사이클 개발(React, Node.js) 4기_5회차',
		url: 'https://github.com/hyeoniverse/DevCourse-FullStack',
		language: 'JavaScript',
		stars: 0,
		forks: 0,
	},
];
