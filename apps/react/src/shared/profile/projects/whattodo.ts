import type { Project } from '../types';
import { projectImage } from './projectImage';

export const WHATTODO: Project = {
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
	app: {
		label: 'WTD',
		icon: 'projects/whattodo/app-icon.png',
		barColor: '#3b82f6',
		windowSize: { width: 1080, height: 700 },
	},
	image: projectImage('whattodo', 'screenshot.jpg'),
};
