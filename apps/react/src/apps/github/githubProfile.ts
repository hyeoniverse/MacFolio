// GitHub 앱에 보여 줄 프로필·README·저장소. 값은 API 서버가 GitHub에서 받아 둔 것(/github/profile)을 쓰고,
// 서버가 없거나 닿지 않을 때는 아래 스냅샷을 보여 준다. 스냅샷의 고정 저장소는 따로 적지 않고 프로젝트 목록(PROJECTS)에서 만든다.
import { PROJECTS, type Project } from '@/shared/profile';

export interface GithubProfile {
	login: string;
	name: string | null;
	avatarUrl: string;
	bio: string | null;
	location: string | null;
	website: string | null;
	url: string;
	followers: number;
	following: number;
	publicRepos: number;
}

export interface RepoCard {
	/** owner/이름 */
	fullName: string;
	owner: string;
	name: string;
	description: string | null;
	url: string;
	homepage: string | null;
	language: string | null;
	stars: number;
	forks: number;
	fork: boolean;
}

export interface GithubData {
	profile: GithubProfile;
	/** 프로필 README (Markdown·HTML). 없으면 null */
	readme: string | null;
	/** README 안의 상대 주소(./profile/stats-light.svg)를 풀 기준 주소 */
	readmeBaseUrl: string;
	repos: RepoCard[];
}

/** 프로젝트를 고정 저장소 카드로. 설명은 프로젝트 소개 한 줄, 홈페이지는 데모 주소 */
export const projectRepo = (project: Project): RepoCard => {
	const fullName = project.url.replace('https://github.com/', '');
	const [owner, name] = fullName.split('/');
	return {
		fullName,
		owner,
		name,
		description: project.description,
		url: project.url,
		homepage: project.demo ?? null,
		language: project.language,
		stars: 0,
		forks: 0,
		fork: false,
	};
};

/** 프로필 README (hyeoniverse/hyeoniverse의 README.md) */
const README_SNAPSHOT = `<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=soft&color=0:A8004E,50:D40063,100:F74D96&height=180&text=Hyeoniverse&fontSize=56&fontColor=ffffff&fontAlignY=42&desc=Frontend%20Focused%20Fullstack%20Developer&descSize=18&descAlignY=68&animation=fadeIn" width="100%" alt="Hyeoniverse">
</div>

<br>

## 👋 About Me

- 🎨 **Frontend** — React · Next.js · TypeScript로 인터랙티브한 UI 구축
- ⚙️ **Backend** — 화면에 필요한 API와 데이터 구조는 Node.js · MySQL · Supabase로 직접 설계
- ✨ **Interaction** — GSAP · Framer Motion · Three.js로 스크롤과 마우스에 반응하는 경험 실험 중
- 🤖 **AI** — AI API를 서비스 안에 자연스럽게 녹여내는 방법에 관심
- 🚀 **Principle** — 성능과 접근성은 옵션이 아니라 설계 단계의 기본

<br>

<table>
  <tr>
    <td>🔭</td>
    <td><strong>Building</strong></td>
    <td>Next.js · Supabase로 만드는 개인 포트폴리오 &amp; 블로그</td>
  </tr>
  <tr>
    <td>🌱</td>
    <td><strong>Learning</strong></td>
    <td>디자인 시스템 · 웹 성능 최적화 · AI 서비스 통합</td>
  </tr>
  <tr>
    <td>💬</td>
    <td><strong>Ask me about</strong></td>
    <td>React · Next.js · TypeScript · 인터랙션 애니메이션</td>
  </tr>
  <tr>
    <td>📍</td>
    <td><strong>Based in</strong></td>
    <td>Seoul, South Korea 🇰🇷</td>
  </tr>
</table>

<br>

## 🛠 Tech Stack

<div align="center">
  <a href="https://skillicons.dev">
    <img src="https://skillicons.dev/icons?i=react,nextjs,ts,js,tailwind,nodejs,express,mysql,supabase,firebase&perline=10" alt="React, Next.js, TypeScript, JavaScript, TailwindCSS, Node.js, Express, MySQL, Supabase, Firebase">
  </a>
  <br><br>
  <sub>React · Next.js · TypeScript · TailwindCSS · Zustand &nbsp;|&nbsp; Node.js · Express · MySQL · Supabase</sub>
</div>

<br>

## 📊 GitHub Stats

<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./profile/stats-dark.svg">
    <img src="./profile/stats-light.svg" width="49%" alt="GitHub Stats">
  </picture>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./profile/top-langs-dark.svg">
    <img src="./profile/top-langs-light.svg" width="41%" alt="Top Languages">
  </picture>
  <br><br>
  <img src="https://komarev.com/ghpvc/?username=hyeoniverse&color=D40063&style=flat-square&label=Profile+Views" alt="Profile Views">
</div>

<br>

## 📬 Contact

<div align="center">
  <a href="mailto:hyeoniverse.dev@gmail.com">
    <img src="https://img.shields.io/badge/Gmail-EA4335?style=for-the-badge&logo=gmail&logoColor=white" alt="Gmail">
  </a>&nbsp;
  <a href="https://www.hyeoniverse.com/">
    <img src="https://img.shields.io/badge/Portfolio-D40063?style=for-the-badge&logo=google-chrome&logoColor=white" alt="Portfolio">
  </a>&nbsp;
  <a href="https://solved.ac/hyeoniverse">
    <img src="https://img.shields.io/badge/solved.ac-17CE3A?style=for-the-badge&logo=baekjoon&logoColor=white" alt="solved.ac">
  </a>
</div>

<br>

<div align="center">
  <sub>Thanks for stopping by ✨</sub>
</div>
`;

/** 서버에 닿지 않을 때 보여 줄 값. 프로필은 https://github.com/hyeoniverse를 2026-10-03에 옮겨 적었다 */
export const GITHUB_SNAPSHOT: GithubData = {
	profile: {
		login: 'hyeoniverse',
		name: 'KIMJEONGHYEON',
		avatarUrl: 'https://avatars.githubusercontent.com/u/68999618?v=4',
		bio: '🧑‍💻 Frontend Focused FullStack Developer | React & Next.js enthusiast :: 프론트엔드 집중 풀스택 개발자, React와 Next.js를 좋아합니다.',
		location: 'Seoul',
		website: 'https://www.hyeoniverse.com/',
		url: 'https://github.com/hyeoniverse',
		followers: 3,
		following: 4,
		publicRepos: 15,
	},
	readme: README_SNAPSHOT,
	readmeBaseUrl: 'https://raw.githubusercontent.com/hyeoniverse/hyeoniverse/HEAD/',
	repos: PROJECTS.map(projectRepo),
};

/** GitHub 언어 색 (github-linguist) */
export const LANGUAGE_COLORS: Record<string, string> = {
	TypeScript: '#3178c6',
	JavaScript: '#f1e05a',
	HTML: '#e34c26',
	CSS: '#663399',
	SCSS: '#c6538c',
	Python: '#3572A5',
	Java: '#b07219',
	Kotlin: '#A97BFF',
	Swift: '#F05138',
	Go: '#00ADD8',
	Rust: '#dea584',
	C: '#555555',
	'C++': '#f34b7d',
	'C#': '#178600',
	Ruby: '#701516',
	PHP: '#4F5D95',
	Dart: '#00B4AB',
	Shell: '#89e051',
	Vue: '#41b883',
	Svelte: '#ff3e00',
	Astro: '#ff5a03',
	MDX: '#fcb32c',
	'Jupyter Notebook': '#DA5B0B',
};
