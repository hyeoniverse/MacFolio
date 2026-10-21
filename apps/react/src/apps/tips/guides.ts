// 팁 앱의 사용법 모음 (macOS·iOS 팁 앱의 '모음'처럼). 앱마다 무엇을 어떻게 하는지 한 단계씩 설명한다. 데이터만 둔다.
import type { AppName } from '@/apps/manifest';

export interface GuideStep {
	title: string;
	body: string;
	icon: string;
	/** 데스크톱 단축키 (보기용, 예: '⌘F') */
	keys?: string;
}

export interface Guide {
	id: string;
	title: string;
	/** 모음 카드에 보일 한 줄 */
	summary: string;
	icon: string;
	/** 다 읽고 바로 열어 볼 앱 */
	app: AppName;
	appLabel: string;
	steps: GuideStep[];
}

export const GUIDES: Guide[] = [
	{
		id: 'blog',
		title: '블로그 읽는 법',
		summary: '메모 앱에서 글을 찾고, 읽고, 반응을 남기는 방법',
		icon: 'fa-solid fa-note-sticky',
		app: 'memo',
		appLabel: '메모 열기',
		steps: [
			{
				title: '폴더에서 주제를 고르세요',
				body: '왼쪽 사이드바의 폴더가 블로그의 카테고리예요. 개발기, 회고처럼 주제별로 모여 있고, 폴더를 누르면 가운데 목록이 그 글들로 바뀌어요.',
				icon: 'fa-solid fa-folder',
			},
			{
				title: '목록에서 글을 누르면 오른쪽에 펼쳐져요',
				body: '맨 위의 핀 표시는 고정된 글이에요. 목록 아래로 내리면 예전 글이 이어서 나와요.',
				icon: 'fa-solid fa-list',
			},
			{
				title: '목록과 갤러리를 바꿔 보세요',
				body: '도구 막대의 보기 버튼으로 제목만 촘촘한 목록과 대표 그림이 보이는 갤러리를 오갈 수 있어요. 정렬과 그룹화 메뉴에서 최신순·제목순, 날짜별 묶기도 골라요.',
				icon: 'fa-solid fa-table-cells-large',
				keys: '⌥1 · ⌥2',
			},
			{
				title: '검색으로 바로 찾기',
				body: '목록 위 검색 칸에 낱말을 쓰면 모든 글의 제목과 본문에서 찾아요. 검색 조건으로 태그만 고르거나, 제목으로 좁힐 수도 있어요.',
				icon: 'fa-solid fa-magnifying-glass',
			},
			{
				title: '태그로 비슷한 글 모아 보기',
				body: '글 위의 #태그를 누르면 같은 태그가 붙은 글만 모여요. 태그를 여러 개 고르면 모두 붙은 글, 하나라도 붙은 글 중에서 고를 수 있어요.',
				icon: 'fa-solid fa-hashtag',
			},
			{
				title: '읽던 글 안에서 찾기',
				body: '긴 글에서 특정 낱말을 찾고 싶으면 찾기를 여세요. 찾은 곳이 노랗게 칠해지고 다음·이전으로 옮겨 다녀요.',
				icon: 'fa-solid fa-highlighter',
				keys: '⌘F',
			},
			{
				title: '글자 크기는 편하게',
				body: '본문 오른쪽 아래에 떠 있는 가− / 가+ 버튼으로 글자를 키우거나 줄여요. 고른 크기는 다음에 와도 그대로예요.',
				icon: 'fa-solid fa-text-height',
			},
			{
				title: '코드와 그림',
				body: '코드 블록 오른쪽 위의 복사 버튼으로 코드를 그대로 가져가세요. 그림을 누르면 크게 보고 내려받을 수 있어요.',
				icon: 'fa-solid fa-code',
			},
			{
				title: '좋아요와 댓글',
				body: '글 끝에서 좋아요를 누르거나 댓글을 남겨 주세요. 로그인은 필요 없어요. 아래의 이전 글·다음 글로 같은 폴더의 글을 이어서 읽을 수 있어요.',
				icon: 'fa-solid fa-heart',
			},
			{
				title: '마음에 든 글은 링크로 공유',
				body: '공유 버튼(또는 파일 › 링크 공유)으로 글 주소를 복사해요. 받은 사람이 열면 이 사이트에서 바로 그 글이 펼쳐져요.',
				icon: 'fa-solid fa-link',
			},
		],
	},
	{
		id: 'windows',
		title: '창과 Dock 다루기',
		summary: '진짜 Mac처럼 창을 옮기고, 키우고, 정리하는 방법',
		icon: 'fa-regular fa-window-restore',
		app: 'finder',
		appLabel: 'Finder 열기',
		steps: [
			{
				title: '앱은 Dock에서',
				body: '화면 아래 Dock의 아이콘을 누르면 앱이 열려요. 열린 앱에는 아이콘 아래 작은 점이 생겨요.',
				icon: 'fa-solid fa-grip',
			},
			{
				title: '창 옮기고 크기 바꾸기',
				body: '창 위쪽 막대를 끌어 옮기고, 가장자리나 모서리를 끌어 크기를 바꿔요. 위쪽 막대를 두 번 누르면 화면을 꽉 채워요.',
				icon: 'fa-solid fa-up-down-left-right',
			},
			{
				title: '빨강·노랑·초록 버튼',
				body: '빨강은 닫기, 노랑은 Dock으로 내리기(최소화), 초록은 전체 화면이에요.',
				icon: 'fa-solid fa-circle',
				keys: '⌥W · ⌥M',
			},
			{
				title: '메뉴 막대는 지금 앱을 따라요',
				body: '맨 위 메뉴 막대의 메뉴는 앞에 있는 앱에 맞게 바뀌어요. 도움말 › 키보드 단축키에서 지금 쓸 수 있는 단축키를 모두 볼 수 있어요.',
				icon: 'fa-solid fa-bars',
			},
			{
				title: '바탕화면 폴더',
				body: '오른쪽 위 폴더(이력서·포트폴리오·자격증)를 두 번 누르면 Finder에서 열려요. 끌어서 자리를 옮길 수도 있어요.',
				icon: 'fa-solid fa-folder-open',
			},
		],
	},
	{
		id: 'contact',
		title: '연락하는 법',
		summary: '방명록, 메일, 댓글로 이야기를 나누는 방법',
		icon: 'fa-solid fa-comment',
		app: 'messages',
		appLabel: '메시지 열기',
		steps: [
			{
				title: '방명록은 메시지 앱',
				body: '메시지 앱의 대화창에 한마디 남겨 주세요. 가입 없이 쓸 수 있고, 이름은 "🦊 날쌘 여우"처럼 저절로 붙어요. 제가 읽으면 답장을 달아요.',
				icon: 'fa-solid fa-comments',
			},
			{
				title: '긴 이야기는 메일로',
				body: '메일 앱에서 쓴 메일은 실제로 제 메일함으로 가요. 답장받을 주소를 꼭 적어 주세요.',
				icon: 'fa-solid fa-envelope',
			},
			{
				title: '글에 대한 이야기는 댓글로',
				body: '블로그 글 끝의 댓글 칸에 남기면 그 글을 읽는 다른 분들도 함께 볼 수 있어요.',
				icon: 'fa-solid fa-reply',
			},
		],
	},
];
