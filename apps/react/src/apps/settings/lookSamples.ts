// 시스템 설정 › 프로젝트의 '예시로 채우기'가 넣는 가상의 예시 프로젝트. 실제 회사·서비스가 아니다.
// 네 랜딩 템플릿(제품·카드·문서·벤토)은 모두 같은 내용(project/landing/content.ts의 landingOf)을 읽으므로 예시 하나(GENERAL_SAMPLE)를 함께 쓴다.
// 편집 화면이 고치는 칸을 모두 채워 어떤 템플릿에서도 모든 구역이 보이게 한다. RPG 대화창은 배경·장면 그림이 있어 자기 예시를 둔다.
// 그림은 사이트에 이미 있는 것(배경화면, 사이트 앱 아이콘)만 쓴다: 칸에 들어간 뒤 관리자가 자기 화면으로 바꾼다는 전제다.
// 모두 desktop-core의 parseProjects 검사를 통과해야 한다 (lookSamples.test.ts)
import { DEFAULT_LOOK, type Project, type ProjectLook, type ProjectPoint } from '@macfolio/desktop-core/site';

/** 예시가 채우는 것: 프로젝트에서 id·저장소·데모·앱(관리자가 직접 정하는 것)을 뺀 전부 */
export type LookSample = Omit<Project, 'id' | 'url' | 'demo' | 'app'>;

/** 예시를 두는 모양 (직접 짠 페이지는 코드라 예시가 없다) */
export type SampleLook = Exclude<ProjectLook, 'custom'>;

/** 네 랜딩 템플릿이 모두 읽는 맨 위 필드 (landingOf가 구역으로 바꾸는 것) */
export const LANDING_FIELDS = [
	'tagline',
	'description',
	'context',
	'role',
	'period',
	'language',
	'stack',
	'facts',
	'highlights',
	'build',
	'usage',
	'chapters',
	'controls',
	'timeline',
	'specs',
	'structure',
	'credits',
	'contributions',
	'icon',
	'image',
	'gallery',
] as const satisfies readonly (keyof LookSample)[];

/**
 * 모양마다 그 페이지가 읽는 맨 위 필드. 예시는 이것을 모두 채운다.
 * 편집 화면은 공통 필드 밖의 것(장면 그림 art, 대화창 배경 backdrop)을 그 모양을 골랐을 때만 보인다
 */
export const LOOK_FIELDS: Record<SampleLook, readonly (keyof LookSample)[]> = {
	product: LANDING_FIELDS,
	friendly: LANDING_FIELDS,
	paper: LANDING_FIELDS,
	bento: LANDING_FIELDS,
	// RPG 대화창은 폴더 구조를 읽지 않는다 (대화 상자에 트리를 담기 어렵다)
	dialogue: [...LANDING_FIELDS.filter((field) => field !== 'structure'), 'art', 'backdrop'],
};

const WALL = (name: string) => `/imgs/wallpapers/${name}.jpg`;

/** 항목 하나 (제목, 설명, 자세히, 아이콘) */
const pt = (title: string, body: string, detail?: string, icon?: string): ProjectPoint => ({
	title,
	body,
	...(detail ? { detail } : {}),
	...(icon ? { icon } : {}),
});

