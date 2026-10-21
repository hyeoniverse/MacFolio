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
		summary: '진짜 Mac처럼 앱을 열고, 창을 옮기고, 키우고, 정리하는 방법을 처음부터 알려 드려요',
		icon: 'fa-regular fa-window-restore',
		app: 'finder',
		appLabel: 'Finder 열기',
		steps: [
			{
				title: '앱은 Dock에서 열어요',
				body: '화면 아래에 늘어선 아이콘 줄이 Dock이에요. 아이콘을 한 번 누르면 그 앱이 창으로 열리고, 열려 있는 앱은 아이콘 아래에 작은 점이 생겨요. 이미 열린 앱을 다시 누르면 그 창이 맨 앞으로 와요.',
				icon: 'fa-solid fa-table-cells-large',
			},
			{
				title: 'Dock에 없는 앱은 Launchpad에',
				body: '날씨, 미리보기, 활동 상태 보기, 팁처럼 Dock에 자리가 없는 앱은 Launchpad에 모여 있어요. Dock의 Launchpad 아이콘을 누르면 모든 앱이 격자로 펼쳐지고, 아이콘을 누르면 그 앱이 열려요.',
				icon: 'fa-solid fa-rocket',
			},
			{
				title: '창 옮기기와 크기 바꾸기',
				body: '창 위쪽 막대를 잡고 끌면 창이 따라와요. 창의 가장자리나 모서리에 마우스를 올리면 화살표 모양이 바뀌는데, 그때 끌면 크기가 바뀌어요. 위쪽 막대를 두 번 누르면 화면을 가득 채우고, 다시 두 번 누르면 원래 크기로 돌아와요.',
				icon: 'fa-solid fa-up-down-left-right',
			},
			{
				title: '빨강·노랑·초록 버튼',
				body: '창 왼쪽 위의 세 버튼은 Mac과 똑같아요. 빨강은 창 닫기, 노랑은 Dock으로 내려 두기(최소화), 초록은 전체 화면이에요. 내려 둔 창은 Dock의 아이콘을 누르면 다시 올라와요.',
				icon: 'fa-solid fa-circle',
				keys: '⌥W 닫기 · ⌥M 내리기',
			},
			{
				title: '여러 창을 함께 쓰기',
				body: '창은 여러 개를 동시에 띄워 둘 수 있어요. 뒤에 있는 창을 누르면 맨 앞으로 오고, 블로그를 읽으면서 옆에 음악을 틀어 두는 것처럼 나란히 놓고 쓸 수 있어요.',
				icon: 'fa-regular fa-clone',
			},
			{
				title: '메뉴 막대는 지금 앱을 따라요',
				body: '화면 맨 위 메뉴 막대의 메뉴는 앞에 있는 앱에 맞게 바뀌어요. 메모를 앞에 두면 메모의 메뉴가, Safari를 앞에 두면 Safari의 메뉴가 보여요. 도움말 › 키보드 단축키에서 지금 쓸 수 있는 단축키를 한눈에 볼 수 있어요.',
				icon: 'fa-solid fa-bars',
			},
			{
				title: '단축키는 ⌘ 대신 ⌥',
				body: '브라우저가 ⌘W·⌘Q를 먼저 가져가기 때문에, 이 사이트에서는 창 닫기·내리기·숨기기·종료를 ⌥(option) 키로 해요. 손에 익으면 마우스 없이도 창을 정리할 수 있어요.',
				icon: 'fa-regular fa-keyboard',
				keys: '⌥W · ⌥M · ⌥H · ⌥Q',
			},
			{
				title: '바탕화면 아이콘',
				body: '바탕화면의 폴더와 파일은 두 번 누르면 열려요. 끌어서 원하는 자리로 옮길 수 있고, 오른쪽 클릭하면 열기·Finder에서 보기 메뉴가 나와요. 그림 파일은 오른쪽 클릭으로 바탕화면 사진으로 정할 수도 있어요.',
				icon: 'fa-solid fa-folder',
			},
		],
	},
	{
		id: 'menubar',
		title: '메뉴 막대 알아보기',
		summary: '화면 맨 위의 Apple 메뉴, 서버 상태, 음악, 도움말을 쓰는 방법',
		icon: 'fa-solid fa-bars',
		app: 'settings',
		appLabel: '시스템 설정 열기',
		steps: [
			{
				title: 'Apple 메뉴',
				body: '왼쪽 끝의 사과 아이콘을 누르면 Apple 메뉴가 열려요. 이 Mac에 관하여에서 이 사이트를 만든 사람의 프로필을 보고, 시스템 설정을 열고, 다크 모드를 바로 켜고 끌 수 있어요.',
				icon: 'fa-brands fa-apple',
			},
			{
				title: '사이트 바로가기',
				body: 'Apple 메뉴 아래쪽에는 API 문서, GitHub 저장소, 개인정보 처리 방침으로 가는 바로가기가 있어요. 이 사이트가 어떻게 만들어졌는지 궁금하면 저장소부터 들러 보세요.',
				icon: 'fa-solid fa-link',
			},
			{
				title: '서버 상태',
				body: '오른쪽의 Wi-Fi 자리에는 이 사이트 서버의 상태가 있어요. 누르면 응답 시간과 데이터베이스 상태가 막대로 보이고, 여기서 API 문서도 바로 열 수 있어요.',
				icon: 'fa-solid fa-wifi',
			},
			{
				title: '음악 조절',
				body: '음악을 틀어 두면 메뉴 막대에서 지금 곡을 보고 재생·일시 정지, 다음 곡으로 넘길 수 있어요. 음악 창을 닫아도 노래는 계속 나와요.',
				icon: 'fa-solid fa-music',
			},
			{
				title: '도움말 메뉴',
				body: '도움말에서 MacFolio 둘러보기를 다시 시작하거나, 키보드 단축키 목록을 열거나, 이상한 점을 발견하면 문제 알리기로 바로 알려 줄 수 있어요.',
				icon: 'fa-regular fa-circle-question',
			},
		],
	},
	{
		id: 'phone',
		title: '휴대폰에서 둘러보기',
		summary: '휴대폰에서는 iPhone처럼: 홈 화면, 제어 센터, 앱 전환기 쓰는 법',
		icon: 'fa-solid fa-mobile-screen',
		app: 'memo',
		appLabel: '메모 열기',
		steps: [
			{
				title: '홈 화면',
				body: '휴대폰으로 들어오면 Mac 대신 iPhone 홈 화면이 보여요. 아이콘을 누르면 앱이 화면을 가득 채우며 열리고, 앱이 많으면 옆으로 밀어 다음 페이지로 넘겨요.',
				icon: 'fa-solid fa-table-cells',
			},
			{
				title: '홈으로 돌아가기',
				body: '화면 맨 아래의 가로 막대(홈 인디케이터)를 누르거나 짧게 위로 쓸어 올리면 홈 화면으로 돌아가요.',
				icon: 'fa-solid fa-house',
			},
			{
				title: '앱 전환기',
				body: '홈 인디케이터를 길게 쓸어 올리면 열어 둔 앱이 카드로 늘어서요. 카드를 눌러 그 앱으로 가고, 위로 밀어 올려 닫을 수 있어요.',
				icon: 'fa-regular fa-clone',
			},
			{
				title: '제어 센터',
				body: '화면 어디서든 아래로 쓸어내리면 제어 센터가 열려요. 음악 음량과 재생을 조절할 수 있고, 빈 곳을 누르거나 위로 쓸어 올리면 닫혀요.',
				icon: 'fa-solid fa-sliders',
			},
		],
	},
	{
		id: 'contact',
		title: '연락하는 법',
		summary: '방명록, 메일, 댓글로 이야기를 나누는 방법과 각각 언제 쓰면 좋은지',
		icon: 'fa-solid fa-comment',
		app: 'messages',
		appLabel: '메시지 열기',
		steps: [
			{
				title: '방명록은 메시지 앱',
				body: '메시지 앱의 대화창에 한마디 남겨 주세요. 가입이나 로그인 없이 바로 쓸 수 있고, 이름은 "🦊 날쌘 여우"처럼 저절로 붙어요. 남긴 글은 다른 방문자도 함께 보는 공개 방명록이에요. 제가 읽으면 답장을 달아요.',
				icon: 'fa-solid fa-comments',
			},
			{
				title: '긴 이야기는 메일로',
				body: '메일 앱에서 쓴 메일은 실제로 제 메일함으로 가요. 받는 사람은 이미 정해져 있으니 이름, 답장받을 주소, 제목, 내용만 쓰면 돼요. 답장받을 주소를 꼭 적어 주세요. 채용이나 협업 이야기는 이쪽이 좋아요.',
				icon: 'fa-solid fa-envelope',
			},
			{
				title: '보낸 메일 확인',
				body: '보낸 메일은 메일 앱의 보낸 편지함에 남아요. 이 기록은 지금 쓰는 브라우저에만 저장되니, 다른 기기에서는 보이지 않아요.',
				icon: 'fa-solid fa-paper-plane',
			},
			{
				title: '글에 대한 이야기는 댓글로',
				body: '블로그 글 끝의 댓글 칸에 남기면 그 글을 읽는 다른 분들도 함께 볼 수 있어요. 글을 읽다 궁금한 점이나 틀린 부분이 있으면 편하게 남겨 주세요.',
				icon: 'fa-solid fa-reply',
			},
			{
				title: 'GitHub에서도',
				body: 'GitHub 앱에서 제 프로필과 저장소를 볼 수 있어요. 사이트의 버그는 도움말 › 문제 알리기로 GitHub 이슈를 남겨 주시면 고쳐 둘게요.',
				icon: 'fa-brands fa-github',
			},
		],
	},
];
