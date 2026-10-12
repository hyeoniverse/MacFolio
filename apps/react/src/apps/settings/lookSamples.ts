// 페이지 모양(look)마다 하나씩 둔 가상의 예시 프로젝트. 시스템 설정 › 프로젝트에서 새 프로젝트를 더한 뒤 '예시로 채우기'를 누르면
// 지금 고른 모양의 예시가 칸에 들어가고, 관리자가 그것을 고쳐 쓴다. 실제 회사·서비스가 아니다.
// 그림은 사이트에 이미 있는 것(배경화면, 사이트 앱 아이콘)만 쓴다: 칸에 들어간 뒤 관리자가 자기 화면으로 바꾼다는 전제다.
// 모두 desktop-core의 parseProjects 검사를 통과해야 한다 (lookSamples.test.ts)
import type { Project, ProjectLook, ProjectPoint } from '@macfolio/desktop-core/site';

/** 예시가 채우는 것: 프로젝트에서 id·저장소·데모·앱(관리자가 직접 정하는 것)을 뺀 전부 */
export type LookSample = Omit<Project, 'id' | 'url' | 'demo' | 'app'>;

/** 예시를 두는 모양 (직접 짠 페이지는 코드라 예시가 없다) */
export type SampleLook = Exclude<ProjectLook, 'custom'>;

/** 모든 모양이 읽는 맨 위 필드 */
const COMMON = [
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
	'timeline',
	'specs',
	'contributions',
	'icon',
] as const satisfies readonly (keyof LookSample)[];

/**
 * 모양마다 그 페이지가 읽는 맨 위 필드 (공통 필드 밖의 것). 예시는 이것을 모두 채운다.
 * (apps/safari/project/*Page.tsx와 그들이 쓰는 공용 조각에서 모았다. 대표 화면 image는 저장소·설정 도우미 모양이 읽지 않는다)
 */
export const LOOK_FIELDS: Record<SampleLook, readonly (keyof LookSample)[]> = {
	showcase: [...COMMON, 'image', 'gallery'],
	cinema: [...COMMON, 'image'],
	phone: [...COMMON, 'image', 'gallery'],
	horizontal: [...COMMON, 'image'],
	brutal: [...COMMON, 'image', 'chapters', 'structure', 'credits', 'gallery'],
	arcade: [...COMMON, 'image', 'controls', 'credits', 'art', 'gallery'],
	atelier: [...COMMON, 'image', 'chapters', 'gallery'],
	inbox: [...COMMON, 'image', 'chapters', 'gallery'],
	checklist: [...COMMON, 'image', 'chapters'],
	repo: [...COMMON, 'structure', 'credits', 'conventions'],
	dialogue: [...COMMON, 'image', 'chapters', 'controls', 'art', 'backdrop', 'gallery'],
	deck: [...COMMON, 'image', 'chapters', 'structure', 'credits', 'gallery'],
	assistant: [...COMMON],
};

/** 항목의 아이콘(Font Awesome)을 보여 주는 모양: 이 모양의 예시는 주요 기능에 아이콘을 단다 */
export const ICON_LOOKS: readonly SampleLook[] = ['showcase', 'cinema', 'brutal', 'inbox', 'repo', 'assistant'];

const WALL = (name: string) => `/imgs/wallpapers/${name}.jpg`;

/** 항목 하나 (제목, 설명, 자세히, 아이콘) */
const pt = (title: string, body: string, detail?: string, icon?: string): ProjectPoint => ({
	title,
	body,
	...(detail ? { detail } : {}),
	...(icon ? { icon } : {}),
});

const showcase: LookSample = {
	name: '북클럽 – 독서 모임 플랫폼',
	look: 'showcase',
	tagline: '같은 책을 읽는 사람들이 한자리에 모입니다.',
	description: '책을 고르고, 함께 읽을 날짜를 정하고, 읽은 만큼 이야기를 나누는 온라인 독서 모임 플랫폼',
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
		pt(
			'책으로 모임 찾기',
			'읽고 싶은 책을 검색하면 그 책을 함께 읽는 모임이 시작일 순으로 나옵니다.',
			'도서 정보는 공공 도서 데이터에서 가져오고, 모임마다 남은 자리와 읽는 속도를 함께 보여 줍니다. 원하는 모임이 없으면 그 자리에서 새 모임을 엽니다.',
			'fa-magnifying-glass'
		),
		pt(
			'읽은 만큼 열리는 토론',
			'내가 읽은 쪽수까지의 이야기만 보이게 해 결말을 미리 알게 되는 일을 막습니다.',
			'글마다 몇 쪽까지 읽고 쓴 글인지 표시하고, 내 진도보다 앞선 글은 접어 둡니다. 다 읽으면 접힌 글이 한꺼번에 펼쳐집니다.',
			'fa-book-open'
		),
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
		pt(
			'진도별 글 가리기',
			'글을 불러올 때 서버가 읽는 사람의 진도를 보고 앞선 글의 본문을 빼고 보냅니다.',
			'화면에서만 가리면 개발자 도구로 볼 수 있어, 응답에서부터 본문을 빼고 제목과 쪽수만 남깁니다.'
		),
		pt(
			'낙관적 업데이트',
			'밑줄과 댓글은 서버 응답을 기다리지 않고 바로 보이고, 실패하면 되돌립니다.',
			'TanStack Query의 캐시를 먼저 고치고 실패하면 이전 값으로 돌리며, 되돌린 이유를 짧은 알림으로 보여 줍니다.'
		),
		pt(
			'일정 투표 집계',
			'후보 날짜마다 되는 사람 수를 실시간으로 세어 가장 많은 날짜를 위로 올립니다.',
			'같은 수면 먼저 올린 날짜를 앞에 두어 순서가 흔들리지 않게 했습니다.'
		),
		pt(
			'접근성 점검',
			'키보드만으로 모임 찾기부터 글쓰기까지 할 수 있게 다듬었습니다.',
			'화면 읽기 프로그램으로 주요 흐름을 직접 따라가 보고, 초점 순서와 이름표를 고쳤습니다.'
		),
	],
	usage: [
		pt('둘러보기', '가입하지 않아도 열린 모임과 끝난 모임의 기록을 읽을 수 있습니다.'),
		pt('모임에 들어가기', '가입한 뒤 모임에 들어가면 진도를 적고 토론에 글을 남길 수 있습니다.'),
		pt('모임 열기', '책을 고르고 기간과 인원을 정하면 새 모임이 목록에 올라갑니다.'),
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
	],
};

