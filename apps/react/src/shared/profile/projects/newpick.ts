import type { Project } from '../types';
import { projectImage } from './projectImage';

export const NEWPICK: Project = {
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
	icon: projectImage('newpick', 'icon.svg'),
	app: {
		label: 'NewPick',
		icon: 'projects/newpick/app-icon.png',
		barColor: '#ffffff',
		windowSize: { width: 1080, height: 700 },
	},
	logo: projectImage('newpick', 'logo.svg'),
	image: projectImage('newpick', 'screenshot.jpg'),
};
