import type { Project } from '../types';
import { projectImage } from './projectImage';

export const SPROUTFARM: Project = {
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
	app: {
		label: '새싹 농장',
		icon: 'projects/sproutfarm/icon.png',
		play: true,
		tone: 'dark',
		barColor: '#231f20',
		// 게임 화면(16:9) + 제목 막대
		windowSize: { width: 960, height: 569 },
	},
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
};