const cinema: LookSample = {
	name: '포커스룸 – 집중 타이머 데스크톱 앱',
	look: 'cinema',
	tagline: '켜 두기만 하면 집중하는 시간이 됩니다.',
	description: '할 일을 고르고 타이머를 켜면 방해 알림을 잠재우고 집중한 시간을 기록하는 데스크톱 앱',
	context: '개인 프로젝트 (macOS·Windows 데스크톱 앱)',
	role: '기획, 디자인, 개발 전부',
	period: '2025.01.06 – 2025.03.28',
	language: 'TypeScript',
	stack: ['Electron', 'React', 'TypeScript', 'Vite', 'SQLite', 'Framer Motion', 'Vitest'],
	facts: [
		{ value: '25분', label: '기본 집중 시간' },
		{ value: '3만 회', label: '켜진 타이머' },
		{ value: '4.8점', label: '시범 사용자 만족도' },
	],
	highlights: [
		pt(
			'한 번에 하나만',
			'오늘의 할 일 가운데 하나를 고르면 화면 가운데에 그 일만 크게 남습니다.',
			'다른 할 일은 흐리게 접어 두고, 타이머가 끝나면 다음 일을 고르라고 묻습니다.',
			'fa-bullseye'
		),
		pt(
			'방해 금지',
			'타이머가 도는 동안 운영체제의 알림을 잠시 멈추고, 끝나면 놓친 알림을 모아 보여 줍니다.',
			'운영체제마다 다른 집중 모드를 감싸 한 가지 설정으로 다룹니다.',
			'fa-bell-slash'
		),
		pt(
			'작은 창 모드',
			'타이머만 남긴 작은 창을 화면 구석에 띄워 다른 앱 위에서도 남은 시간을 봅니다.',
			'작은 창은 언제나 맨 위에 떠 있고, 끌어서 원하는 구석에 붙입니다.',
			'fa-window-restore'
		),
		pt(
			'집중 기록',
			'하루와 한 주의 집중 시간을 막대로 보여 주고, 가장 잘 집중한 시간대를 알려 줍니다.',
			'기록은 내 컴퓨터에만 저장하고, 원하면 CSV로 내보냅니다.',
			'fa-chart-column'
		),
	],
	build: [
		pt(
			'정확한 타이머',
			'창이 가려져도 시간이 밀리지 않게 시작 시각을 기준으로 남은 시간을 다시 계산합니다.',
			'화면 갱신 주기에 기대지 않고 메인 프로세스에서 시작 시각을 저장해, 잠자기에서 깨어나도 시간이 맞습니다.'
		),
		pt(
			'가벼운 저장소',
			'기록은 SQLite 파일 하나에 두고, 화면은 필요한 날짜만 불러옵니다.',
			'한 해 치 기록도 바로 열리도록 날짜에 색인을 걸었습니다.'
		),
		pt(
			'자동 업데이트',
			'새 버전이 나오면 내려받아 두었다가 다음에 켤 때 조용히 바꿉니다.',
			'서명한 설치 파일만 받아들이고, 실패하면 이전 버전으로 돌아갑니다.'
		),
	],
	usage: [
		pt('설치', '운영체제에 맞는 설치 파일을 내려받아 엽니다.'),
		pt('첫 타이머', '할 일을 하나 적고 시작을 누르면 25분 타이머가 돌기 시작합니다.'),
	],
	timeline: [
		{ date: '2025.01.06', label: '아이디어와 화면 스케치' },
		{ date: '2025.01.20', label: '타이머와 할 일 목록' },
		{ date: '2025.02.03', label: '방해 금지와 작은 창 모드' },
		{ date: '2025.02.24', label: '집중 기록 차트' },
		{ date: '2025.03.10', label: '자동 업데이트와 설치 파일 서명' },
		{ date: '2025.03.28', label: '1.0 공개' },
	],
	specs: [
		{ label: '앱', value: 'Electron, React, TypeScript' },
		{ label: '저장', value: 'SQLite (better-sqlite3)' },
		{ label: '움직임', value: 'Framer Motion' },
		{ label: '시험', value: 'Vitest, Playwright' },
		{ label: '배포', value: 'GitHub Releases, 자동 업데이트' },
	],
	contributions: [
		'화면 설계와 아이콘 디자인',
		'타이머 엔진과 잠자기 뒤 시간 보정',
		'운영체제별 방해 금지 연동',
		'집중 기록 차트와 CSV 내보내기',
		'설치 파일 서명과 자동 업데이트',
	],
	icon: '/imgs/activity.svg',
	image: WALL('tahoe-dark'),
};

const phone: LookSample = {
	name: '모닝노트 – 아침 일기 앱',
	look: 'phone',
	tagline: '하루를 세 줄로 시작합니다.',
	description: '아침마다 세 가지 질문에 짧게 답하며 하루를 정리하는 모바일 일기 앱',
	context: '개인 프로젝트 (iOS·Android 앱)',
	role: '기획과 앱 개발',
	period: '2024.09.02 – 2024.11.29',
	language: 'TypeScript',
	stack: ['React Native', 'Expo', 'TypeScript', 'Zustand', 'SQLite', 'Reanimated'],
	facts: [
		{ value: '3줄', label: '하루에 쓰는 글' },
		{ value: '1분', label: '평균 쓰는 시간' },
		{ value: '21일', label: '이어 쓴 최장 기록 (평균)' },
	],
	highlights: [
		pt(
			'세 가지 질문',
			'오늘 기대되는 일, 고마운 일, 하나만 해낼 일을 차례로 묻습니다.',
			'질문은 요일마다 조금씩 바뀌고, 원하면 내 질문으로 바꿔 둡니다.'
		),
		pt(
			'아침 알림',
			'정한 시각에 알림이 오고, 알림을 누르면 바로 첫 질문 화면이 열립니다.',
			'주말에는 알림을 늦추거나 쉬도록 따로 정할 수 있습니다.'
		),
		pt(
			'이어 쓰기 달력',
			'쓴 날은 달력에 색이 칠해지고, 이어 쓴 날 수가 위에 보입니다.',
			'하루를 놓쳐도 기록이 사라지지 않게, 한 달에 한 번 쉬는 날을 둘 수 있습니다.'
		),
		pt(
			'한 해 돌아보기',
			'연말이면 그해의 답을 모아 가장 많이 쓴 낱말과 고마웠던 일을 보여 줍니다.',
			'모든 분석은 휴대폰 안에서만 하고 서버로 보내지 않습니다.'
		),
	],
	build: [
		pt(
			'오프라인 우선',
			'글은 휴대폰의 SQLite에 먼저 저장하고, 로그인하면 뒤에서 조용히 백업합니다.',
			'네트워크가 없어도 쓰기와 읽기가 모두 되고, 다시 연결되면 바뀐 것만 보냅니다.'
		),
		pt(
			'부드러운 넘김',
			'질문 사이를 손가락으로 넘길 때 Reanimated로 화면 움직임을 네이티브 쪽에서 처리합니다.',
			'느린 휴대폰에서도 넘김이 끊기지 않도록 무거운 계산을 넘김 뒤로 미뤘습니다.'
		),
		pt(
			'알림 예약',
			'알림은 기기에 미리 예약해 두어 앱을 열지 않아도 제때 옵니다.',
			'시간대를 옮기면 예약을 다시 계산합니다.'
		),
	],
	usage: [
		pt('처음 열 때', '알림 받을 시각을 고르면 바로 첫 일기를 쓸 수 있습니다.'),
		pt('백업', '로그인하면 휴대폰을 바꿔도 일기를 그대로 옮깁니다.'),
	],
	timeline: [
		{ date: '2024.09.02', label: '질문 고르기와 화면 스케치' },
		{ date: '2024.09.23', label: '쓰기 화면과 로컬 저장' },
		{ date: '2024.10.14', label: '아침 알림과 이어 쓰기 달력' },
		{ date: '2024.11.04', label: '백업과 로그인' },
		{ date: '2024.11.18', label: '한 해 돌아보기' },
		{ date: '2024.11.29', label: '스토어 출시' },
	],
	specs: [
		{ label: '앱', value: 'React Native, Expo, TypeScript' },
		{ label: '상태', value: 'Zustand' },
		{ label: '저장', value: 'expo-sqlite, 클라우드 백업' },
		{ label: '움직임', value: 'Reanimated, Gesture Handler' },
		{ label: '배포', value: 'EAS Build, 앱 스토어' },
	],
	contributions: [
		'질문 흐름과 화면 디자인',
		'로컬 저장과 백업 동기화',
		'알림 예약과 시간대 처리',
		'이어 쓰기 달력과 한 해 돌아보기',
	],
	icon: '/imgs/memo.png',
	image: WALL('ios-18-light'),
	gallery: [
		{ src: WALL('ios-18-light'), caption: '세 가지 질문' },
		{ src: WALL('ios-sky-light'), caption: '이어 쓰기 달력' },
		{ src: WALL('ios-celosia-light'), caption: '한 해 돌아보기' },
	],
};

