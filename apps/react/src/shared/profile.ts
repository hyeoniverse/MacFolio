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
	/** 그림 대신 직접 만져 보는 데모 (슬라이드 갤러리, 음성 만들기, 파형 편집, 문서 변환, 번역, AI 요약) */
	demo?: 'slides' | 'voice' | 'wave' | 'convert' | 'translate' | 'summary';
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

const projectImage = (id: string, file: string) => `/imgs/projects/${id}/${file}`;

/**
 * 프로젝트. 프로젝트를 더하거나 빼는 곳은 여기 한 곳이다.
 * Safari 탭, Finder의 프로젝트 폴더, 터미널 projects와 단축어, GitHub 앱의 스냅샷(서버에 닿지 않을 때의 고정 저장소)이
 * 모두 이 목록을 이 순서대로 쓴다. 내용은 각 저장소 README를 따른다.
 */
export const PROJECTS: Project[] = [
	{
		id: 'newpick',
		name: 'NewPick 뉴픽',
		look: 'editorial',
		tagline: '아침 뉴스, 요약해서 한 통에.',
		description: '관심사에 맞춰 AI가 요약한 뉴스를 매일 아침 메일로 보내 주는 맞춤형 뉴스레터 서비스',
		context: '프로그래머스 데브코스 팀 프로젝트 (5인: 프론트엔드 2, 백엔드 3)',
		role: '기획, 로그인과 인증, 구독·AI 체험·목록 API 연동',
		period: '2024.12.26 – 2025.02.05',
		facts: [
			{ value: '6주', label: '기획부터 배포까지' },
			{ value: '5명', label: '프론트엔드 2 · 백엔드 3' },
			{ value: '오전 8시', label: '매일 뉴스레터 발송' },
		],
		highlights: [
			{
				title: 'AI 뉴스 요약',
				body: '최신 뉴스를 모은 뒤 OpenAI API로 핵심만 추려 읽기 좋은 뉴스레터로 만듭니다.',
				detail:
					'요약과 발송은 백엔드가 맡고, 프론트는 요약된 뉴스레터를 목록과 상세 화면에 보여 줍니다. 상세 화면에는 본문과 함께 요약에 쓴 원문 뉴스, 인기·최신 뉴스레터, 이전·다음 글, 북마크와 링크 복사가 붙습니다.',
				image: projectImage('newpick', 'shots/summary.jpg'),
			},
			{
				title: '카테고리별 뉴스',
				body: '관심 있는 분야를 고르면 그 분야의 뉴스만 모아서 볼 수 있습니다.',
				detail:
					'IT, 정치, 경제, 사회, 생활, 세계 여섯 분야와 전체로 나눕니다. 목록은 끝에 닿으면 다음 묶음을 불러오고, 최신순·북마크순·조회수순으로 정렬하며, 분야를 바꾸면 최신순으로 돌아갑니다.',
				image: projectImage('newpick', 'shots/categories.jpg'),
			},
			{
				title: '매일 아침 메일로',
				body: '구독한 사람에게 매일 오전 8시, 요약한 뉴스레터를 메일로 보냅니다.',
				detail:
					'구독을 시작하면 내일부터 보내 준다는 안내가 뜨고, 다음 날 아침부터 메일이 옵니다. 마이페이지의 내 뉴스레터 탭에서는 오전 8시를 기준으로 그날 받은 뉴스레터를 분야별로 다시 봅니다.',
				image: projectImage('newpick', 'shots/mail.jpg'),
			},
			{
				title: '나에게 맞춘 추천',
				body: '구독한 카테고리에 맞춰 뉴스레터를 추천하고, 구독과 취소도 직접 관리합니다.',
				detail:
					'마이페이지 설정 탭에서 관심 분야를 고르고 약관에 동의하면 구독이 시작됩니다. 해지를 누르면 관련 정보가 모두 지워진다는 확인 창을 한 번 더 띄우고, 구독하지 않은 사람이 기사에서 구독 단추를 누르면 이 탭으로 데려갑니다.',
				image: projectImage('newpick', 'shots/subscribe.jpg'),
			},
			{
				title: '가입 전에 체험',
				body: '로그인하지 않아도 관심사 하나를 고르면 그 자리에서 AI 뉴스레터를 만들어 모달로 보여 줍니다.',
				detail:
					'어제 날짜의 뉴스로 요약을 요청합니다. AI가 돌려준 HTML에서 코드 블록 표시를 걷어 내고, DOMPurify로 위험한 태그를 거른 뒤에 화면에 그립니다.',
			},
			{
				title: '요약에 쓴 원문까지',
				body: '뉴스레터 아래에 요약에 쓴 원문 기사를 출처와 날짜가 적힌 카드로 붙이고, 누르면 새 탭에서 엽니다.',
				detail:
					'원문 주소로 미리보기 정보(제목, 그림, 출처)를 받아 카드로 그립니다. 카드 컴포넌트는 필요할 때 불러와 첫 화면을 가볍게 둡니다.',
			},
		],
		build: [
			{
				title: 'Next.js App Router',
				body: '페이지 성격에 따라 서버 렌더링과 클라이언트 렌더링을 나눴습니다. 마이페이지는 (protected) 경로 그룹으로 묶고, 그곳에서 로그아웃하면 홈으로 돌려보냅니다.',
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
		chapters: [
			{
				title: '로그인과 첫 화면',
				lead: '새로고침해도 로그인이 풀리지 않고, 첫 화면이 깜빡이지 않게 하는 데 시간을 가장 많이 썼습니다.',
				points: [
					{
						title: '팝업에서 리다이렉트로',
						body: '처음에는 Google 로그인을 팝업 창과 postMessage로 처리했다가, 배포 직후 리다이렉트 방식으로 바꿨습니다. 돌아올 때 붙은 쿼리를 확인해 사용자 정보를 다시 받고, 주소에서는 지웁니다.',
					},
					{
						title: '첫 화면 데이터는 서버에서',
						body: '새로고침하면 로그인 상태가 초기화되고, 쿠키가 없으면 로딩이 끝나지 않았습니다. 로그인 사용자와 구독 상태, 오늘의 트렌드를 루트 레이아웃에서 서버가 먼저 받아 와 스토어에 넣는 구조로 정리했습니다.',
					},
					{
						title: '만료된 토큰은 한 번 더',
						body: '서버는 쿠키의 토큰으로 사용자를 조회하고, 만료됐으면 토큰을 갱신해 딱 한 번만 다시 시도합니다. 갱신에 실패하면 로그인하지 않은 상태로 그려, 끝없이 다시 묻지 않습니다.',
					},
					{
						title: '다크 모드와 Hydration',
						body: '테마는 브라우저에 저장해 새로고침해도 유지하고, 서버는 항상 라이트로 그려 첫 화면이 어긋나지 않게 했습니다. 링크 안의 버튼 같은 Hydration 오류를 다섯 번 따로 고쳤습니다.',
					},
				],
			},
			{
				title: '읽고 구독하기',
				points: [
					{
						title: '끝없이 이어지는 목록',
						body: '카테고리 목록은 끝에 닿으면 다음 뉴스레터를 불러옵니다. 최신순, 북마크순, 조회수순으로 정렬하고, 카테고리를 바꾸면 최신순으로 돌아갑니다.',
					},
					{
						title: '조회수',
						body: '상세 페이지를 열면 조회수를 올리고, 목록 카드에도 조회수를 보여 줍니다.',
					},
					{
						title: '구독 시작과 해지',
						body: '설정 탭에서 관심사를 고르고 약관에 동의하면 구독이 시작됩니다. 해지를 누르면 관련 정보가 모두 지워진다는 확인 창을 한 번 더 띄웁니다.',
					},
					{
						title: '구독으로 이어지는 단추',
						body: '구독하지 않은 사람이 기사에서 구독 단추를 누르면 마이페이지의 설정 탭으로 바로 데려갑니다.',
					},
				],
			},
		],
		contributions: [
			'주제 선정과 기획, 기능 정의',
			'Google 로그인(팝업 → 리다이렉트), 로그인 유지와 토큰 재발급',
			'첫 화면 데이터를 서버에서 먼저 받아 오는 구조',
			'구독 시작·해지 API와 확인 모달',
			'AI 뉴스레터 체험과 원문 기사 카드',
			'카테고리 목록의 무한 스크롤·정렬, 조회수',
			'Skeleton·Toast·Modal 공통 컴포넌트와 다크 모드',
			'About 페이지 아래쪽과 팀원 소개',
		],
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
		logo: projectImage('newpick', 'logo.png'),
		image: projectImage('newpick', 'screenshot.jpg'),
	},
	{
		id: 'whattodo',
		name: 'WTD (What To Do)',
		look: 'playful',
		tagline: '할 일은 끌어서. 루틴은 알아서.',
		description: '할 일과 세부 할 일을 끌어서 정리하고, 매일 반복되는 일은 루틴으로 관리하는 할 일 관리 웹 앱',
		context: '프로그래머스 데브코스 팀 프로젝트 (4인)',
		role: '프로젝트 뼈대, 상태 관리, 인증과 동기화, 루틴, 드래그 앤 드롭',
		period: '2024.10.05 – 2024.10.19',
		facts: [
			{ value: '4명', label: '팀 프로젝트' },
			{ value: '94개', label: '전체 114개 커밋 중 내 커밋' },
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
				body: '로그인하지 않으면 브라우저 로컬 스토리지에 저장해 기본 기능을 쓰고, 로그인하면 서버에 저장하고 루틴을 씁니다. 저장 공간은 비회원과 회원별로 나눴습니다.',
			},
			{
				title: '기능별로 나눈 모듈',
				body: '할 일과 루틴 API를 taskApi와 routineApi로, 토큰과 저장 처리를 utils로 나누고, 상태는 Auth·Task·Routine 세 Context가 맡습니다.',
			},
			{
				title: '화면 먼저, 서버는 뒤에',
				body: '제목 수정, 체크, 삭제는 화면을 먼저 바꾸고, 로그인한 상태일 때만 서버에 보냅니다.',
			},
			{
				title: '자연스러운 드래그',
				body: 'react-beautiful-dnd로 Task와 SubTask를 각각 끌 수 있게 하고, 놓는 위치와 움직임을 다듬었습니다.',
			},
		],
		chapters: [
			{
				title: '로그인과 동기화',
				lead: '가입 없이 쓰던 할 일이 로그인한 뒤에도 그대로 남도록, 저장 공간과 옮기는 길을 따로 만들었습니다.',
				points: [
					{
						title: '비회원 할 일을 한 번에 옮기기',
						body: '로그인하면 비회원 목록을 /lists/bulk로 한 번에 보내고, 응답으로 받은 목록 id에 맞춰 세부 할 일을 /tasks/bulk로 보냅니다. 끝나면 로컬 데이터를 지우고 서버에서 다시 받아 옵니다.',
					},
					{
						title: '저장 공간을 둘로',
						body: '로컬 스토리지 키를 비회원은 guestTasks, 회원은 사용자마다 따로 둡니다. 로그아웃하면 이벤트를 보내 화면의 할 일을 비웁니다.',
					},
					{
						title: '토큰 만료와 401',
						body: 'Google 로그인에서 받은 토큰의 만료 시각을 읽어 지났으면 로그아웃합니다. 모든 API 함수는 같은 오류 처리를 거쳐, 401이면 다시 로그인하라는 확인 창을 띄웁니다.',
					},
				],
			},
			{
				title: '루틴',
				lead: '매일 반복하는 일은 정한 요일과 시간에 다시 할 일로 돌아옵니다.',
				points: [
					{
						title: '요일과 시간 고르기',
						body: '세부 할 일의 반복 아이콘을 누르면 시간과 월~일 요일 단추가 펼쳐집니다. 요일을 고르지 않으면 등록할 수 없고, 이미 루틴인 항목은 아이콘이 바뀌며 수정과 삭제가 나옵니다.',
					},
					{
						title: '1분마다 상태 확인',
						body: '로그인한 사용자는 다음 분이 시작될 때까지 기다린 뒤 60초마다 루틴을 조회해, 서버에 있는 완료 상태를 체크에 반영합니다. 처음엔 1초마다 시각을 검사하던 것을 바꿨습니다.',
					},
					{
						title: '로그인 안내와 중복 막기',
						body: '비회원이 루틴을 누르면 로그인 안내 모달을 띄웁니다. 같은 세부 할 일에 루틴을 두 번 등록하면 이미 등록된 루틴이라고 알립니다.',
					},
					{
						title: '입력 검사와 삭제 확인',
						body: '목록과 세부 할 일 제목은 15자까지 받습니다. 세부 할 일이 남은 목록을 지우면 몇 개가 함께 지워지는지 알리고 한 번 더 묻습니다.',
					},
				],
			},
		],
		contributions: [
			'프로젝트 뼈대와 화면 구성, 라우터',
			'Task·Routine Context로 상태 관리',
			'react-beautiful-dnd로 할 일·세부 할 일 끌어 옮기기',
			'Google 로그인, 토큰 만료와 401 처리',
			'비회원·회원 저장 공간 분리와 한꺼번에 옮기기',
			'루틴 추가·수정·삭제와 1분 주기 상태 확인',
			'입력 검사와 삭제 확인 창',
			'README 작성',
		],
		timeline: [
			{ date: '10.05', label: '기획과 첫 커밋' },
			{ date: '10.10', label: '공통 컴포넌트, 할 일 화면' },
			{ date: '10.14', label: '할 일 서랍과 카드' },
			{ date: '10.15', label: '할 일·세부 할 일 끌어서 옮기기' },
			{ date: '10.16', label: 'Google 로그인, 로컬 저장' },
			{ date: '10.17', label: '할 일 API 연동, 비회원 할 일 옮기기' },
			{ date: '10.18', label: '루틴, 만료된 로그인 처리, 정리' },
			{ date: '10.19', label: '마무리와 배포' },
		],
		usage: [
			{
				title: '가입 없이',
				body: '브라우저 로컬 스토리지에 저장합니다. 할 일과 세부 할 일을 만들고, 고치고, 끌어서 순서를 바꾸는 기본 기능을 바로 씁니다.',
			},
			{
				title: '로그인하면',
				body: 'Google로 로그인하면 서버에 저장하고, 비회원일 때 만든 할 일을 계정으로 옮깁니다. 매일 반복되는 일은 루틴으로 등록합니다.',
			},
		],
		structure: [
			'src/',
			'├── api/',
			'│   ├── taskApi.js        목록·할 일, 한꺼번에 옮기기',
			'│   └── routineApi.js     루틴',
			'├── components/',
			'│   ├── Auth/LoginForm.jsx',
			'│   ├── Common/           Button, InputCheck, InputField, Modal, Drawer',
			'│   └── Task/             TaskCard, TaskDashboard, TaskDrawer',
			'├── contexts/             AuthContext, TaskContext, RoutineContext',
			'├── utils/                authHelpers, localStorageHelpers, validationHelpers',
			'├── pages/TaskPage.jsx',
			'└── App.js',
		].join('\n'),
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
		look: 'minimal',
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
				body: '왼쪽 목차를 따라 한 줄 소개, MBTI, 취미 등을 채우고 항목을 5개까지 더합니다. 항목마다 공개할지 고르고, 비공개 항목은 공개 문서에 아예 저장하지 않습니다.',
				image: projectImage('qru', 'screens/create-modal.jpg'),
			},
			{
				title: '사진 맞추기',
				body: '원 안에서 사진의 위치와 크기를 직접 맞춥니다. 저장할 때는 긴 변 512px, 150KB 이하로 줄입니다.',
				image: projectImage('qru', 'screens/photo-editor.jpg'),
			},
			{
				title: '주소, QR, 일련번호',
				body: '명함마다 고유 주소와 QR 코드(PNG 저장), 일련번호가 나옵니다. 번호를 눌러 복사하고, 헤더 돋보기에 번호를 넣으면 그 명함으로 갑니다.',
				image: projectImage('qru', 'screens/card.jpg'),
			},
			{
				title: '셔플로 찾기',
				body: '공개된 명함에서 무작위로 다섯 장을 보여 줍니다. 성별·MBTI 같은 조건과 검색어로 좁히고, 방금 본 명함은 뒤로 미룹니다.',
				image: projectImage('qru', 'screens/shuffle.jpg'),
			},
			{
				title: '내 명함 관리',
				body: '만든 명함을 번호, 만든 날짜, 셔플 노출 여부와 함께 모아 보고, 고치거나 지웁니다. 다크 테마에서도 같은 명함을 봅니다.',
				image: projectImage('qru', 'screens/mypage.jpg'),
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
		chapters: [
			{
				title: '서버 없이 지키는 데이터',
				lead: '서버도 Cloud Functions도 없이, 브라우저가 Firestore에 직접 읽고 씁니다. 그래서 문서의 모양과 권한을 보안 규칙 하나가 모두 검사합니다.',
				facts: [
					{ value: '10자리', label: '일련번호 (32^10가지)' },
					{ value: '0개', label: '복합 색인' },
					{ value: '150KB', label: '사진 한 장의 상한' },
				],
				points: [
					{
						title: '목록을 열지 않는 길잡이',
						body: '보안 규칙은 질의에 담긴 값을 볼 수 없어 번호로 거르는 목록 조회를 열 수 없습니다. 번호 자체를 문서 id로 하는 길잡이 문서를 두고, 한 번 읽어 명함으로 찾아갑니다.',
					},
					{
						title: '복합 색인 0개',
						body: '처음에는 범위 질의를 써서 필터가 하나 늘 때마다 필요한 색인이 두 배로 늘었습니다. "같음" 조건만 쓰도록 바꿔 단일 필드 색인으로 처리하고, 색인 파일을 통째로 지웠습니다.',
					},
					{
						title: '보여 줄 값과 찾을 값',
						body: 'Firestore는 배열 안의 필드로 거를 수 없습니다. 순서와 라벨을 담은 표시용 배열과 별도로, 공백을 지우고 소문자로 맞춘 검색용 맵을 한 번 더 저장합니다.',
					},
					{
						title: '드롭다운은 값을, 색인은 라벨을',
						body: '필터가 하나도 걸리지 않은 적이 있습니다. 색인에는 "여성"이 들어 있는데 드롭다운은 "female"을 보냈기 때문입니다. 선택지의 값을 라벨로 맞춰 고쳤습니다.',
					},
					{
						title: '사진도 Firestore에',
						body: 'Storage 없이 줄인 사진을 데이터 URL로 저장하고, 규칙도 같은 상한으로 막습니다. 셔플이 후보를 한꺼번에 읽을 때 사진이 딸려 오지 않게 하위 문서로 떼어 둡니다.',
					},
					{
						title: '고쳐도 공유한 값은 그대로',
						body: '수정 규칙이 만든 시각, 번호, 소유자가 이전 값과 같은지 검사합니다. 그래서 이미 건넨 주소와 QR, 번호가 바뀌지 않고, 삭제하면 사진과 길잡이도 함께 지웁니다.',
					},
				],
				schema: [
					{
						path: 'cards/{id}',
						access: '누구나 읽기',
						fields: ['serialNumber', 'uid', 'createdAt', 'entries[]', 'search{}', 'inShuffle', 'hasPhoto'],
						note: '"공개"로 고른 항목만 들어갑니다. 비공개 항목은 숨기는 게 아니라 아예 저장하지 않습니다.',
					},
					{
						path: 'private/card',
						parent: 'cards/{id}',
						access: '소유자만',
						locked: true,
						fields: ['values{}', 'isPublic{}'],
						note: '수정 화면을 채울 입력 원본입니다.',
					},
					{
						path: 'photo/data',
						parent: 'cards/{id}',
						access: '누구나 읽기',
						fields: ['uid', 'dataUrl'],
						note: '셔플이 후보를 한꺼번에 읽을 때 사진이 딸려 오지 않게 떼어 둡니다.',
					},
					{
						path: 'serials/{번호}',
						access: '번호로 한 번 읽기',
						fields: ['collection', 'cardId', 'uid'],
						note: '일련번호 자체가 문서 id입니다. 목록 조회는 막혀 있고, 번호를 알아야 한 번 읽을 수 있습니다.',
					},
				],
			},
		],
		gallery: [
			{ src: projectImage('qru', 'screens/home.jpg'), caption: '첫 화면' },
			{ src: projectImage('qru', 'screens/card.jpg'), caption: '명함 보기' },
			{ src: projectImage('qru', 'screens/card-dark.jpg'), caption: '다크 테마' },
			{ src: projectImage('qru', 'screens/shuffle.jpg'), caption: '명함 찾기' },
			{ src: projectImage('qru', 'screens/mobile.jpg'), caption: '휴대폰에서' },
		],
		contributions: [
			'서비스 기획과 데이터 구조 설계',
			'프론트엔드 전체',
			'Firebase 인증·Firestore·Hosting 연동과 보안 규칙',
			'배포 자동화',
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
		look: 'game',
		controls: [
			{ keys: ['↑', '↓', '←', '→'], label: '움직이기' },
			{ keys: ['Shift'], label: '달리기' },
			{ keys: ['Space'], label: '대화 넘기기, 울타리에 넣기, 잠자기' },
		],
		tagline: '농장에 작은 소동이 생겼어요. 얼른 잡아주세요!',
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
				image: projectImage('sproutfarm', 'tech/daynight.jpg'),
				body: '시간이 흐르면 화면이 노을빛을 지나 어두워지고, 체력이 떨어지면 나침반이 집을 가리킵니다.',
			},
		],
		build: [
			{
				title: '무한 맵',
				image: projectImage('sproutfarm', 'tech/infinite.jpg'),
				body: '20×20칸 타일맵 4개가 플레이어를 따라다닙니다. 경계를 넘으면 가장 먼 덩어리를 진행 방향으로 40칸 옮겨 붙입니다.',
			},
			{
				title: '절차적 지형',
				image: projectImage('sproutfarm', 'tech/zones.jpg'),
				body: '플레이어 주위를 12칸 구역으로 나눠 구역 위치로 풍경을 정하고, 24칸 간격으로 구불구불한 흙길을 냅니다.',
			},
			{
				title: 'A* 동물 AI',
				image: projectImage('sproutfarm', 'tech/escape.jpg'),
				body: 'A* 길찾기로 장애물을 피해 도망치고 따라옵니다. 흩어질 자리는 플레이어가 실제로 걸어갈 수 있는 곳만 고릅니다.',
			},
			{
				title: '조작할 수 없는 랭킹',
				image: projectImage('sproutfarm', 'shots/result.jpg'),
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
		art: projectImage('sproutfarm', 'scene.png'),
		credits: [
			{
				role: 'ART',
				name: 'Sprout Lands Asset Pack',
				by: 'Cup Nooble',
				href: 'https://cupnooble.itch.io/sprout-lands-asset-pack',
				note: '풀밭과 흙길, 집과 나무, 소·병아리·주인공, 아이템, 대화창, 표정, 고양이 발 커서까지 게임과 이 페이지의 픽셀 그림은 모두 이 팩에서 가져왔습니다.',
			},
			{
				role: 'FONT',
				name: 'Galmuri11',
				by: 'quiple',
				href: 'https://github.com/quiple/galmuri',
				note: '게임 안의 한글 픽셀 글꼴 (SIL Open Font License)',
			},
		],
		gallery: [
			{ src: projectImage('sproutfarm', 'shots/intro.jpg'), caption: '시작 — 동물들이 달아났다' },
			{ src: projectImage('sproutfarm', 'shots/farm.jpg'), caption: '오전 9시, 농장에서' },
			{ src: projectImage('sproutfarm', 'shots/field.jpg'), caption: '들판으로 나가 동물 찾기' },
			{ src: projectImage('sproutfarm', 'shots/path.jpg'), caption: '흙길에서는 더 빠르게' },
			{ src: projectImage('sproutfarm', 'shots/pond.jpg'), caption: '연못가' },
			{ src: projectImage('sproutfarm', 'shots/evening.jpg'), caption: '노을이 지면' },
			{ src: projectImage('sproutfarm', 'shots/night.jpg'), caption: '밤, 자정까지' },
			{ src: projectImage('sproutfarm', 'shots/result.jpg'), caption: '결과와 랭킹' },
		],
		image: projectImage('sproutfarm', 'screenshot.jpg'),
	},
	{
		id: 'macfolio',
		name: 'MacFolio',
		look: 'product',
		tagline: '포트폴리오를, 데스크톱으로.',
		description:
			'macOS 데스크톱을 웹으로 옮긴 포트폴리오. 메모 앱은 블로그, 메시지 앱은 방명록, Safari는 프로젝트 소개가 된다',
		context: '개인 프로젝트 (프론트엔드와 백엔드)',
		role: '기획·디자인, 프론트엔드, API 서버, 배포',
		period: '2024.10.22 –',
		facts: [
			{ value: '1인', label: '화면부터 서버까지' },
			{ value: '0원', label: '서버 운영비' },
			{ value: '0개', label: '바깥에 연 서버 포트' },
		],
		highlights: [
			{
				title: '진짜 같은 데스크톱',
				body: 'Dock에서 앱을 열고, 창을 끌어 옮기고 크기를 바꿉니다. 휴대폰으로 열면 iOS 홈 화면이 됩니다.',
				image: projectImage('macfolio', 'views/desktop.jpg'),
			},
			{
				title: '메모 앱이 곧 블로그',
				body: '폴더와 갤러리 보기, 검색으로 글을 읽습니다. 관리자가 로그인하면 글이 그대로 편집기가 됩니다.',
				image: projectImage('macfolio', 'views/memo-laptop.jpg'),
			},
			{
				title: '가입 없이 남기는 글',
				body: '메시지 앱의 방명록과 블로그 댓글은 계정 없이 쓰고, 내가 쓴 글만 지울 수 있습니다.',
				image: projectImage('macfolio', 'views/messages-laptop.jpg'),
			},
			{
				title: '주소가 있는 화면',
				body: '/memo/글, /safari/프로젝트처럼 글과 프로젝트마다 주소가 있어, 링크로 들어오면 그 화면으로 열립니다.',
				image: projectImage('macfolio', 'views/safari-laptop.jpg'),
			},
		],
		build: [
			{
				title: '앱은 필요할 때 불러온다',
				body: '앱마다 코드를 나눠 처음에는 데스크톱만 받고, 앱을 열 때 그 앱의 코드를 받습니다.',
			},
			{
				title: '권한은 서버가',
				body: 'GitHub OAuth로 관리자 한 명만 들여보내고, 세션은 DB에 해시로만 둡니다. 화면의 버튼과 상관없이 요청마다 서버가 확인합니다.',
			},
			{
				title: '무료로 띄운 서버',
				body: 'NestJS와 PostgreSQL을 Oracle Cloud 무료 VM에 올리고, Cloudflare Tunnel로 포트를 열지 않고 내보냅니다.',
			},
			{
				title: '시험을 통과해야 배포',
				body: 'Vitest, Playwright, 실제 DB로 도는 API e2e가 모든 PR에서 돌고, main에 들어온 커밋만 Cloudflare Workers에 배포됩니다.',
			},
		],
		contributions: [
			'기획과 화면 디자인',
			'데스크톱·창·Dock과 앱들, 휴대폰 화면',
			'NestJS API 서버와 DB 설계',
			'GitHub Actions 시험·배포',
		],
		specs: [
			{ label: '프론트엔드', value: 'React 19, TypeScript, Vite' },
			{ label: '백엔드', value: 'NestJS, Prisma, PostgreSQL' },
			{ label: '인증', value: 'GitHub OAuth, 세션 쿠키' },
			{ label: '시험', value: 'Vitest, Playwright' },
			{ label: '배포', value: 'Cloudflare Workers, Oracle Cloud VM, Cloudflare Tunnel' },
			{ label: '구성', value: 'pnpm workspaces, Turborepo' },
		],
		stack: ['React', 'TypeScript', 'Vite', 'NestJS', 'PostgreSQL', 'Cloudflare'],
		language: 'TypeScript',
		url: 'https://github.com/hyeoniverse/MacFolio',
		icon: projectImage('macfolio', 'icon.png'),
		image: projectImage('macfolio', 'screenshot.jpg'),
	},
	{
		id: 'hyeoniverse',
		name: 'HYEONIVERSE',
		look: 'creative',
		tagline: '작업물과 글을, 움직이는 화면으로.',
		description:
			'작업물과 글을 보여 주는 공개 화면부터, 그 글을 직접 쓰고 고치는 관리자 화면까지 한 저장소에 담은 개인 포트폴리오',
		context: '개인 프로젝트 (Next.js 풀스택)',
		role: '기획·디자인, 프론트엔드, Supabase 설계, 관리자 화면',
		period: '2026.02.05 – 운영 중',
		facts: [
			{ value: '97점', label: 'Lighthouse 성능 (LCP 0.7초)' },
			{ value: '100점', label: '접근성 · SEO' },
			{ value: '33건', label: '디자인 결정 기록' },
		],
		highlights: [
			{
				title: '스크롤에 반응하는 첫 화면',
				body: '무한 스크롤 루프, 마우스 패럴랙스, 글자마다 그려지는 외곽선, Three.js 토러스와 커피잔이 스크롤과 마우스를 따라 움직입니다.',
				scrollFrames: ['scroll-1', 'scroll-2', 'scroll-3'].map((name) =>
					projectImage('hyeoniverse', `shots/${name}.jpg`)
				),
				image: projectImage('hyeoniverse', 'shots/home-light.jpg'),
				imageDark: projectImage('hyeoniverse', 'shots/home-dark.jpg'),
			},
			{
				title: '여섯 가지 작업물 레이아웃',
				body: 'Flow, Grid, Cylinder, Fullscreen, Cinematic, Split 중 하나를 관리자 설정이나 ?layout= 주소로 골라 바꿔 끼웁니다.',
				variants: [
					{ label: 'Flow', note: '가로로 끝없이 흐르는 갤러리. 마우스를 따라 기울어진다' },
					{ label: 'Grid', note: '크기가 다른 칸을 12칸 격자에 채운 벤토' },
					{ label: 'Cylinder', note: 'Three.js 원통에 작업물을 감아 돌린다' },
					{ label: 'Fullscreen', note: '화면 가득 배경이 겹쳐 바뀌고, 네 귀퉁이에 시계·FPS HUD' },
					{ label: 'Cinematic', note: '층마다 다른 속도로 움직이는 패럴랙스 영화' },
					{ label: 'Split', note: '왼쪽 정보는 멈추고 오른쪽 작업물만 스크롤' },
				],
			},
			{
				title: '글과 시리즈',
				body: 'SSR과 ISR로 글을 보여 주고, 시리즈와 배너, 여섯 가지 목록 모양, 마크다운 게스트 댓글이나 giscus를 고릅니다.',
				image: projectImage('hyeoniverse', 'shots/posts.jpg'),
			},
			{
				title: '스크롤을 시간축으로',
				body: 'About 페이지는 스크롤을 영상의 재생 막대처럼 써서, 제작 과정을 담은 14개 패널의 장면이 스크롤하는 만큼 이어서 넘어갑니다. 가로로 넘기는 영역에서도 휠이 세로 스크롤과 엉키지 않아, 보고 있던 자리를 잃지 않습니다.',
				video: projectImage('hyeoniverse', 'shots/about-tour.mp4'),
			},
		],
		chapters: [
			{
				title: '관리자와 CMS',
				lead: '글과 작업물을 쓰고, 고치고, 발행하고, 지우는 일을 모두 관리자 화면에서 합니다. 글 한 편이 쓰여 발행되고 휴지통을 거쳐 사라지기까지의 길을 따라, 사이트 문구와 권한까지 코드 배포 없이 바꿉니다.',
				points: [
					{
						title: '하나의 편집기',
						body: 'Plate.js 편집기에서 마크다운과 리치 텍스트를 오가며 씁니다. 제목·목록·표·코드·각주·콜아웃과 글자색, 형광을 쓰고, 오디오·파일 첨부까지 두 형식 사이에서 그대로 옮겨집니다. 투표·탭·캘린더 블록은 직접 만들어 더했고, 미리보기는 실제 게시 화면과 같은 컴포넌트로 그려 보이는 그대로 발행됩니다.',
						image: projectImage('hyeoniverse', 'shots/cms-editor.jpg'),
					},
					{
						title: '요소마다 떠 있는 도구 막대',
						body: '노션처럼 고친 그 자리에서 꾸밉니다. 글자를 고르면 문단 모양·굵게·색·배경을 바꾸는 막대가, 이미지를 고르면 인라인·블록·플로트 배치와 정렬, 캡션, 교체를 하는 막대가 그 요소 위에 뜹니다.',
						image: projectImage('hyeoniverse', 'shots/cms-toolbar.jpg'),
					},
					{
						title: '세 겹 자동 저장과 버전 확인',
						body: '입력하는 즉시 브라우저에 초안을 두고, 3초 동안 입력이 없으면 서버에 리비전을 쌓고, 페이지를 떠날 때는 sendBeacon으로 마지막 변경을 보냅니다. 저장할 때는 불러온 버전과 지금 버전을 비교해, 다른 화면이 먼저 저장했으면 409로 돌려보내 덮어쓰지 않습니다.',
						image: projectImage('hyeoniverse', 'shots/cms-autosave.jpg'),
					},
					{
						title: '글 한 편의 일생',
						body: '초안은 예약하면 DB 안의 pg_cron이 매분 확인해 그 시각에 발행하고, 발행된 글은 저장할 때마다 버전이 오릅니다. 지운 글은 휴지통에서 복구할 수 있고, 30일(인기 글 다섯 개는 90일)이 지나면 매일 도는 정리 작업이 영구 삭제합니다. 글과 작업물이 중심인 테이블 25개 위에서 돕니다.',
						image: projectImage('hyeoniverse', 'shots/cms-lifecycle.jpg'),
					},
					{
						title: '목록에서 한 번에',
						body: '글 목록에서 여러 개를 골라 한 번에 발행하거나 지우고, 상태 칩을 누르면 그 자리에서 발행과 미발행이 바뀝니다. 필터·검색 줄은 스크롤해도 위에 붙어 있고, 행마다 공개 페이지 바로가기와 .md 내보내기가 있습니다. 작업물은 행 번호를 눌러 새 순서를 적으면 바로 옮겨집니다.',
						image: projectImage('hyeoniverse', 'shots/cms-posts.jpg'),
					},
					{
						title: '누가 무엇을 할 수 있나',
						body: '소유자·관리자·저자·방문자 네 단계로 나눠, 저자는 자기 글만, 관리자는 모든 글과 댓글 중재까지, 사이트 설정과 저자 초대는 소유자만 합니다. 소유자가 이메일로 초대하고, 초대받지 않은 계정은 GitHub 로그인 직후 지웁니다.',
						image: projectImage('hyeoniverse', 'shots/cms-roles.jpg'),
					},
					{
						title: '대시보드와 알림',
						body: '누적 조회수·좋아요·방문자·댓글과 일별 조회 추세, 유입 경로를 대시보드에서 보고, 예약 발행 대기 글도 확인합니다. 댓글·신고·새 기기 로그인 같은 알림은 한 화면의 탭에서 처리합니다.',
						image: projectImage('hyeoniverse', 'shots/admin-traffic.jpg'),
					},
					{
						title: '코드 배포 없이 사이트 설정',
						body: '사이트 제목과 소개, SEO 메타데이터, 테마 색, 외부 서비스 키를 설정 다섯 탭에서 고칩니다. 비우면 안 되는 값은 화면·API·DB 세 곳에서 막고, About 페이지는 실제 페이지 위에서 글자를 눌러 바로 고칩니다.',
						image: projectImage('hyeoniverse', 'shots/admin-settings.jpg'),
					},
					{
						title: '글과 작업물 잇기',
						body: '글과 작업물, 작업물과 시리즈를 다대다로 잇습니다. 어느 쪽에서 더해도 양쪽 상세 화면에 함께 보입니다.',
					},
					{
						title: 'SEO 점검',
						body: '편집기 아래에서 제목·주소·요약·커버·카테고리·태그 여섯 가지를 점검해 점수로 보여 주고, 모자란 항목은 그 칸으로 바로 데려갑니다.',
					},
				],
			},
			{
				title: '발표 갤러리와 음성',
				lead: '작업물마다 발표 자료를 슬라이드 갤러리로 올리고, 장마다 목소리를 입혀 발표처럼 넘어가게 합니다. 자료를 그림으로 바꾸는 일부터 대본, 음성, 녹음 다듬기까지 편집 화면 안에서 끝납니다.',
				facts: [
					{ value: '3곳', label: 'TTS (Fish · Google · Edge)' },
					{ value: '24kHz', label: '마이크 녹음 (모노 WAV)' },
					{ value: '50단계', label: '녹음 편집 되돌리기' },
				],
				points: [
					{
						title: '발표처럼 넘어가는 갤러리',
						body: '가운데 한 장이 크고 양옆이 원근으로 기운 갤러리입니다. 화면에 절반 넘게 들어오면 첫 장부터 읽기 시작해, 음성이 끝나면 다음 장으로 넘어갑니다. 음성 파일이 있으면 그 파일을, 대본만 있으면 방문자 브라우저의 음성 합성을 쓰고, 둘 다 없으면 4초 보여 주고 넘깁니다. 화면 밖으로 나가면 멈췄다가 돌아오면 이어 읽습니다.',
						demo: 'slides',
					},
					{
						title: '대본을 목소리로',
						body: '장마다 대본을 Fish Audio, Google, Edge 가운데 고른 목소리로 만들고, 실패하면 남은 공급자의 같은 성별 목소리로 넘어갑니다. 영어 대본은 한국어 목소리인 Fish를 건너뜁니다. 읽기 사전으로 RLS를 "알엘에스"로 읽히고, 대본 안의 [표기|읽을 말]로 그 자리만 따로 정하며, 자막에는 표기가 그대로 남습니다. 만드는 동안에는 대본과 목소리, 이미지 순서가 잠깁니다.',
						demo: 'voice',
					},
					{
						title: '녹음하고 파형으로 다듬기',
						body: '편집 화면에서 마이크로 바로 녹음해 24kHz WAV로 만듭니다. 파형을 끌어 구간을 고르고 잘라내기·복사·붙여넣기·지우기·나누기를 하며, 되돌리기는 50단계까지 됩니다. 단축키는 편집기 어디서나 받고, 복사한 조각은 다른 장의 녹음에도 붙여 넣습니다.',
						demo: 'wave',
					},
					{
						title: 'PDF·PPTX를 슬라이드로',
						body: '갤러리에 PDF나 PPTX를 끌어 놓으면 브라우저 안에서 쪽마다 JPEG로 그려 올립니다. PDF는 pdf.js로 그리고, PPTX는 HTML로 그린 뒤 그림으로 굳히며, 발표자 노트는 장마다 음성 대본으로 들어갑니다. 파일이 남의 서버로 나가지 않도록 변환은 서버에서 하지 않습니다.',
						demo: 'convert',
					},
				],
			},
			{
				title: '자동 번역과 AI 요약',
				lead: '글과 작업물은 한국어와 영어 칸을 따로 둡니다. 한쪽만 써도 나머지는 번역이 채우고, 발행하면 두 언어의 요약이 붙습니다.',
				facts: [
					{ value: '4곳', label: '번역 (DeepL · Google · Gemini · Claude)' },
					{ value: 'KO · EN', label: '언어마다 따로 두는 칸' },
					{ value: '2–3문장', label: '언어마다 AI 요약' },
				],
				points: [
					{
						title: '편집 언어를 바꾸면 번역',
						body: '편집기에서 KO와 EN을 오갈 때 반대쪽 칸이 비어 있으면 제목·설명·본문과 갤러리 대본까지 번역해 채웁니다. 기본은 DeepL이고, 설정에서 대체 순서를 켜면 앞 공급자가 못 한 항목만 다음 공급자에게 넘깁니다. 다시 번역 단추로 전체를 새로 받을 수도 있습니다.',
						demo: 'translate',
					},
					{
						title: '발행하면 붙는 AI 요약',
						body: '발행할 때 Gemini가 한국어와 영어 요약을 2–3문장씩 한 번에 만들고, 상세 페이지 위에 접고 펼치는 상자로 보여 줍니다. 상세 페이지의 언어 토글을 따르고, 그 언어 요약이 없으면 다른 언어 요약을 보여 줍니다. 공급자는 OpenAI나 Claude로 바꿀 수 있습니다.',
						demo: 'summary',
					},
					{
						title: '방문자가 누른 번역은 남긴다',
						body: '공개 화면에서 보고 있는 언어의 본문이 없으면 번역 단추가 뜨고, 그 결과를 DB의 그 언어 칸에 저장해 다음 방문자는 기다리지 않습니다. 댓글 번역은 화면에만 두고 저장하지 않습니다.',
					},
				],
			},
			{
				title: '테마',
				lead: '사이트의 색은 코드가 아니라 관리자 설정에서 고릅니다. 아래에서 프리셋을 누르거나 라이트·다크를 바꿔 보면, 같은 화면에서 무엇이 바뀌고 무엇이 남는지 보입니다.',
				facts: [
					{ value: '18개', label: '테마 프리셋' },
					{ value: '5색', label: '테마 하나 (강조 · 바탕 · 글자)' },
					{ value: '2가지', label: '모드 (라이트 · 다크)' },
				],
				palette: [
					{
						name: 'Default',
						accent: '#d40063',
						lightBg: '#f5f5f0',
						lightText: '#1a1a1a',
						darkBg: '#0a0a0a',
						darkText: '#f5f5f0',
					},
					{
						name: 'Ruby',
						accent: '#9d0208',
						lightBg: '#fbeaea',
						lightText: '#3b0a0a',
						darkBg: '#150404',
						darkText: '#efe4d6',
					},
					{
						name: 'Meadow',
						accent: '#bc4749',
						lightBg: '#f2e8cf',
						lightText: '#2a4e30',
						darkBg: '#141f12',
						darkText: '#a7c957',
					},
					{
						name: 'Coral',
						accent: '#fe5f55',
						lightBg: '#eef5db',
						lightText: '#3d2a1a',
						darkBg: '#1a130c',
						darkText: '#c7efcf',
					},
					{
						name: 'Azure',
						accent: '#fd6b1d',
						lightBg: '#efefd0',
						lightText: '#004e89',
						darkBg: '#0a1a2e',
						darkText: '#efefd0',
					},
					{
						name: 'Sand',
						accent: '#e0af9c',
						lightBg: '#efebce',
						lightText: '#263340',
						darkBg: '#18170e',
						darkText: '#e6eef2',
					},
					{
						name: 'Harvest',
						accent: '#ce965c',
						lightBg: '#fefae0',
						lightText: '#283618',
						darkBg: '#1a1e0e',
						darkText: '#fefae0',
					},
					{
						name: 'Honey',
						accent: '#fbc45d',
						lightBg: '#f7ede2',
						lightText: '#3d2e1e',
						darkBg: '#1c130e',
						darkText: '#f5cac3',
					},
					{
						name: 'Forest',
						accent: '#4d753d',
						lightBg: '#dad7cd',
						lightText: '#2b2c28',
						darkBg: '#1a2e1f',
						darkText: '#e3ded2',
					},
					{
						name: 'Rosewood',
						accent: '#57806d',
						lightBg: '#f8c7cc',
						lightText: '#0e0f19',
						darkBg: '#0e0f19',
						darkText: '#f4c7cc',
					},
					{
						name: 'Dusk',
						accent: '#6abaa3',
						lightBg: '#ffe5d4',
						lightText: '#3d2b33',
						darkBg: '#101c16',
						darkText: '#efc7c2',
					},
					{
						name: 'Arctic',
						accent: '#5aa7c3',
						lightBg: '#cae9ff',
						lightText: '#2a2320',
						darkBg: '#0c1e2e',
						darkText: '#f1ece4',
					},
					{
						name: 'Baltic',
						accent: '#1c5d99',
						lightBg: '#ffffff',
						lightText: '#222222',
						darkBg: '#222222',
						darkText: '#e6e4df',
					},
					{
						name: 'Sorbet',
						accent: '#7aabe9',
						lightBg: '#fcf5c7',
						lightText: '#3a2f2a',
						darkBg: '#0e1e2c',
						darkText: '#ffc09f',
					},
					{
						name: 'Twilight',
						accent: '#6d3fb0',
						lightBg: '#fbf3df',
						lightText: '#2b2630',
						darkBg: '#1b1330',
						darkText: '#f3d9a4',
					},
					{
						name: 'Tropica',
						accent: '#fa5ca4',
						lightBg: '#fce4d8',
						lightText: '#4a1530',
						darkBg: '#1a0a14',
						darkText: '#b5f8fe',
					},
					{
						name: 'Petal',
						accent: '#f8768d',
						lightBg: '#ffe5ec',
						lightText: '#2e2427',
						darkBg: '#1a0810',
						darkText: '#f4ebdf',
					},
					{
						name: 'Slate',
						accent: '#5c677d',
						lightBg: '#eef0f4',
						lightText: '#2a2521',
						darkBg: '#0e1118',
						darkText: '#e8e2d8',
					},
				],
				points: [
					{
						title: '다섯 색이 한 테마',
						body: '강조색과 라이트·다크 각각의 바탕색·글자색, 다섯 값으로 테마 하나가 정해집니다. 회색 단계와 강조색 면 위의 글자색은 이 다섯 값에서 계산해 고릅니다.',
					},
					{
						title: '색상환 순서의 프리셋',
						body: '기본 마젠타 다음부터 빨강·주황·초록·파랑·보라 순으로 놓고, 색이 거의 없는 Slate를 맨 뒤에 둡니다. 직접 만든 테마도 프리셋으로 저장해 둡니다.',
					},
					{
						title: '대비 점검',
						body: '설정 화면에서 바탕과 글자, 강조색의 대비를 바로 계산해 보여 줍니다. 프리셋은 모두 대비 기준을 넘도록 맞추고, 서로 겹쳐 보이던 강조색은 바꿨습니다.',
					},
					{
						title: '색상환 추천과 이미지에서 뽑기',
						body: '색상환을 끌어 기준 색을 바꾸면 어울리는 강조색 후보를 규칙마다 하나씩 추천하고, 올린 이미지에서 색을 뽑아 테마를 만듭니다.',
					},
					{
						title: '로고와 3D도 함께',
						body: '그림 로고는 테마 색으로 칠할 수 있고, giscus 댓글도 모드마다 테마를 따로 정합니다. 홈의 3D 토러스는 색 프리셋을 따르지 않고 라이트·다크 두 벌의 재질만 오갑니다.',
					},
					{
						title: '시스템 설정을 따르는 모드',
						body: '모드는 라이트와 다크 두 가지이고, 방문자가 고른 적이 없으면 운영체제 설정을 따릅니다.',
					},
				],
			},
			{
				title: '성능',
				lead: '느린 화면을 감으로 고치지 않고, 원인을 나눠 잰 뒤 같은 조건에서 다시 쟀습니다. 운영 사이트를 데스크톱 Lighthouse로 세 번 잰 중앙값입니다.',
				facts: [
					{ value: '97점', label: '성능' },
					{ value: '100점', label: '접근성' },
					{ value: '100점', label: 'SEO' },
					{ value: '0.7초', label: 'LCP' },
				],
				compare: [
					{ label: '프로필 LCP', before: 9.7, after: 2.7, unit: '초' },
					{ label: '글 목록 LCP', before: 7.8, after: 2.9, unit: '초' },
					{ label: '관리자 글 목록 LCP', before: 2.1, after: 1.45, unit: '초' },
					{ label: '홈 다운로드', before: 4.8, after: 1.0, unit: 'MB' },
					{ label: '편집기 입력 지연 (상위 10%)', before: 120, after: 72, unit: 'ms' },
				],
				points: [
					{
						title: '이미 그린 페이지를 다시 만들지 않게',
						body: '모바일에서 화면 너비에 묶인 key 때문에 이미 그린 페이지를 다시 만들고 있었습니다. 경계를 실제로 넘을 때만 바뀌는 key로 고쳤습니다.',
					},
					{
						title: '입력할 때마다 하던 전체 재계산 없애기',
						body: '태그 칩의 :has(:hover)가 입력할 때마다 페이지 전체 스타일을 다시 계산하게 했습니다. 속성으로 바꿔 재계산을 10회에서 0회로 줄였습니다.',
					},
					{
						title: '배너를 서버 HTML에',
						body: 'LCP 요소인 배너가 서버 HTML에 없었고, 데이터를 받은 뒤에도 투명하게 가려져 있었습니다. 두 원인을 각각 고쳤습니다.',
					},
					{
						title: '표시 크기에 맞춘 이미지',
						body: '확장자만 WebP인 3673px JPEG가 3D 반사 이미지로 쓰이고 있었습니다. 실제 표시 크기에 맞춰 다시 만들었습니다.',
					},
				],
			},
			{
				title: '보안과 데이터',
				lead: '권한은 API 코드만 믿지 않고 DB가 마지막에 확인합니다. 지운 데이터는 되돌릴 수 있고, 동시 저장은 충돌로 알아챕니다.',
				points: [
					{
						title: 'DB가 판정하는 권한',
						body: '서버 검사가 빠진 요청으로 비공개 글이 보인 일을 겪은 뒤, 역할을 읽는 RLS 정책으로 판정을 옮겼습니다. 소유자·관리자·저자·방문자 네 단계입니다.',
					},
					{
						title: '역할은 고칠 수 없는 곳에',
						body: '역할은 사용자가 고칠 수 있는 user_metadata가 아니라 서버만 쓰는 app_metadata에 둡니다. 정책 하나가 잘못 적혀 익명에게 열린 테이블이 생긴 뒤로는 익명 쓰기 권한 자체를 회수했습니다.',
					},
					{
						title: '로그인 보호',
						body: 'API 쓰기 요청은 Origin을 대조해 맞지 않으면 거절합니다. 로그인은 5회 실패하면 15분 잠그고, 처음 보는 기기는 메일로 승인받습니다.',
					},
					{
						title: '정기 작업은 DB 안에서',
						body: '예약 발행과 휴지통 정리는 인터넷에 열린 cron API 대신 DB 안의 pg_cron이 돌리고, 실패하면 관리자 알림을 남깁니다.',
					},
					{
						title: '댓글 정제',
						body: '댓글 마크다운은 태그와 속성을 화이트리스트로 거르고, 이미지는 외부 주소만 받습니다. 이모지 반응은 IP 원문이 아니라 해시만 저장합니다.',
					},
				],
			},
		],
		timeline: [
			{ date: '02.05', label: '공개 사이트 골격: 홈 애니메이션, 작업물, 3D 토러스' },
			{ date: '02.23', label: '블로그와 관리자 CMS, 시리즈, 자동 번역' },
			{ date: '03.17', label: '리치 텍스트 편집기, 자동 저장, 휴지통, 예약 발행' },
			{ date: '04.27', label: 'CI와 release-please, 로그인 잠금, Next.js 16' },
			{ date: '05.28', label: '편집기 개편, 저장 형식을 마크다운 하나로' },
			{ date: '07.23', label: '새 기능을 멈추고 전면 리팩토링, 권한 판정을 RLS로' },
			{ date: '09.11', label: '성능·접근성·운영 다듬기' },
			{ date: '10.01', label: '디자인 시스템 명세 다시 쓰기' },
		],
		build: [
			{
				title: '이슈에서 릴리스까지',
				body: '2026년 4월 말부터 모든 변경을 이슈, 브랜치, PR로 올리고 release-please로 버전을 매깁니다.',
			},
			{
				title: 'PR마다 거치는 관문',
				body: '타입 검사, ESLint 경고 총량, stylelint 토큰 규칙, Vitest, 등록되지 않은 의존성 0, 타입 커버리지 97.93%를 확인합니다.',
			},
			{
				title: '화면이 깨졌는지 찍어 보기',
				body: '공개 화면 12개를 데스크톱과 모바일로, 관리자 화면 16개를 찍어 모두 40장을 비교합니다.',
			},
			{
				title: '멈추고 정리하기',
				body: '7월 말부터 약 7주 동안 새 기능을 멈추고 커다란 설정 컴포넌트를 나누고, API 안전망 시험 119건을 깔았습니다.',
			},
		],
		contributions: [
			'기획과 화면 디자인, 디자인 시스템',
			'인터랙션과 3D 화면',
			'Supabase 테이블·RLS·Storage 설계',
			'관리자 화면과 편집기',
		],
		specs: [
			{ label: '프레임워크', value: 'Next.js 16 (App Router), React 19, TypeScript' },
			{ label: '스타일', value: 'CSS Modules, 3층 CSS 변수 토큰' },
			{ label: '애니메이션 · 3D', value: 'Framer Motion, GSAP, Lenis, Three.js (React Three Fiber)' },
			{ label: '백엔드', value: 'Supabase (PostgreSQL, Auth, Storage, RLS)' },
			{ label: '편집기', value: 'Plate.js, React Flow, Sandpack, CodeMirror 6, KaTeX' },
			{ label: '시험 · 배포', value: 'Vitest, Playwright, Vercel' },
		],
		stack: ['Next.js', 'React', 'TypeScript', 'Supabase', 'GSAP', 'Three.js'],
		language: 'TypeScript',
		url: 'https://github.com/hyeoniverse/web-portfolio-hyeoniverse',
		demo: 'https://www.hyeoniverse.com',
		icon: projectImage('hyeoniverse', 'icon.svg'),
		image: projectImage('hyeoniverse', 'screenshot.jpg'),
	},
	{
		id: 'devcourse',
		name: 'DevCourse FullStack',
		look: 'terminal',
		terminal: [
			'$ git clone https://github.com/hyeoniverse/DevCourse-FullStack',
			'# README.md 수강 목록',
			'Week 01 · 24.08.12 · 오리엔테이션(OT) 안내사항 ✓',
			'Week 01 · 24.08.13 · 포트폴리오 / 협업 환경 구성 (2) ✓',
			'Week 02 · 24.08.20 · 웹 서비스의 이해 (1) ✓',
			'$ git commit -m "practice: Express 기본 라우팅 실습"',
		],
		conventions: [
			{ type: 'feat', description: '새로운 기능 추가' },
			{ type: 'fix', description: '버그 수정' },
			{ type: 'docs', description: '문서 (README, 주석)' },
			{ type: 'style', description: '코드 스타일' },
			{ type: 'refactor', description: '리팩토링' },
			{ type: 'test', description: '테스트 코드' },
			{ type: 'chore', description: '설정과 기타 작업' },
			{ type: 'perf', description: '성능 최적화' },
			{ type: 'practice', description: '실습 코드' },
			{ type: 'example', description: '예제 코드' },
			{ type: 'project', description: '프로젝트 관련' },
		],
		tagline: '배운 것은 전부, 커밋으로.',
		description: '타입스크립트로 함께하는 웹 풀 사이클 개발(React, Node.js) 과정의 강의 노트와 실습 기록',
		context: '프로그래머스 데브코스 4기 학습 기록',
		period: '2024.08.12 – 2024.11.30',
		facts: [
			{ value: '15주', label: '주차별 강의·노트 기록' },
			{ value: '5개', label: '직접 만든 실습 프로젝트' },
			{ value: '11가지', label: '커밋 타입으로 정리' },
		],
		highlights: [
			{
				title: '테니스 마켓',
				body: 'Node.js와 MariaDB로 만든 첫 웹 서버. 상품 화면과 주문 목록을 직접 띄우며 요청과 응답을 익혔습니다.',
			},
			{
				title: '유튜브 데모 API',
				body: 'Express로 회원가입·로그인과 채널 만들기·조회·수정·삭제 REST API를 만들고 MySQL에 연결했습니다.',
			},
			{
				title: '도서 쇼핑몰 API (Book-shop)',
				body: '회원, 도서, 카테고리, 좋아요, 장바구니, 주문 라우트를 컨트롤러로 나누고 MariaDB와 JWT 로그인으로 묶었습니다.',
			},
			{
				title: 'React 할 일 보드',
				body: 'TypeScript, Redux Toolkit, vanilla-extract로 만든 칸반 보드. react-beautiful-dnd로 카드를 끌어 옮깁니다.',
			},
			{
				title: '도서 스토어 화면 (book-store)',
				body: '도서 쇼핑몰 API를 쓰는 React와 TypeScript 화면을 만들며 프론트엔드와 백엔드를 이었습니다.',
			},
		],
		build: [
			{
				title: '주차마다 폴더 하나',
				body: 'Week01부터 Week15까지 주차 폴더 아래 날짜별 실습을 두고, README 표에 수강과 노트 여부를 체크했습니다.',
			},
			{
				title: '같은 서버를 여러 번',
				body: 'Node 기초 → Express → 유튜브 데모 → 도서 쇼핑몰 순서로 같은 모양의 API를 점점 크게 다시 만들었습니다.',
			},
			{
				title: '자바스크립트에서 타입스크립트로',
				body: '11주차부터는 TypeScript로 옮겨 가며 같은 기능을 타입과 함께 다시 썼습니다.',
			},
			{
				title: '커밋 타입으로 기록 나누기',
				body: 'feat, fix 같은 기본 타입에 practice, example, project를 더해 실습과 예제, 프로젝트 커밋을 구분했습니다.',
			},
		],
		contributions: ['강의 노트 정리', '실습·예제 코드 작성', '실습 프로젝트 5개', '커밋 컨벤션 설계'],
		timeline: [
			{ date: 'Week 01–02', label: '포트폴리오와 협업 환경, 웹 서비스의 이해' },
			{ date: 'Week 03', label: 'Node.js 기초' },
			{ date: 'Week 04–06', label: 'Express, 유튜브 데모 API, 화면 설계' },
			{ date: 'Week 07–09', label: '도서 쇼핑몰 API (Book-shop)' },
			{ date: 'Week 11', label: 'TypeScript, React 예제' },
			{ date: 'Week 12', label: 'React 할 일 보드' },
			{ date: 'Week 13', label: '도서 스토어 화면 (book-store)' },
			{ date: 'Week 15', label: '오픈소스와 라이선스 정리' },
		],
		specs: [
			{ label: '언어', value: 'TypeScript, JavaScript' },
			{ label: '프론트엔드', value: 'React, Redux Toolkit, vanilla-extract' },
			{ label: '백엔드', value: 'Node.js, Express, JWT' },
			{ label: 'DB', value: 'MySQL, MariaDB' },
		],
		stack: ['TypeScript', 'React', 'Node.js', 'Express', 'MySQL'],
		language: 'JavaScript',
		url: 'https://github.com/hyeoniverse/DevCourse-FullStack',
		image: projectImage('devcourse', 'screenshot.jpg'),
	},
];
