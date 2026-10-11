import type { Project } from '../types';
import { projectImage } from './projectImage';

export const DEVCOURSE: Project = {
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
};