const horizontal: LookSample = {
	name: '트립로그 – 여행 기록 지도',
	look: 'horizontal',
	tagline: '지나온 길이 한 장의 지도가 됩니다.',
	description: '사진과 메모를 올리면 여행한 길을 따라 지도 위에 이야기를 이어 붙이는 여행 기록 서비스',
	context: '팀 프로젝트 (3명, 웹 서비스)',
	role: '지도 화면과 경로 그리기 담당',
	period: '2024.07.01 – 2024.08.30',
	language: 'TypeScript',
	stack: ['Next.js', 'TypeScript', 'MapLibre GL', 'Tailwind CSS', 'Prisma', 'PostgreSQL', 'Vercel'],
	facts: [
		{ value: '8주', label: '개발 기간' },
		{ value: '2,400장', label: '시범 운영 중 올린 사진' },
		{ value: '38개 도시', label: '기록된 여행지' },
	],
	highlights: [
		pt(
			'사진으로 길 만들기',
			'사진을 올리면 찍은 장소와 시각을 읽어 지도 위에 순서대로 점을 찍고 선으로 잇습니다.',
			'위치 정보가 없는 사진은 앞뒤 사진의 시각으로 자리를 짐작하고, 직접 옮길 수도 있습니다.'
		),
		pt(
			'옆으로 넘기는 이야기',
			'하루마다 한 장씩 옆으로 넘기면 지도가 그날의 길로 따라갑니다.',
			'장마다 그날의 사진, 메모, 이동 거리가 함께 보입니다.'
		),
		pt(
			'함께 쓰는 여행',
			'동행을 초대하면 같은 여행에 각자의 사진과 메모를 더합니다.',
			'같은 장소의 사진은 한 점에 모아 누가 찍었는지 표시합니다.'
		),
		pt(
			'공유 링크',
			'여행이 끝나면 읽기 전용 링크로 가족과 친구에게 보여 줍니다.',
			'정확한 집 주소 근처는 자동으로 흐리게 처리합니다.'
		),
	],
	build: [
		pt(
			'사진 정보 읽기',
			'브라우저에서 사진의 EXIF를 읽어 위치와 시각만 뽑고, 원본 정보는 서버에 보내지 않습니다.',
			'큰 사진은 올리기 전에 브라우저에서 줄여 올리는 시간을 절반으로 줄였습니다.'
		),
		pt(
			'경로 단순화',
			'점이 많은 경로는 화면 배율에 맞춰 점 수를 줄여 지도를 가볍게 그립니다.',
			'Douglas–Peucker 알고리즘으로 모양은 지키고 점 수만 줄입니다.'
		),
		pt(
			'스크롤과 지도 맞추기',
			'옆으로 넘기는 위치에 맞춰 지도의 중심과 배율을 부드럽게 옮깁니다.',
			'장 사이에서는 두 날의 경계를 함께 보여 주어 이동이 이어져 보입니다.'
		),
	],
	usage: [
		pt('여행 만들기', '여행 이름과 기간을 적고 사진을 끌어다 놓습니다.'),
		pt('다듬기', '지도 위의 점을 옮기거나 메모를 더해 이야기를 고칩니다.'),
	],
	timeline: [
		{ date: '2024.07.01', label: '주제 정하기와 경쟁 서비스 조사' },
		{ date: '2024.07.15', label: '사진 올리기와 EXIF 읽기' },
		{ date: '2024.07.29', label: '지도 위 경로 그리기' },
		{ date: '2024.08.12', label: '옆으로 넘기는 이야기 화면' },
		{ date: '2024.08.23', label: '함께 쓰기와 공유 링크' },
		{ date: '2024.08.30', label: '발표' },
	],
	specs: [
		{ label: '화면', value: 'Next.js App Router, TypeScript, Tailwind CSS' },
		{ label: '지도', value: 'MapLibre GL, 벡터 타일' },
		{ label: '데이터', value: 'Prisma, PostgreSQL' },
		{ label: '파일', value: '객체 저장소, 브라우저에서 줄여 올리기' },
		{ label: '배포', value: 'Vercel' },
	],
	contributions: [
		'지도 화면과 경로 그리기',
		'사진 위치 읽기와 짐작 규칙',
		'옆으로 넘기는 이야기 화면과 지도 연동',
		'공유 링크의 위치 흐리기',
	],
	icon: '/imgs/photos.png',
	image: WALL('bigsur-light'),
};

const brutal: LookSample = {
	name: '포스터랩 – 포스터 만들기 도구',
	look: 'brutal',
	tagline: '글자만으로 포스터를 만듭니다.',
	description: '문구를 적고 격자와 글꼴을 고르면 인쇄용 포스터를 바로 만들어 주는 웹 디자인 도구',
	context: '개인 프로젝트 (웹 도구)',
	role: '기획, 디자인, 개발 전부',
	period: '2025.05.05 – 2025.07.18',
	language: 'TypeScript',
	stack: ['SvelteKit', 'TypeScript', 'Canvas API', 'opentype.js', 'PDF-lib', 'Vitest'],
	facts: [
		{ value: '12가지', label: '격자 틀' },
		{ value: '24종', label: '쓸 수 있는 무료 글꼴' },
		{ value: 'A0까지', label: '인쇄 크기' },
	],
	highlights: [
		pt(
			'격자 먼저',
			'열과 행을 고르면 글자가 격자 칸에 맞춰 자리를 잡습니다.',
			'칸을 끌어 합치거나 나누고, 글자 크기는 칸 높이에 맞춰 자동으로 바뀝니다.',
			'fa-table-cells'
		),
		pt(
			'굵은 글꼴',
			'제목용 굵은 글꼴과 본문용 고정폭 글꼴을 짝지어 고릅니다.',
			'글꼴마다 실제 글자 모양을 미리 보여 주고, 한글과 영문 짝을 따로 정합니다.',
			'fa-font'
		),
		pt(
			'흐르는 띠',
			'포스터 위아래에 같은 문구가 끝없이 흐르는 띠를 붙입니다.',
			'인쇄용으로 내보내면 띠는 한 바퀴만 펼쳐서 넣습니다.',
			'fa-arrows-left-right'
		),
		pt(
			'인쇄 그대로 내보내기',
			'재단 여백과 재단선을 넣은 PDF로 내보내 인쇄소에 바로 맡깁니다.',
			'글자는 윤곽선으로 바꿔 넣어 인쇄소에 글꼴이 없어도 그대로 나옵니다.',
			'fa-print'
		),
	],
	build: [
		pt(
			'글자 맞추기',
			'opentype.js로 글자의 실제 폭을 재어 칸에 꼭 맞는 크기를 이분 탐색으로 찾습니다.',
			'글자마다 폭을 다시 재지 않도록 글꼴별로 폭 표를 만들어 둡니다.'
		),
		pt(
			'한 장의 캔버스',
			'편집 화면과 내보내기가 같은 그리기 함수를 써서 보이는 것과 인쇄되는 것이 같습니다.',
			'화면은 Canvas로, 내보내기는 같은 명령을 PDF로 옮겨 그립니다.'
		),
		pt(
			'되돌리기',
			'모든 바꿈을 명령으로 쌓아 몇 단계든 되돌리고 다시 합니다.',
			'명령 묶음을 주소에 담아 지금 포스터를 링크로 나눕니다.'
		),
	],
	usage: [
		pt('새 포스터', '크기와 격자를 고르고 문구를 적습니다.'),
		pt('내보내기', 'PNG는 화면용, PDF는 인쇄용으로 내려받습니다.'),
		pt('나누기', '주소를 복사하면 같은 포스터를 다른 사람이 이어서 고칩니다.'),
	],
	timeline: [
		{ date: '2025.05.05', label: '포스터 시안 수집과 격자 규칙' },
		{ date: '2025.05.19', label: '격자 편집기' },
		{ date: '2025.06.02', label: '글꼴 고르기와 글자 맞추기' },
		{ date: '2025.06.23', label: '흐르는 띠와 되돌리기' },
		{ date: '2025.07.07', label: '인쇄용 PDF 내보내기' },
		{ date: '2025.07.18', label: '공개' },
	],
	specs: [
		{ label: '화면', value: 'SvelteKit, TypeScript' },
		{ label: '그리기', value: 'Canvas API' },
		{ label: '글꼴', value: 'opentype.js, 무료 글꼴 24종' },
		{ label: '내보내기', value: 'PDF-lib, PNG' },
		{ label: '시험', value: 'Vitest, 화면 비교 시험' },
	],
	contributions: [
		'격자 편집기와 글자 맞추기',
		'편집과 내보내기가 함께 쓰는 그리기 함수',
		'인쇄용 PDF와 재단선',
		'주소로 나누는 포스터',
	],
	chapters: [
		{
			title: '왜 글자만',
			lead: '그림 없이 글자와 격자만으로도 힘 있는 포스터를 만들 수 있다는 것을 보여 주고 싶었습니다.',
			points: [
				pt('제약이 만든 모양', '고를 수 있는 것을 격자와 글꼴로 줄이자 누가 만들어도 정돈된 결과가 나왔습니다.'),
				pt('빠른 시안', '문구만 바꿔 여러 시안을 한꺼번에 뽑아 비교합니다.'),
			],
		},
		{
			title: '인쇄소와 일하기',
			lead: '화면에서 예쁜 것과 종이에서 예쁜 것은 다릅니다. 인쇄소의 요청을 그대로 기능으로 옮겼습니다.',
			points: [
				pt('재단 여백', '가장자리 3mm를 더 그려 잘려도 흰 줄이 남지 않습니다.'),
				pt('색 확인', '인쇄에서 탁해지는 색을 미리 알려 줍니다.'),
			],
		},
	],
	structure: `poster-lab/
├── src/
│   ├── lib/
│   │   ├── grid/        # 격자 계산
│   │   ├── type/        # 글자 맞추기
│   │   └── export/      # PNG·PDF 내보내기
│   └── routes/
│       ├── +page.svelte
│       └── edit/
├── static/fonts/
└── tests/`,
	credits: [
		{ role: '제목 글꼴', name: '가상 고딕 Black', by: '가상 글꼴 공방', note: 'SIL 오픈 폰트 라이선스' },
		{ role: '본문 글꼴', name: '가상 모노', by: '가상 글꼴 공방', note: 'SIL 오픈 폰트 라이선스' },
		{ role: '아이콘', name: 'Font Awesome Free', by: 'Fonticons', href: 'https://fontawesome.com' },
	],
	icon: '/imgs/files.svg',
	image: WALL('highsierra'),
	gallery: [
		{ src: WALL('highsierra'), caption: '격자 편집기' },
		{ src: WALL('ios-kaleidoscope-light'), caption: '글꼴 고르기' },
		{ src: WALL('ios-earth'), caption: '인쇄용 내보내기' },
	],
};

