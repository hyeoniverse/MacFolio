import type { Project } from '../types';
import { projectImage } from './projectImage';

export const QRU: Project = {
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
	app: {
		label: 'QRU',
		icon: 'projects/qru/app-icon.png',
		barColor: '#b8efed',
		windowSize: { width: 1080, height: 700 },
	},
	image: projectImage('qru', 'screenshot.jpg'),
};