/** 네 랜딩 템플릿이 함께 쓰는 예시: 모든 구역을 채운다 */
const general: LookSample = {
	name: '북클럽 – 독서 모임 플랫폼',
	look: DEFAULT_LOOK,
	tagline: '같은 책을 읽는 사람들이 한자리에 모입니다.',
	description: '책을 고르고, 함께 읽을 날짜를 정하고, 읽은 만큼 이야기를 나누는 온라인 독서 모임 플랫폼입니다.',
	context: '팀 프로젝트 (4명, 웹 서비스)',
	role: '프론트엔드 리드, 모임 일정과 토론 화면 담당',
	period: '2025.03.04 – 2025.06.27',
	language: 'TypeScript',
	stack: ['React', 'TypeScript', 'Vite', 'TanStack Query', 'Zustand', 'Node.js', 'PostgreSQL', 'Docker'],
	facts: [
		{ value: '120개', label: '시범 운영 중 열린 모임' },
		{ value: '1,800명', label: '가입한 독자' },
		{ value: '4주', label: '한 모임의 평균 기간' },
		{ value: '92%', label: '끝까지 읽은 비율' },
	],
	highlights: [
		{
			...pt(
				'책으로 모임 찾기',
				'읽고 싶은 책을 검색하면 그 책을 함께 읽는 모임이 시작일 순으로 나옵니다.',
				'도서 정보는 공공 도서 데이터에서 가져오고, 모임마다 남은 자리와 읽는 속도를 함께 보여 줍니다. 원하는 모임이 없으면 그 자리에서 새 모임을 엽니다.',
				'fa-magnifying-glass'
			),
			image: WALL('ventura-light'),
			imageDark: WALL('ventura-dark'),
		},
		{
			...pt(
				'읽은 만큼 열리는 토론',
				'내가 읽은 쪽수까지의 이야기만 보이게 해 결말을 미리 알게 되는 일을 막습니다.',
				'글마다 몇 쪽까지 읽고 쓴 글인지 표시하고, 내 진도보다 앞선 글은 접어 둡니다. 다 읽으면 접힌 글이 한꺼번에 펼쳐집니다.',
				'fa-book-open'
			),
			shots: [
				{ src: WALL('sequoia-light'), alt: '진도에 맞춰 접힌 토론 글' },
				{ src: WALL('sequoia-dark'), alt: '다 읽은 뒤 펼쳐진 토론 글' },
			],
		},
		pt(
			'함께 정하는 일정',
			'모임장이 후보 날짜를 올리면 모두가 되는 날을 골라 만남 날짜를 정합니다.',
			'고른 날짜는 각자의 캘린더 파일로 내려받을 수 있고, 하루 전에 알림 메일이 갑니다.',
			'fa-calendar-check'
		),
		pt(
			'밑줄 모음',
			'책을 읽다 마음에 든 문장을 남기면 모임의 밑줄 모음에 차곡차곡 쌓입니다.',
			'같은 문장에 밑줄을 그은 사람 수를 세어 많이 고른 문장이 위로 올라오고, 모임이 끝나면 밑줄 모음을 한 장의 카드로 만들어 나눕니다.',
			'fa-highlighter'
		),
		pt(
			'모임 기록',
			'끝난 모임은 읽은 기간, 나눈 글, 밑줄 모음이 담긴 기록 페이지로 남습니다.',
			'기록 페이지는 공개 범위를 고를 수 있어 다음 모임을 모으는 소개 글로도 씁니다.',
			'fa-box-archive'
		),
	],
	build: [
		{
			...pt(
				'진도별 글 가리기',
				'글을 불러올 때 서버가 읽는 사람의 진도를 보고 앞선 글의 본문을 빼고 보냅니다.',
				'화면에서만 가리면 개발자 도구로 볼 수 있어, 응답에서부터 본문을 빼고 제목과 쪽수만 남깁니다.',
				'fa-eye-slash'
			),
			image: WALL('tahoe-light'),
		},
		pt(
			'낙관적 업데이트',
			'밑줄과 댓글은 서버 응답을 기다리지 않고 바로 보이고, 실패하면 되돌립니다.',
			'TanStack Query의 캐시를 먼저 고치고 실패하면 이전 값으로 돌리며, 되돌린 이유를 짧은 알림으로 보여 줍니다.',
			'fa-bolt'
		),
		pt(
			'일정 투표 집계',
			'후보 날짜마다 되는 사람 수를 실시간으로 세어 가장 많은 날짜를 위로 올립니다.',
			'같은 수면 먼저 올린 날짜를 앞에 두어 순서가 흔들리지 않게 했습니다.',
			'fa-square-poll-vertical'
		),
		pt(
			'접근성 점검',
			'키보드만으로 모임 찾기부터 글쓰기까지 할 수 있게 다듬었습니다.',
			'화면 읽기 프로그램으로 주요 흐름을 직접 따라가 보고, 초점 순서와 이름표를 고쳤습니다.',
			'fa-universal-access'
		),
	],
	usage: [
		pt('둘러보기', '가입하지 않아도 열린 모임과 끝난 모임의 기록을 읽을 수 있습니다.', undefined, 'fa-compass'),
		pt(
			'모임에 들어가기',
			'가입한 뒤 모임에 들어가면 진도를 적고 토론에 글을 남길 수 있습니다.',
			undefined,
			'fa-right-to-bracket'
		),
		pt('모임 열기', '책을 고르고 기간과 인원을 정하면 새 모임이 목록에 올라갑니다.', undefined, 'fa-plus'),
	],
	chapters: [
		{
			title: '왜 만들었나',
			lead: '혼자 읽으면 중간에 멈추기 쉽고, 단체 대화방에서는 진도가 다른 사람의 글이 결말을 먼저 알려 주곤 했습니다.',
			facts: [
				{ value: '38%', label: '혼자 읽다 그만둔 비율 (설문)' },
				{ value: '3곳', label: '모임이 함께 쓰던 도구' },
			],
			points: [
				pt('흩어진 대화', '책 이야기, 일정, 밑줄이 서로 다른 앱에 흩어져 있었습니다.'),
				pt('미리 알게 되는 결말', '먼저 읽은 사람의 글이 늦게 읽는 사람의 재미를 빼앗았습니다.'),
			],
			image: { src: WALL('sonoma-dark'), alt: '모임이 쓰던 대화방과 일정표' },
		},
		{
			title: '시범 운영 뒤',
			lead: '120개 모임이 6주 동안 써 보고 남긴 의견으로 마지막 다듬기를 했습니다.',
			points: [
				pt('알림 줄이기', '알림이 너무 많다는 의견에 하루 한 번 묶어 보내기를 더했습니다.'),
				pt('진도 적기 쉽게', '쪽수 대신 퍼센트로도 진도를 적을 수 있게 했습니다.'),
			],
		},
	],
	controls: [
		{ keys: ['⌘', 'K'], label: '책과 모임 찾기' },
		{ keys: ['N'], label: '새 글 쓰기' },
		{ keys: ['J', 'K'], label: '다음 글, 이전 글' },
		{ keys: ['?'], label: '단축키 모두 보기' },
	],
	timeline: [
		{ date: '2025.03.04', label: '주제 정하기와 사용자 인터뷰' },
		{ date: '2025.03.18', label: '화면 설계와 디자인 시안' },
		{ date: '2025.04.01', label: '모임 찾기와 가입 흐름 구현' },
		{ date: '2025.04.22', label: '진도별 토론과 밑줄 모음 구현' },
		{ date: '2025.05.13', label: '일정 투표와 알림 메일' },
		{ date: '2025.06.03', label: '시범 운영과 피드백 반영' },
		{ date: '2025.06.27', label: '발표와 회고' },
	],
	specs: [
		{ label: '화면', value: 'React 19, TypeScript, Vite' },
		{ label: '상태', value: 'TanStack Query, Zustand' },
		{ label: '서버', value: 'Node.js, Express, PostgreSQL' },
		{ label: '인증', value: '이메일 로그인, 세션 쿠키' },
		{ label: '배포', value: 'Docker, 클라우드 가상 서버' },
	],
	structure: `bookclub/
├── web/              # React 화면
│   ├── features/     # 모임, 토론, 일정, 밑줄
│   └── shared/       # 디자인 시스템
├── server/           # Express API
│   ├── routes/
│   └── progress/     # 진도별 글 가리기
└── docker-compose.yml`,
	credits: [
		{ role: '아이콘', name: 'Font Awesome Free', by: 'Fonticons', href: 'https://fontawesome.com' },
		{ role: '도서 정보', name: '공공 도서 데이터', by: '국립 도서관 공개 API', note: '책 제목과 표지' },
		{ role: '글꼴', name: 'Pretendard', by: '길형진', href: 'https://github.com/orioncactus/pretendard' },
	],
	contributions: [
		'모임 찾기와 모임 상세 화면',
		'진도별로 글을 가리는 토론 화면과 서버 응답 설계',
		'일정 투표 화면과 실시간 집계',
		'디자인 시스템의 단추·입력칸 컴포넌트',
		'키보드 사용과 화면 읽기 점검',
	],
	icon: '/imgs/memo.png',
	image: WALL('sonoma-light'),
	gallery: [
		{ src: WALL('sonoma-light'), caption: '모임 찾기' },
		{ src: WALL('ventura-light'), caption: '진도별 토론' },
		{ src: WALL('sequoia-light'), caption: '밑줄 모음' },
		{ src: WALL('tahoe-light'), caption: '모임 기록' },
	],
};