const arcade: LookSample = {
	name: '네온 러너 – 리듬 달리기 게임',
	look: 'arcade',
	tagline: '박자에 맞춰 뛰고, 미끄러지고, 날아오르세요.',
	description: '음악의 박자에 맞춰 장애물을 넘으며 끝없이 달리는 네온 스타일 리듬 러너 게임',
	context: '개인 프로젝트 (웹 게임)',
	role: '게임 기획, 프로그래밍, 레벨 디자인',
	period: '2024.12.02 – 2025.02.14',
	language: 'TypeScript',
	stack: ['Phaser 3', 'TypeScript', 'Vite', 'Web Audio API', 'Howler.js', 'Firebase'],
	facts: [
		{ value: '120 BPM', label: '첫 판의 박자' },
		{ value: '8곡', label: '달릴 수 있는 음악' },
		{ value: '60fps', label: '느린 노트북에서도' },
	],
	highlights: [
		pt(
			'박자가 곧 길',
			'장애물은 음악의 박자에서 나오므로 박자에 맞춰 누르면 저절로 넘어집니다.',
			'곡마다 미리 뽑아 둔 박자 지도를 읽어 장애물을 놓고, 빠른 곡일수록 길이 촘촘해집니다.'
		),
		pt(
			'세 가지 동작',
			'뛰기, 미끄러지기, 날아오르기 세 가지만으로 모든 장애물을 넘습니다.',
			'동작마다 맞는 박자에 누르면 PERFECT, 조금 어긋나면 GOOD으로 점수가 달라집니다.'
		),
		pt(
			'콤보와 네온',
			'박자를 이어 맞추면 콤보가 쌓이고 화면의 네온이 더 밝게 빛납니다.',
			'한 번 놓치면 콤보가 끊기고 화면이 잠깐 흔들립니다.'
		),
		pt(
			'랭킹',
			'곡마다 최고 점수를 겨루는 랭킹이 있습니다.',
			'점수는 서버가 입력 기록으로 다시 계산해 조작을 막습니다.'
		),
	],
	build: [
		pt(
			'오디오 시계',
			'화면 프레임이 아니라 Web Audio의 시계로 박자를 재어 음악과 장애물이 어긋나지 않습니다.',
			'입력 지연을 기기마다 재는 보정 화면을 처음에 한 번 보여 줍니다.'
		),
		pt(
			'물체 재사용',
			'장애물과 불꽃 효과를 미리 만들어 두고 돌려 써서 끊김을 없앴습니다.',
			'화면 밖으로 나간 물체는 지우지 않고 다음 자리로 옮깁니다.'
		),
		pt(
			'CRT 효과',
			'주사선과 화면 번짐을 셰이더 하나로 그려 옛날 오락실 느낌을 냅니다.',
			'설정에서 효과를 끄면 느린 기기에서도 부드럽게 돕니다.'
		),
	],
	usage: [
		pt('시작', '곡을 고르고 아무 키나 누르면 달리기 시작합니다.'),
		pt('연습', '연습 모드에서는 넘어져도 계속 달리며 박자를 익힙니다.'),
	],
	timeline: [
		{ date: '2024.12.02', label: '게임 규칙과 조작 정하기' },
		{ date: '2024.12.16', label: '달리기와 세 가지 동작' },
		{ date: '2025.01.06', label: '박자 지도와 장애물 배치' },
		{ date: '2025.01.20', label: '콤보와 네온 효과' },
		{ date: '2025.02.03', label: '랭킹 서버' },
		{ date: '2025.02.14', label: '공개' },
	],
	specs: [
		{ label: '엔진', value: 'Phaser 3, TypeScript' },
		{ label: '소리', value: 'Web Audio API, Howler.js' },
		{ label: '그래픽', value: 'WebGL 셰이더 (CRT 효과)' },
		{ label: '서버', value: 'Firebase Functions, Firestore' },
		{ label: '배포', value: '정적 호스팅' },
	],
	contributions: [
		'게임 규칙과 레벨 디자인',
		'오디오 시계와 입력 지연 보정',
		'장애물 배치 알고리즘',
		'CRT 셰이더와 네온 효과',
		'점수를 다시 계산하는 랭킹 서버',
	],
	controls: [
		{ keys: ['Space', '↑'], label: '뛰기' },
		{ keys: ['↓'], label: '미끄러지기' },
		{ keys: ['Shift'], label: '날아오르기' },
		{ keys: ['Esc'], label: '잠깐 멈추기' },
	],
	credits: [
		{ role: '음악', name: '가상 신스웨이브 모음', by: '가상 작곡가', note: '게임 안 사용 허락' },
		{ role: '효과음', name: '레트로 효과음 묶음', by: '가상 사운드 공방', note: 'CC0' },
		{ role: '글꼴', name: '가상 픽셀 글꼴', by: '가상 글꼴 공방', note: 'SIL 오픈 폰트 라이선스' },
	],
	icon: '/imgs/music.png',
	image: WALL('ios-kaleidoscope-dark'),
	art: WALL('ios-kaleidoscope-dark'),
	gallery: [
		{ src: WALL('ios-kaleidoscope-dark'), caption: '첫 판' },
		{ src: WALL('ios-celosia-dark'), caption: '콤보' },
		{ src: WALL('ios-sky-dark'), caption: '랭킹' },
	],
};

