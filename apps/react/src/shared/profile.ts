// 사이트 주인의 프로필과 프로젝트. 여러 앱(GitHub, 터미널 등)이 함께 쓰는 단일 출처.

export const PROFILE = {
	name: '김정현',
	nameEn: 'Kim Jeong Hyeon',
	role: 'App Developer | Frontend Enthusiast',
	school: '서울여자대학교',
	location: 'Seoul, South Korea',
	github: 'https://github.com/hyeoniverse',
} as const;

/** GitHub 프로필의 기술 배지 */
export const SKILLS = {
	languages: ['Swift', 'Python', 'Java', 'C#', 'JavaScript', 'HTML5', 'CSS3'],
	data: ['MySQL', 'Firebase'],
	tools: ['GitHub', 'Notion'],
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
	project: string;
	name: string;
	description: string;
	language: string;
	languageColor?: string;
	url: string;
}

/** GitHub 앱의 고정 저장소, 터미널의 projects 명령이 함께 쓴다 */
export const PROJECTS: Project[] = [
	{
		id: '1',
		project: '서울여자대학교 소프트웨어융합학과 졸업 프로젝트',
		name: 'PurrFectDay.',
		description: '꾸미기 게임과 투두리스트를 결합한 iOS 앱',
		language: 'Swift',
		languageColor: '#F05138',
		url: 'https://github.com/PurrFectDay/PurrFectDay.',
	},
	{
		id: '2',
		project: '서울여자대학교 컴퓨터그래픽스 기말 프로젝트',
		name: 'Sprout Farm',
		description: 'Unity를 이용한 미니 게임',
		language: 'C#',
		languageColor: '#178600',
		url: 'https://github.com/hyeoniverse/SproutFarm',
	},
	{
		id: '3',
		project: 'ICT 멘토링 공모전',
		name: 'VOA',
		description: '동상 수상 - AI를 활용한 시각장애인을 위한 키오스크 프로그램',
		language: 'Python',
		languageColor: '#3572A5',
		url: 'https://github.com/2023-ICT-Kiosks/VOA',
	},
	{
		id: '4',
		project: '2023-GDSC-SWU',
		name: 'ChatBuddy',
		description: 'ChatGPT를 활용한 심리 상담 Android 앱',
		language: 'Java',
		languageColor: '#B07219',
		url: 'https://github.com/GDG-SWU/2023-ChatBuddy-SolutionChallenge',
	},
	{
		id: '5',
		project: '서울여자대학교 정보보호학과 졸업 프로젝트',
		name: 'Chaseye',
		description: 'AI(Mediapipe)와 시스템 분석을 이용한 부정행위 감지 프로그램',
		language: 'Python',
		languageColor: '#3572A5',
		url: 'https://github.com/hyeoniverse/BOSWU',
	},
];