/** 네 랜딩 템플릿이 함께 쓰는 예시 (모양은 기본 모양) */
export const GENERAL_SAMPLE: LookSample = general;

const dialogue: LookSample = {
	name: '픽셀팜 – 농장 경영 게임',
	look: 'dialogue',
	tagline: '어서 와요! 오늘도 밭에 물 주러 왔나요?',
	description: '씨앗을 심고 가꾸고 시장에 팔며 작은 농장을 키우는 픽셀 아트 농장 경영 게임',
	context: '팀 프로젝트 (3명, 웹 게임)',
	role: '게임 프로그래밍과 대화 시스템 담당',
	period: '2025.06.02 – 2025.08.22',
	language: 'C#',
	stack: ['Unity', 'C#', 'Tilemap', 'Ink', 'WebGL', 'Firebase'],
	facts: [
		{ value: '24종', label: '기를 수 있는 작물' },
		{ value: '4계절', label: '바뀌는 들판' },
		{ value: '30분', label: '게임 속 한 해' },
	],
	highlights: [
		pt(
			'심고, 물 주고, 거두기',
			'씨앗을 심고 날마다 물을 주면 작물이 자라 거둘 수 있습니다.',
			'작물마다 자라는 날 수와 좋아하는 계절이 달라 무엇을 언제 심을지 고르는 재미가 있습니다.'
		),
		pt(
			'마을 사람들',
			'시장 상인, 이웃 농부, 우체부와 대화하며 부탁을 들어줍니다.',
			'부탁을 들어주면 친밀도가 오르고 새 씨앗이나 도구를 얻습니다.'
		),
		pt(
			'계절과 날씨',
			'계절이 바뀌면 들판의 색과 자라는 작물이 바뀌고, 비 오는 날은 물을 주지 않아도 됩니다.',
			'겨울에는 온실에서만 작물을 기를 수 있습니다.'
		),
		pt(
			'시장',
			'거둔 작물을 시장에 팔아 돈을 모으고 농장을 넓힙니다.',
			'많이 팔린 작물은 값이 내려가 여러 작물을 고루 기르게 됩니다.'
		),
	],
	build: [
		pt(
			'대화 스크립트',
			'Ink로 대화를 적어 개발자가 아니어도 대사와 선택지를 고칠 수 있습니다.',
			'대화 중 선택은 게임 변수로 이어져 다음 대화가 달라집니다.'
		),
		pt(
			'자라는 작물',
			'작물은 하루가 지날 때 한꺼번에 자라도록 계산해 밭이 넓어도 느려지지 않습니다.',
			'화면에 보이는 칸만 그림을 바꿉니다.'
		),
		pt(
			'저장',
			'하루가 끝나 잠들 때 농장 상태를 저장하고, 브라우저를 닫아도 이어서 합니다.',
			'로그인하면 저장을 서버에도 남겨 다른 기기에서 이어 합니다.'
		),
	],
	usage: [
		pt('시작', '새 게임을 누르고 농장 이름을 지으면 첫날 아침이 밝습니다.'),
		pt('이어 하기', '이어 하기를 누르면 마지막으로 잠든 날부터 시작합니다.'),
	],
	timeline: [
		{ date: '2025.06.02', label: '게임 규칙과 그림 방향 정하기' },
		{ date: '2025.06.16', label: '타일맵 농장과 캐릭터 움직임' },
		{ date: '2025.07.07', label: '작물 성장과 계절' },
		{ date: '2025.07.21', label: '대화 시스템과 마을 사람들' },
		{ date: '2025.08.11', label: '시장과 저장' },
		{ date: '2025.08.22', label: '발표' },
	],
	specs: [
		{ label: '엔진', value: 'Unity, C#' },
		{ label: '맵', value: 'Tilemap, Rule Tile' },
		{ label: '대화', value: 'Ink 스크립트' },
		{ label: '저장', value: '브라우저 저장소, Firebase' },
		{ label: '배포', value: 'WebGL 빌드, 정적 호스팅' },
	],
	contributions: ['대화 시스템과 Ink 연동', '작물 성장과 계절 계산', '저장과 이어 하기', '시장 가격 규칙'],
	chapters: [
		{
			title: '그림 이야기',
			lead: '16픽셀 칸 하나에 작물의 자라는 단계를 담았습니다. 작물마다 다섯 장씩, 모두 120장을 그렸습니다.',
			points: [
				pt('계절 색', '계절마다 같은 타일의 색만 바꿔 그림 수를 줄였습니다.'),
				pt('작은 움직임', '바람이 불면 작물이 한 칸씩 흔들립니다.'),
			],
			image: { src: WALL('ios-earth'), alt: '계절이 바뀐 들판' },
		},
		{
			title: '함께 만든 방법',
			lead: '세 명이 그림, 기획, 프로그래밍을 나눠 맡고 매주 한 판씩 직접 해 보며 고쳤습니다.',
			image: { src: WALL('ventura-light'), alt: '매주 금요일 시연 자리' },
			points: [
				pt('주간 시연', '금요일마다 그 주에 만든 것을 직접 해 보고 고칠 것을 적었습니다.'),
				pt('대사 고치기', '기획자가 Ink 파일을 바로 고쳐 빌드 없이 대사를 바꿨습니다.'),
			],
		},
	],
	controls: [
		{ keys: ['↑', '↓', '←', '→'], label: '움직이기' },
		{ keys: ['Space'], label: '심기, 물 주기, 거두기' },
		{ keys: ['E'], label: '대화하기' },
		{ keys: ['Tab'], label: '가방 열기' },
	],
	credits: [
		{ role: '대화', name: 'Ink', by: 'inkle', href: 'https://www.inklestudios.com/ink/' },
		{ role: '효과음', name: '농장 효과음 묶음', by: '팀 사운드 담당', note: '직접 녹음' },
	],
	backdrop: { theme: 'farm' },
	icon: '/imgs/weather.svg',
	image: WALL('ios-earth'),
	art: WALL('ios-earth'),
	gallery: [
		{ src: WALL('ios-earth'), caption: '봄의 농장' },
		{ src: WALL('sequoia-light'), caption: '마을 시장' },
		{ src: WALL('ios-sky-light'), caption: '비 오는 날' },
	],
};

/** 모양마다의 예시: 네 랜딩 템플릿은 같은 예시를 모양만 바꿔 쓴다 */
export const LOOK_SAMPLES: Record<SampleLook, LookSample> = {
	product: { ...general, look: 'product' },
	friendly: { ...general, look: 'friendly' },
	paper: { ...general, look: 'paper' },
	bento: { ...general, look: 'bento' },
	dialogue,
};

/** 이 모양의 예시 (직접 짠 페이지는 공통 예시를 쓰고 모양은 그대로 둔다) */
export const sampleFor = (look: ProjectLook): LookSample =>
	look === 'custom' ? { ...general, look } : LOOK_SAMPLES[look];

/** 예시로 채운 프로젝트: id·저장소·데모·앱은 그대로 두고 나머지를 예시로 바꾼다 (예시에 없는 필드는 지운다) */
export function fillWithSample(project: Project): Project {
	const { id, url, demo, app } = project;
	return {
		...structuredClone(sampleFor(project.look)),
		id,
		url,
		...(demo ? { demo } : {}),
		...(app ? { app } : {}),
	};
}
