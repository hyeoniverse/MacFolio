// 이력서의 내용 가운데 프로젝트 데이터에 없는 것: 한 줄 소개, 강점, 할 수 있는 일, 프로젝트마다 고른 성과, 수상·자격, 교육.
// 프로젝트의 이름·기간·구분·기술은 PROJECTS에서 읽으므로, 프로젝트를 고치면 이력서도 함께 바뀐다 (apps/finder/resumeDoc.ts).

export interface ResumeEntry {
	title: string;
	detail?: string;
	period: string;
}

export interface ResumeContent {
	/** 이름 아래 한 줄 소개 */
	motto: string;
	/** 직함 */
	role: string;
	/** 첫머리의 강점 세 가지: 제목과 근거 한 줄 */
	strengths: { title: string; detail: string }[];
	/** 할 수 있는 일: 분야, 한 줄, 쓰는 기술 */
	capabilities: { area: string; detail: string; tools: string[] }[];
	/** 크게 보여 줄 프로젝트 (PROJECTS의 id)와 고른 성과. 이 순서대로 */
	featured: { id: string; bullets: { title: string; detail: string }[] }[];
	/** 한 줄로만 보여 줄 프로젝트 */
	minor: { id: string; line: string }[];
	awards: ResumeEntry[];
	education: ResumeEntry[];
}

export const RESUME: ResumeContent = {
	motto: '화면에서 서버까지, 끝까지 만들고 운영하는 개발자',
	role: '웹 개발자 · 프론트엔드 중심 풀스택',
	strengths: [
		{ title: '끝까지 운영', detail: '기획·디자인부터 서버·배포까지 1인 개발한 서비스 2개를 실제 도메인에서 운영' },
		{ title: '검증된 코드만 배포', detail: 'PR마다 타입 검사·테스트·e2e·보안 스캔을 통과해야 배포되는 파이프라인' },
		{ title: '보안 전공 배경', detail: '정보보호학과 출신, DB 권한 정책·IP 익명화로 데이터 노출을 미리 차단' },
	],
	capabilities: [
		{
			area: '화면 개발',
			detail: '상태가 많은 화면을 컴포넌트·훅 단위로 나눠 만들고, 서버 상태와 전역 상태를 분리해 관리합니다.',
			tools: ['React', 'TypeScript', 'Next.js', 'React Query', 'Zustand', 'Redux Toolkit', 'TailwindCSS'],
		},
		{
			area: '디자인 시스템',
			detail: '디자인 토큰과 린트 규칙으로 모든 앱의 스타일을 하나의 체계로 유지합니다.',
			tools: ['CSS 변수 토큰', 'Stylelint'],
		},
		{
			area: '인터랙션',
			detail: '스크롤 애니메이션, 창 끌기 같은 직접 조작 UI, 3D·게임 화면을 구현합니다.',
			tools: ['GSAP', 'Framer Motion', 'Three.js', 'Unity(C#)'],
		},
		{
			area: 'API · 데이터',
			detail: 'REST API·DB 스키마를 설계하고, OAuth 로그인과 세션 권한 확인을 서버에서 처리합니다.',
			tools: ['NestJS', 'Express', 'PostgreSQL', 'Supabase', 'Firebase'],
		},
		{
			area: '테스트 · 배포',
			detail: '단위·e2e 테스트를 PR마다 돌리고, 통과한 커밋만 자동 배포하는 파이프라인을 만듭니다.',
			tools: ['Vitest', 'Playwright', 'GitHub Actions', 'Cloudflare Workers', 'pnpm + Turborepo'],
		},
	],
	featured: [
		{
			id: 'macfolio',
			bullets: [
				{
					title: '창 관리와 반응형 셸',
					detail: '창 끌기·크기 조절·Dock이 있는 데스크톱, 휴대폰에서는 같은 앱이 iOS 홈 화면으로 전환',
				},
				{
					title: '보는 화면이 곧 편집기',
					detail: '관리자가 로그인하면 글이 그 자리에서 편집기가 되어, 별도 CMS 없이 블로그 운영',
				},
				{
					title: '서버 비용 0원',
					detail: 'NestJS·PostgreSQL을 무료 VM에 올리고, Cloudflare Tunnel로 포트를 열지 않고 공개',
				},
				{
					title: '안전한 관리자 인증',
					detail: 'GitHub OAuth로 관리자 한 명만 허용, 세션은 해시로만 저장하고 요청마다 서버가 권한 확인',
				},
			],
		},
		{
			id: 'hyeoniverse',
			bullets: [
				{
					title: '빠르고 접근성 좋은 화면',
					detail: 'Lighthouse 성능 97점, 접근성·SEO 100점, LCP 0.7초',
				},
				{
					title: 'DB가 지키는 권한',
					detail: '소유자·관리자·저자·방문자 4단계를 RLS 정책 29개로 판정하고, 방문 IP는 90일 뒤 자동 익명화',
				},
				{
					title: '무료 한도 안에서 AI 운영',
					detail: '기능마다 AI 공급자를 갈아 끼우고, 실패하거나 무료 한도에 닿으면 다음 공급자로 자동 전환',
				},
			],
		},
		{
			id: 'newpick',
			bullets: [
				{
					title: '로그인·인증 담당',
					detail: '보호 경로 그룹으로 마이페이지 접근 관리, 페이지 성격에 따라 서버·클라이언트 렌더링 분리',
				},
				{
					title: '가입 전 체험',
					detail: '로그인 없이 관심사 하나로 AI 뉴스레터를 바로 받아 보는 흐름으로 가입 문턱을 낮춤',
				},
			],
		},
		{
			id: 'qru',
			bullets: [
				{
					title: '서버 없이 데이터 보호',
					detail: 'Firestore 보안 규칙으로 저장 필드를 제한하고, 비공개 항목은 공개 문서에 저장하지 않음',
				},
				{ title: '복합 색인 0개', detail: '범위 질의를 "같음" 조건으로 바꿔 단일 필드 색인만으로 검색 처리' },
			],
		},
	],
	minor: [
		{ id: 'whattodo', line: '비회원 데이터를 로그인 시 bulk API로 서버에 옮기는 동기화와 낙관적 업데이트' },
		{ id: 'sproutfarm', line: '절차적 무한 맵, A* 경로 탐색 동물 AI, 조작할 수 없는 Redis 랭킹' },
	],
	awards: [
		{
			title: '2023 프로보노 공모전 동상 · 과학기술정보통신부',
			detail: '시각장애인을 위한 AI 음성 인식 키오스크',
			period: '2023.12',
		},
		{
			title: '졸업 프로젝트 평가회 우수상 · 서울여대 정보보호학과',
			detail: '온라인 시험 부정행위 탐지 서비스, 2023 춘계학술대회 논문 게재',
			period: '2022.12',
		},
		{ title: '정보처리기사 · 한국산업인력공단', period: '2024.06' },
		{ title: 'TOEIC 775점 · ETS', period: '2026.09' },
	],
	education: [
		{
			title: '프로그래머스 데브코스 4기 · 웹 풀 사이클 개발',
			detail: 'React · TypeScript · Node.js, 875시간',
			period: '2024.08 – 2025.02',
		},
		{
			title: '서울여자대학교',
			detail: '정보보호학과 전공 · 소프트웨어융합학과 복수전공 · 학점 3.9 / 4.5',
			period: '2020.03 – 2025.02',
		},
	],
};
