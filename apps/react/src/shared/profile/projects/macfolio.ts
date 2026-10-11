import type { Project } from '../types';
import { projectImage } from './projectImage';

export const MACFOLIO: Project = {
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
};