const atelier: LookSample = {
	name: '온기 – 동네 공방 예약 서비스',
	look: 'atelier',
	tagline: '손으로 만드는 하루를 예약합니다.',
	description: '동네의 작은 도자기·목공·뜨개 공방을 찾아 원데이 클래스를 예약하는 서비스',
	context: '팀 프로젝트 (5명, 웹 서비스)',
	role: '프론트엔드, 예약 흐름과 공방 관리자 화면 담당',
	period: '2025.08.04 – 2025.11.21',
	language: 'TypeScript',
	stack: ['Next.js', 'TypeScript', 'Tailwind CSS', 'React Hook Form', 'Zod', 'Supabase', 'Vercel'],
	facts: [
		{ value: '46곳', label: '함께한 동네 공방' },
		{ value: '1,300건', label: '시범 운영 중 예약' },
		{ value: '3번', label: '눌러서 끝나는 예약' },
	],
	highlights: [
		pt(
			'가까운 공방',
			'지금 있는 곳에서 걸어갈 수 있는 공방부터 사진과 함께 보여 줍니다.',
			'수업 종류와 요일, 가격으로 거르고, 처음 해 보는 사람에게 맞는 수업에는 따로 표시를 붙입니다.'
		),
		pt(
			'세 번에 끝나는 예약',
			'날짜, 인원, 결제 세 단계로 예약을 마칩니다.',
			'남은 자리는 실시간으로 바뀌고, 결제하는 동안 자리를 잠시 잡아 둡니다.'
		),
		pt(
			'작업 노트',
			'수업이 끝나면 공방이 작품 사진과 다음에 해 볼 것을 노트로 남겨 줍니다.',
			'노트는 내 기록에 모여 손으로 만든 것들의 작은 앨범이 됩니다.'
		),
		pt(
			'공방 관리자 화면',
			'공방은 수업 시간표와 예약을 한 화면에서 관리합니다.',
			'휴대폰으로도 고치기 쉽게 큰 단추와 짧은 흐름으로 만들었습니다.'
		),
	],
	build: [
		pt(
			'자리 잡아 두기',
			'결제를 시작하면 데이터베이스 행 잠금으로 자리를 10분 동안 잡아 둡니다.',
			'시간이 지나면 예약하지 않은 자리를 돌려놓아 두 사람이 같은 자리를 사는 일을 막습니다.'
		),
		pt(
			'폼 검사 한 곳에서',
			'예약 폼의 규칙을 Zod 스키마 하나로 적고 화면과 서버가 함께 씁니다.',
			'틀린 칸에는 바로 이유를 보여 주고, 서버에서도 같은 규칙으로 한 번 더 검사합니다.'
		),
		pt(
			'느린 사진 줄이기',
			'공방 사진은 올릴 때 여러 크기로 만들어 화면 폭에 맞는 것만 받습니다.',
			'첫 화면에 보이는 사진만 먼저 받고 나머지는 스크롤할 때 받습니다.'
		),
	],
	usage: [
		pt('수업 찾기', '가입하지 않아도 공방과 수업을 둘러볼 수 있습니다.'),
		pt('예약하기', '로그인한 뒤 날짜와 인원을 고르고 결제합니다.'),
		pt('공방 등록', '공방은 사업자 정보를 적고 승인을 받으면 수업을 올립니다.'),
	],
	timeline: [
		{ date: '2025.08.04', label: '공방 인터뷰와 문제 정의' },
		{ date: '2025.08.25', label: '화면 설계와 디자인 체계' },
		{ date: '2025.09.15', label: '공방 찾기와 수업 상세' },
		{ date: '2025.10.06', label: '예약과 결제 흐름' },
		{ date: '2025.10.27', label: '공방 관리자 화면' },
		{ date: '2025.11.10', label: '시범 운영' },
		{ date: '2025.11.21', label: '발표와 회고' },
	],
	specs: [
		{ label: '화면', value: 'Next.js App Router, TypeScript, Tailwind CSS' },
		{ label: '폼', value: 'React Hook Form, Zod' },
		{ label: '데이터', value: 'Supabase (PostgreSQL, 행 단위 보안)' },
		{ label: '결제', value: '결제 대행사 연동 (시험 모드)' },
		{ label: '배포', value: 'Vercel' },
	],
	contributions: [
		'예약 흐름과 자리 잡아 두기',
		'공방 관리자 화면',
		'폼 검사 규칙과 오류 문구',
		'사진 크기별 내려받기',
		'디자인 체계의 글꼴과 여백 규칙',
	],
	chapters: [
		{
			title: '공방 사장님과 함께',
			lead: '공방 열두 곳을 찾아가 예약을 어떻게 받는지 들었습니다. 전화와 메신저로 받던 예약을 한곳에 모으는 것이 첫 목표였습니다.',
			facts: [
				{ value: '12곳', label: '찾아간 공방' },
				{ value: '하루 40분', label: '줄어든 예약 응대' },
			],
			points: [
				pt('전화 대신 알림', '새 예약과 취소를 휴대폰 알림으로 받습니다.'),
				pt('노쇼 줄이기', '수업 전날 확인 메시지를 보내 빈자리를 줄였습니다.'),
			],
			image: { src: WALL('sequoia-light'), alt: '공방 관리자 화면' },
		},
		{
			title: '조용한 디자인',
			lead: '작품이 주인공이 되도록 화면은 큰 여백과 차분한 세리프 글꼴로 물러서 있게 했습니다.',
			points: [
				pt('사진 먼저', '수업 상세는 작품 사진을 가장 크게 두고 글은 옆으로 비켰습니다.'),
				pt('느린 드러남', '스크롤하면 글이 천천히 나타나 읽는 속도를 늦춥니다.'),
			],
			image: { src: WALL('sonoma-light'), alt: '수업 상세 화면' },
		},
	],
	icon: '/imgs/photos.png',
	image: WALL('sequoia-light'),
	gallery: [
		{ src: WALL('sequoia-light'), caption: '가까운 공방' },
		{ src: WALL('sonoma-light'), caption: '수업 상세' },
		{ src: WALL('ventura-light'), caption: '작업 노트' },
	],
};

const inbox: LookSample = {
	name: '주간 레터 – 뉴스레터 발행 도구',
	look: 'inbox',
	tagline: '한 주에 한 번, 구독자의 받은편지함으로.',
	description: '글을 쓰고 구독자를 모으고 매주 정한 시각에 뉴스레터를 보내는 1인 발행 도구',
	context: '개인 프로젝트 (웹 서비스)',
	role: '기획과 풀스택 개발',
	period: '2025.02.03 – 2025.05.30',
	language: 'TypeScript',
	stack: ['Remix', 'TypeScript', 'Tailwind CSS', 'Prisma', 'PostgreSQL', 'BullMQ', 'Redis', 'MJML'],
	facts: [
		{ value: '9,200명', label: '모인 구독자' },
		{ value: '48%', label: '평균 열람률' },
		{ value: '매주 금 8시', label: '기본 발송 시각' },
	],
	highlights: [
		pt(
			'메일처럼 쓰기',
			'익숙한 메일 쓰기 화면에서 제목과 본문을 쓰면 그대로 뉴스레터가 됩니다.',
			'본문은 마크다운으로 쓰고, 오른쪽에 휴대폰과 컴퓨터에서 보일 모양을 함께 보여 줍니다.',
			'fa-pen-to-square'
		),
		pt(
			'구독 페이지',
			'내 뉴스레터의 소개와 지난 호를 담은 구독 페이지가 자동으로 생깁니다.',
			'구독하면 확인 메일을 보내고, 확인한 사람에게만 보냅니다.',
			'fa-user-plus'
		),
		pt(
			'예약 발송',
			'날짜와 시각을 정해 두면 그때 구독자 모두에게 나눠 보냅니다.',
			'한꺼번에 보내지 않고 조금씩 나눠 보내 스팸으로 분류되는 일을 줄입니다.',
			'fa-clock'
		),
		pt(
			'읽힘 보기',
			'호마다 열람률과 많이 누른 링크를 보여 줍니다.',
			'구독자 한 사람 한 사람을 따라가지 않고 모아서만 셉니다.',
			'fa-chart-line'
		),
		pt(
			'지난 호 보관함',
			'보낸 뉴스레터는 웹 페이지로도 남아 링크로 나눌 수 있습니다.',
			'보관함은 검색과 태그로 찾습니다.',
			'fa-box-archive'
		),
	],
	build: [
		pt(
			'발송 대기열',
			'BullMQ 대기열에 받는 사람을 묶음으로 넣고, 실패한 묶음만 다시 보냅니다.',
			'발송 서버가 멈췄다 켜져도 보낸 사람에게 다시 보내지 않도록 묶음마다 보낸 표시를 남깁니다.'
		),
		pt(
			'메일 템플릿',
			'MJML로 템플릿을 짜서 메일 프로그램마다 모양이 깨지지 않게 했습니다.',
			'다크 모드에서도 글자가 보이도록 색을 두 벌 준비했습니다.'
		),
		pt(
			'구독 해지 한 번에',
			'메일 맨 아래의 링크 한 번이면 확인 없이 바로 해지됩니다.',
			'메일 프로그램의 구독 해지 단추도 지원합니다.'
		),
	],
	usage: [
		pt('뉴스레터 만들기', '이름과 소개를 적으면 구독 페이지가 생깁니다.'),
		pt('첫 호 보내기', '글을 쓰고 시험 메일을 받아 본 뒤 예약합니다.'),
	],
	timeline: [
		{ date: '2025.02.03', label: '기획과 메일 템플릿 조사' },
		{ date: '2025.02.24', label: '쓰기 화면과 미리 보기' },
		{ date: '2025.03.17', label: '구독 페이지와 확인 메일' },
		{ date: '2025.04.07', label: '발송 대기열과 예약 발송' },
		{ date: '2025.04.28', label: '열람률과 링크 통계' },
		{ date: '2025.05.30', label: '공개' },
	],
	specs: [
		{ label: '화면', value: 'Remix, TypeScript, Tailwind CSS' },
		{ label: '데이터', value: 'Prisma, PostgreSQL' },
		{ label: '발송', value: 'BullMQ, Redis, 메일 발송 서비스' },
		{ label: '템플릿', value: 'MJML, 마크다운' },
		{ label: '배포', value: '컨테이너 호스팅' },
	],
	contributions: [
		'메일 쓰기 화면과 미리 보기',
		'발송 대기열과 재시도',
		'메일 템플릿과 다크 모드 색',
		'열람 통계',
		'구독과 해지 흐름',
	],
	chapters: [
		{
			title: '스팸함에 가지 않기',
			lead: '좋은 글도 스팸함에 들어가면 읽히지 않습니다. 발송 평판을 지키는 장치를 하나씩 더했습니다.',
			points: [
				pt('도메인 인증', 'SPF, DKIM, DMARC 설정을 안내하고 맞는지 확인해 줍니다.'),
				pt('반송 정리', '계속 반송되는 주소는 자동으로 구독을 멈춥니다.'),
			],
		},
		{
			title: '작게 운영하기',
			lead: '혼자 운영해도 부담이 없도록 비용과 손이 덜 가는 쪽을 골랐습니다.',
			points: [
				pt('서버 한 대', '화면과 발송 작업을 한 서버에서 돌리고, 대기열만 Redis에 둡니다.'),
				pt('알림 하나', '발송이 실패하면 운영자에게 메일 한 통만 보냅니다.'),
			],
		},
	],
	icon: '/imgs/mail.png',
	image: WALL('ventura-light'),
	gallery: [
		{ src: WALL('ventura-light'), caption: '쓰기 화면' },
		{ src: WALL('bigsur-light'), caption: '구독 페이지' },
		{ src: WALL('sonoma-light'), caption: '열람 통계' },
	],
};

const checklist: LookSample = {
	name: '해냄 – 습관과 할 일 앱',
	look: 'checklist',
	tagline: '오늘 할 일을 하나씩 지워 나갑니다.',
	description: '할 일과 매일 하는 습관을 한 목록에 두고, 끝낸 것을 지우며 하루를 정리하는 앱',
	context: '개인 프로젝트 (웹 앱, PWA)',
	role: '기획, 디자인, 개발 전부',
	period: '2024.04.01 – 2024.06.14',
	language: 'TypeScript',
	stack: ['Vue 3', 'TypeScript', 'Pinia', 'Vite', 'IndexedDB', 'Workbox'],
	facts: [
		{ value: '0초', label: '켜고 바로 쓰기 (오프라인)' },
		{ value: '5,600개', label: '지워진 할 일' },
		{ value: '87%', label: '습관을 이어 간 비율' },
	],
	highlights: [
		pt(
			'한 목록에 할 일과 습관',
			'오늘 할 일 위에 매일 하는 습관이 함께 놓여 하루치 목록이 하나로 보입니다.',
			'습관은 매일 아침 새로 채워지고, 할 일은 끝낼 때까지 남아 있습니다.'
		),
		pt(
			'지우는 맛',
			'체크하면 줄이 그어지며 아래로 내려가고, 다 지우면 작은 축하가 나옵니다.',
			'잘못 눌렀으면 바로 아래 되돌리기 단추로 살립니다.'
		),
		pt(
			'빠른 적기',
			'한 줄로 적으면 날짜와 반복을 알아서 읽습니다.',
			'예를 들어 "매주 월 운동"이라고 적으면 매주 월요일에 반복되는 습관이 됩니다.'
		),
		pt(
			'주간 돌아보기',
			'일요일 저녁에 한 주 동안 끝낸 일과 이어 간 습관을 모아 보여 줍니다.',
			'미룬 일은 다음 주로 옮길지 지울지 한 번에 고릅니다.'
		),
	],
	build: [
		pt(
			'오프라인 앱',
			'Workbox로 화면을 캐시하고 할 일은 IndexedDB에 두어 인터넷 없이도 열립니다.',
			'홈 화면에 추가하면 앱처럼 전체 화면으로 열립니다.'
		),
		pt(
			'날짜 읽기',
			'한국어 날짜 표현을 읽는 작은 해석기를 만들어 "다음 주 화요일" 같은 말을 날짜로 바꿉니다.',
			'읽은 결과를 적는 칸 아래에 미리 보여 주어 잘못 읽으면 바로 고칩니다.'
		),
		pt(
			'부드러운 정렬',
			'체크한 줄이 아래로 내려갈 때 FLIP 방식으로 움직여 순서 바뀜이 눈에 보입니다.',
			'움직임 줄이기를 켠 사람에게는 바로 자리를 바꿉니다.'
		),
	],
	usage: [
		pt('첫 할 일', '맨 위 칸에 할 일을 적고 Enter를 누릅니다.'),
		pt('습관 만들기', '"매일"이나 "매주"로 시작하면 습관이 됩니다.'),
	],
	timeline: [
		{ date: '2024.04.01', label: '쓰던 할 일 앱의 불편 정리' },
		{ date: '2024.04.15', label: '목록과 체크 움직임' },
		{ date: '2024.05.06', label: '날짜 읽기 해석기' },
		{ date: '2024.05.20', label: '오프라인 저장과 PWA' },
		{ date: '2024.06.03', label: '주간 돌아보기' },
		{ date: '2024.06.14', label: '공개' },
	],
	specs: [
		{ label: '화면', value: 'Vue 3, TypeScript, Vite' },
		{ label: '상태', value: 'Pinia' },
		{ label: '저장', value: 'IndexedDB (idb)' },
		{ label: '오프라인', value: 'Workbox, 웹 앱 매니페스트' },
		{ label: '시험', value: 'Vitest' },
	],
	contributions: ['목록 화면과 체크 움직임', '한국어 날짜 해석기', '오프라인 저장과 PWA 설정', '주간 돌아보기 화면'],
	chapters: [
		{
			title: '다음에 할 일',
			points: [
				pt('함께 쓰는 목록', '가족이나 룸메이트와 장보기 목록을 함께 씁니다.'),
				pt('위젯', '휴대폰 홈 화면에서 오늘 할 일을 바로 지웁니다.'),
				pt('기기 사이 동기화', '로그인하면 컴퓨터와 휴대폰의 목록을 맞춥니다.'),
			],
		},
		{
			title: '배운 것',
			points: [
				pt('작게 시작하기', '기능을 줄이고 한 목록에 집중하자 매일 쓰게 되었습니다.'),
				pt('움직임의 역할', '체크 움직임 하나가 끝냈다는 느낌을 크게 바꿨습니다.'),
			],
		},
	],
	icon: '/imgs/shortcuts.svg',
	image: WALL('ios-sky-light'),
};

const repo: LookSample = {
	name: '알고리즘 100일 – 학습 기록 저장소',
	look: 'repo',
	tagline: '하루 한 문제, 100일 동안 쌓은 풀이와 정리',
	description: '100일 동안 매일 알고리즘 문제를 풀고 풀이와 배운 점을 커밋으로 남긴 학습 기록 저장소',
	context: '개인 학습 (스터디 4명과 함께)',
	role: '문제 고르기와 주간 정리 담당',
	period: '2024.01.02 – 2024.04.10',
	language: 'Python',
	stack: ['Python', 'pytest', 'GitHub Actions', 'Markdown', 'Mermaid', 'pre-commit'],
	facts: [
		{ value: '100일', label: '하루도 빼먹지 않은 커밋' },
		{ value: '132문제', label: '푼 문제' },
		{ value: '14개', label: '정리한 알고리즘 주제' },
	],
	highlights: [
		pt(
			'주제별 폴더',
			'문제를 주제별 폴더에 두고, 폴더마다 그 주제의 핵심을 README로 정리했습니다.',
			'같은 주제의 문제를 쉬운 것부터 이어 풀어 개념이 쌓이게 했습니다.',
			'fa-folder-tree'
		),
		pt(
			'풀이마다 시험',
			'모든 풀이에 예제 입력으로 도는 pytest 시험을 붙였습니다.',
			'틀렸던 입력은 시험에 더해 같은 실수를 다시 하지 않게 했습니다.',
			'fa-vial'
		),
		pt(
			'커밋 규칙',
			'커밋 메시지 앞에 solve, review, docs 같은 타입을 붙여 기록을 찾기 쉽게 했습니다.',
			'타입별로 모아 보면 언제 새 문제를 풀고 언제 복습했는지 보입니다.',
			'fa-tags'
		),
		pt(
			'주간 정리',
			'매주 일요일에 그 주에 푼 문제와 배운 점을 한 편의 글로 남겼습니다.',
			'정리 글에는 다시 풀 문제 목록을 붙여 다음 주 복습으로 이었습니다.',
			'fa-book'
		),
	],
	build: [
		pt(
			'자동 시험',
			'GitHub Actions가 커밋마다 모든 풀이의 시험을 돌립니다.',
			'시간 제한을 넘는 풀이는 실패로 표시해 더 빠른 방법을 찾게 했습니다.'
		),
		pt(
			'커밋 전 검사',
			'pre-commit으로 형식 검사와 커밋 메시지 검사를 커밋 전에 돌립니다.',
			'규칙에 맞지 않는 메시지는 커밋되지 않습니다.'
		),
		pt(
			'진도 표',
			'README의 진도 표를 스크립트가 폴더를 세어 자동으로 고칩니다.',
			'주제별로 푼 문제 수와 난이도 분포를 표로 보여 줍니다.'
		),
	],
	usage: [
		pt('풀이 보기', '주제 폴더에 들어가 문제 번호의 파일을 엽니다.'),
		pt('시험 돌리기', '저장소를 받아 pytest를 실행하면 모든 풀이를 검사합니다.'),
	],
	timeline: [
		{ date: '2024.01.02', label: 'chore: 저장소와 시험 틀 만들기' },
		{ date: '2024.01.15', label: 'solve: 정렬과 이분 탐색 20문제' },
		{ date: '2024.02.01', label: 'solve: 그래프 탐색 (BFS·DFS)' },
		{ date: '2024.02.20', label: 'docs: 동적 계획법 정리' },
		{ date: '2024.03.11', label: 'review: 틀린 문제 다시 풀기' },
		{ date: '2024.03.28', label: 'solve: 최단 경로와 최소 신장 트리' },
		{ date: '2024.04.10', label: 'docs: 100일 회고' },
	],
	specs: [
		{ label: '언어', value: 'Python 3.12' },
		{ label: '시험', value: 'pytest, 시간 제한 플러그인' },
		{ label: '자동화', value: 'GitHub Actions, pre-commit' },
		{ label: '문서', value: 'Markdown, Mermaid 도식' },
	],
	contributions: [
		'매주 풀 문제 고르기',
		'주간 정리 글 14편',
		'자동 시험과 커밋 전 검사 설정',
		'진도 표를 고치는 스크립트',
	],
	structure: `algorithm-100days/
├── sort/
├── binary-search/
├── graph/
│   ├── bfs/
│   └── dfs/
├── dp/
├── shortest-path/
├── weekly/          # 주간 정리
├── scripts/progress.py
└── tests/`,
	credits: [
		{ role: '문제', name: '가상 알고리즘 문제집', by: '가상 출판사', note: '문제 번호만 적고 본문은 옮기지 않았다' },
		{ role: '도식', name: 'Mermaid', by: 'Mermaid 기여자들', href: 'https://mermaid.js.org' },
	],
	conventions: [
		{ type: 'solve', description: '새 문제 풀이' },
		{ type: 'review', description: '푼 문제 다시 풀기' },
		{ type: 'docs', description: '정리 글' },
		{ type: 'test', description: '시험 더하기' },
		{ type: 'chore', description: '설정과 스크립트' },
	],
	icon: '/imgs/terminal.svg',
	image: '',
};

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

const deck: LookSample = {
	name: '스테이션 – 사내 협업 플랫폼',
	look: 'deck',
	tagline: '흩어진 대화와 문서를 한 정거장에 모읍니다.',
	description: '메신저, 문서, 일정, 업무 보드를 한 화면에 묶은 중소 규모 팀을 위한 사내 협업 플랫폼',
	context: '팀 프로젝트 (8명, 웹 서비스와 데스크톱 앱)',
	role: '프론트엔드 파트장, 실시간 편집과 디자인 시스템 담당',
	period: '2025.09.01 – 2026.02.27',
	language: 'TypeScript',
	stack: ['React', 'TypeScript', 'Vite', 'Yjs', 'WebSocket', 'NestJS', 'PostgreSQL', 'Redis', 'Electron', 'Storybook'],
	facts: [
		{ value: '8명', label: '함께 만든 팀' },
		{ value: '26주', label: '개발 기간' },
		{ value: '40개 팀', label: '시범 도입' },
		{ value: '0.2초', label: '동시 편집 반영' },
	],
	highlights: [
		pt(
			'대화에서 문서로',
			'메신저의 대화를 골라 바로 문서로 옮기고, 문서에서 다시 대화로 돌아갑니다.',
			'옮긴 문서에는 원래 대화의 링크가 남아 결정이 어떻게 나왔는지 따라갈 수 있습니다.'
		),
		pt(
			'함께 쓰는 문서',
			'여러 사람이 같은 문서를 동시에 고쳐도 서로의 글이 덮이지 않습니다.',
			'누가 어디를 고치는지 이름표 달린 커서로 보이고, 오프라인에서 고친 것도 다시 연결되면 합쳐집니다.'
		),
		pt(
			'업무 보드',
			'할 일을 카드로 만들어 칸 사이를 끌어 옮기고, 카드마다 대화와 문서를 붙입니다.',
			'보드의 바뀜은 팀 채널에 짧은 알림으로 올라갑니다.'
		),
		pt(
			'한 번의 검색',
			'대화, 문서, 카드, 파일을 검색창 하나로 찾습니다.',
			'내가 볼 수 있는 것만 결과에 나오도록 권한을 검색 단계에서 거릅니다.'
		),
		pt(
			'데스크톱 앱',
			'웹과 같은 화면을 데스크톱 앱으로도 쓰고, 운영체제 알림을 받습니다.',
			'앱은 웹 화면을 그대로 감싸 한 벌의 코드로 함께 배포합니다.'
		),
	],
	build: [
		pt(
			'CRDT 동시 편집',
			'Yjs 문서를 WebSocket으로 주고받아 충돌 없이 합칩니다.',
			'서버는 문서의 바뀜만 받아 Redis로 다른 서버에 나눠 주고, 일정 간격으로 PostgreSQL에 저장합니다.'
		),
		pt(
			'디자인 시스템',
			'단추부터 표까지 60여 개의 컴포넌트를 Storybook으로 만들고 문서화했습니다.',
			'색과 간격은 토큰으로만 쓰게 해 다크 모드와 회사별 색 바꾸기를 한 곳에서 처리합니다.'
		),
		pt(
			'권한 모델',
			'워크스페이스, 채널, 문서 세 단계의 권한을 한 규칙으로 계산합니다.',
			'권한 계산은 서버와 화면이 같은 함수를 써서 보이는 것과 할 수 있는 것이 어긋나지 않습니다.'
		),
		pt(
			'성능 예산',
			'첫 화면 자바스크립트를 200KB 아래로 두는 예산을 정하고 빌드마다 검사했습니다.',
			'무거운 편집기는 문서를 열 때만 불러옵니다.'
		),
	],
	usage: [
		pt('워크스페이스 만들기', '회사 이름을 적고 동료를 메일로 초대합니다.'),
		pt('채널과 문서', '팀마다 채널을 열고, 채널 안에서 문서와 보드를 만듭니다.'),
		pt('데스크톱 앱', '설치하면 로그인 상태가 이어지고 알림을 받습니다.'),
	],
	timeline: [
		{ date: '2025.09.01', label: '킥오프와 요구 사항 정리' },
		{ date: '2025.09.22', label: '디자인 시스템과 화면 설계' },
		{ date: '2025.10.20', label: '메신저와 채널' },
		{ date: '2025.11.17', label: '동시 편집 문서' },
		{ date: '2025.12.15', label: '업무 보드와 검색' },
		{ date: '2026.01.19', label: '데스크톱 앱과 알림' },
		{ date: '2026.02.09', label: '시범 도입과 성능 개선' },
		{ date: '2026.02.27', label: '최종 발표' },
	],
	specs: [
		{ label: '화면', value: 'React, TypeScript, Vite' },
		{ label: '동시 편집', value: 'Yjs, WebSocket' },
		{ label: '서버', value: 'NestJS, PostgreSQL, Redis' },
		{ label: '데스크톱', value: 'Electron' },
		{ label: '디자인 시스템', value: 'Storybook, 디자인 토큰' },
		{ label: '배포', value: '컨테이너, 무중단 배포' },
	],
	contributions: [
		'프론트엔드 파트 일정과 코드 리뷰',
		'동시 편집 문서의 화면 쪽 연동',
		'디자인 시스템 컴포넌트 60여 개',
		'권한 계산 함수의 화면 쪽 적용',
		'성능 예산과 빌드 검사',
		'데스크톱 앱 알림',
	],
	chapters: [
		{
			title: '왜 만들었나',
			lead: '팀은 메신저, 문서 도구, 일정 앱을 오가며 하루에도 수십 번 창을 바꿨습니다. 결정은 대화에 묻히고 문서는 낡았습니다.',
			facts: [
				{ value: '5개', label: '팀이 함께 쓰던 도구' },
				{ value: '하루 34번', label: '도구를 오간 횟수 (설문)' },
			],
			points: [
				pt('흩어진 결정', '무엇을 왜 정했는지 찾으려면 여러 도구를 뒤져야 했습니다.'),
				pt('낡은 문서', '대화에서 바뀐 내용이 문서에 옮겨지지 않았습니다.'),
			],
			image: { src: WALL('tahoe-light'), alt: '팀이 쓰던 도구들' },
		},
		{
			title: '어떻게 나눠 만들었나',
			lead: '여덟 명이 화면, 서버, 실시간 세 파트로 나뉘어 2주 단위로 만들고 매번 시연했습니다.',
			facts: [
				{ value: '13번', label: '2주 단위 시연' },
				{ value: '1,400개', label: '합친 풀 리퀘스트' },
			],
			points: [
				pt('계약 먼저', 'API 명세를 먼저 합의하고 가짜 서버로 화면을 먼저 만들었습니다.'),
				pt('함께 리뷰', '풀 리퀘스트마다 다른 파트 사람이 한 명씩 리뷰했습니다.'),
				pt('시연 영상', '시연마다 짧은 영상을 남겨 진행을 기록했습니다.'),
			],
			image: { src: WALL('sequoia-dark'), alt: '스프린트 보드' },
		},
		{
			title: '시범 도입 뒤',
			lead: '40개 팀이 4주 동안 써 보고 남긴 의견으로 마지막 다듬기를 했습니다.',
			points: [
				pt('알림 줄이기', '알림이 너무 많다는 의견에 묶어 보내기를 더했습니다.'),
				pt('검색 속도', '검색 색인을 나눠 결과가 두 배 빨라졌습니다.'),
			],
		},
	],
	structure: `station/
├── apps/
│   ├── web/          # React 화면
│   ├── desktop/      # Electron 앱
│   └── server/       # NestJS
├── packages/
│   ├── ui/           # 디자인 시스템
│   ├── permissions/  # 권한 계산 (화면·서버 공용)
│   └── collab/       # Yjs 연동
└── docs/`,
	credits: [
		{ role: '아이콘', name: 'Font Awesome Free', by: 'Fonticons', href: 'https://fontawesome.com' },
		{ role: '글꼴', name: '가상 산스', by: '가상 글꼴 공방', note: 'SIL 오픈 폰트 라이선스' },
		{ role: '일러스트', name: '빈 화면 그림 묶음', by: '팀 디자이너', note: '직접 그림' },
	],
	icon: '/imgs/messages.png',
	image: WALL('tahoe-light'),
	gallery: [
		{ src: WALL('tahoe-light'), caption: '메신저와 문서' },
		{ src: WALL('sequoia-dark'), caption: '업무 보드' },
		{ src: WALL('sonoma-dark'), caption: '데스크톱 앱' },
	],
};

const assistant: LookSample = {
	name: '홈링크 – 스마트홈 설정 도우미',
	look: 'assistant',
	tagline: '집 안의 기기를 다섯 단계로 연결합니다.',
	description: '조명, 플러그, 센서를 차례로 찾아 연결하고 방마다 묶어 주는 스마트홈 설정 도우미',
	context: '팀 프로젝트 (4명, 웹과 모바일 앱)',
	role: '설정 흐름 설계와 프론트엔드 개발',
	period: '2026.03.02 – 2026.06.19',
	language: 'TypeScript',
	stack: ['React', 'TypeScript', 'XState', 'Web Bluetooth', 'Capacitor', 'Vitest', 'Storybook'],
	facts: [
		{ value: '5단계', label: '처음 설정' },
		{ value: '3분', label: '기기 하나 연결 (평균)' },
		{ value: '96%', label: '도움 없이 마친 비율' },
	],
	highlights: [
		pt(
			'기기 찾기',
			'근처의 기기를 자동으로 찾아 종류별로 보여 줍니다.',
			'찾지 못한 기기는 상자의 QR 코드를 찍어 더하고, 찾는 동안 기기의 불빛으로 어떤 것인지 알려 줍니다.',
			'fa-magnifying-glass'
		),
		pt(
			'방 정하기',
			'연결한 기기를 거실, 침실 같은 방으로 끌어다 놓습니다.',
			'방 이름은 자주 쓰는 것을 먼저 보여 주고, 직접 지을 수도 있습니다.',
			'fa-house'
		),
		pt(
			'자동화 만들기',
			'"해 지면 거실 조명 켜기" 같은 규칙을 문장으로 고릅니다.',
			'만든 규칙은 오늘 하루에 언제 돌지 시간표로 미리 보여 줍니다.',
			'fa-wand-magic-sparkles'
		),
		pt(
			'문제 해결',
			'연결이 끊긴 기기가 있으면 단계별로 원인을 짚어 줍니다.',
			'전원, 거리, 와이파이 순서로 하나씩 확인하고 고쳐지면 바로 알려 줍니다.',
			'fa-screwdriver-wrench'
		),
	],
	build: [
		pt(
			'상태 기계',
			'설정 흐름 전체를 XState 상태 기계로 그려 어느 단계에서 나가도 다시 그 자리로 돌아옵니다.',
			'상태 도식을 그대로 문서로 뽑아 기획자와 함께 흐름을 검토했습니다.'
		),
		pt(
			'블루투스 연결',
			'Web Bluetooth와 네이티브 플러그인을 같은 함수로 감싸 웹과 앱이 한 코드로 연결합니다.',
			'연결이 실패하면 세 번까지 간격을 늘려 다시 시도합니다.'
		),
		pt(
			'단계별 시험',
			'단계마다 가짜 기기를 붙인 시험을 만들어 흐름이 깨지지 않게 지켰습니다.',
			'Storybook에 단계별 화면을 모아 디자이너가 직접 확인했습니다.'
		),
	],
	usage: [
		pt('시작', '앱을 열고 집 이름을 정합니다.'),
		pt('기기 연결', '기기의 전원을 켜고 화면의 안내를 따라갑니다.'),
		pt('나중에 더하기', '설정 화면의 기기 더하기에서 언제든 같은 도우미를 엽니다.'),
	],
	timeline: [
		{ date: '2026.03.02', label: '설정 실패 사례 조사' },
		{ date: '2026.03.23', label: '설정 흐름 상태 도식' },
		{ date: '2026.04.13', label: '기기 찾기와 연결' },
		{ date: '2026.05.04', label: '방 정하기와 자동화' },
		{ date: '2026.05.25', label: '문제 해결 안내' },
		{ date: '2026.06.19', label: '발표' },
	],
	specs: [
		{ label: '화면', value: 'React, TypeScript' },
		{ label: '흐름', value: 'XState' },
		{ label: '기기 연결', value: 'Web Bluetooth, Capacitor 플러그인' },
		{ label: '시험', value: 'Vitest, Storybook' },
		{ label: '배포', value: '웹, iOS·Android 앱' },
	],
	contributions: [
		'설정 흐름 상태 기계 설계',
		'기기 찾기와 연결 화면',
		'자동화 규칙 고르기 화면',
		'문제 해결 안내 흐름',
		'단계별 시험과 Storybook',
	],
	icon: '/imgs/settings.png',
	image: WALL('ios-18-dark'),
};

/** 모양마다 하나씩 둔 예시 */
export const LOOK_SAMPLES: Record<SampleLook, LookSample> = {
	showcase,
	cinema,
	phone,
	horizontal,
	brutal,
	arcade,
	atelier,
	inbox,
	checklist,
	repo,
	dialogue,
	deck,
	assistant,
};

/** 이 모양의 예시 (직접 짠 페이지는 기본 모양의 예시를 쓰고 모양은 그대로 둔다) */
export const sampleFor = (look: ProjectLook): LookSample =>
	look === 'custom' ? { ...LOOK_SAMPLES.showcase, look } : LOOK_SAMPLES[look];

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
