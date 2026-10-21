// 팁 앱의 '사용 설명서' (macOS 팁 앱의 사용자의 앱처럼): 앱마다 무엇을 할 수 있는지 절로 나눠 설명한다. 데이터만 둔다.
import type { AppName } from '@/apps/manifest';
import { GUIDES, type GuideStep } from './guides';

export interface Manual {
	/** 열 앱 (아이콘·이름은 manifest에서) */
	app: AppName;
	/** 카드 아래 한 줄 */
	summary: string;
	/** 설명서 첫머리의 소개 */
	intro: string;
	sections: GuideStep[];
}

const stepsOf = (id: string) => GUIDES.find((guide) => guide.id === id)!.steps;

export const MANUALS: Manual[] = [
	{
		app: 'memo',
		summary: '블로그 글을 찾고 읽고 반응을 남기세요.',
		intro: '메모 앱은 이 사이트의 블로그예요. 개발하며 겪은 일과 회고를 폴더별로 모아 두었어요.',
		sections: stepsOf('blog'),
	},
	{
		app: 'finder',
		summary: '이력서와 문서를 폴더로 찾아보세요.',
		intro: 'Finder는 이 사이트의 파일을 진짜 Mac처럼 폴더로 보여 줘요. 이력서, 포트폴리오, 설계 문서가 여기 있어요.',
		sections: [
			{
				title: '사이드바로 이동',
				body: '왼쪽 즐겨찾기에서 데스크탑, 문서, 이력서, 포트폴리오, 블로그, 응용 프로그램으로 바로 가요.',
				icon: 'fa-solid fa-table-columns',
			},
			{
				title: '두 번 눌러 열기',
				body: 'Markdown 문서는 텍스트 편집기에서, PDF와 그림은 미리보기에서, 블로그 글은 메모에서 열려요.',
				icon: 'fa-solid fa-arrow-pointer',
			},
			{
				title: '아이콘과 목록 보기',
				body: '도구 막대의 보기 버튼으로 큰 아이콘과 이름·날짜가 보이는 목록을 바꿔요.',
				icon: 'fa-solid fa-table-cells-large',
			},
			{
				title: '이름으로 찾기',
				body: '오른쪽 위 찾기 칸에 이름을 쓰면 모든 폴더에서 찾아요.',
				icon: 'fa-solid fa-magnifying-glass',
			},
			{
				title: '이력서는 PDF로도',
				body: '문서 › 이력서의 .pdf 파일을 열면 지금 이력서로 바로 만든 PDF가 미리보기에서 열려요. 국문·영문 모두 있어요.',
				icon: 'fa-solid fa-file-pdf',
			},
		],
	},
	{
		app: 'safari',
		summary: '만든 프로젝트를 소개 페이지로 둘러보세요.',
		intro: 'Safari의 탭마다 프로젝트 소개가 하나씩 열려 있어요. 무엇을 왜 만들었고 어떻게 풀었는지 볼 수 있어요.',
		sections: [
			{
				title: '탭으로 프로젝트 넘기기',
				body: '위쪽 탭을 누르면 다른 프로젝트로 바뀌어요.',
				icon: 'fa-solid fa-table-columns',
				keys: '⌥⇧[ · ⌥⇧]',
			},
			{
				title: '배포한 사이트 열기',
				body: '소개 페이지의 데모 링크나 Dock의 프로젝트 아이콘으로 실제 서비스를 창 안에서 열어요.',
				icon: 'fa-solid fa-rocket',
			},
			{
				title: '링크 공유',
				body: '공유 버튼으로 이 프로젝트 소개 주소를 복사해요.',
				icon: 'fa-solid fa-link',
			},
		],
	},
	{
		app: 'messages',
		summary: '방명록에 한마디 남겨 주세요.',
		intro: '메시지 앱은 이 사이트의 방명록이에요. 가입 없이 쓸 수 있어요.',
		sections: stepsOf('contact').slice(0, 1),
	},
	{
		app: 'mail',
		summary: '제게 진짜 메일을 보내세요.',
		intro: '메일 앱에서 쓴 메일은 실제로 제 메일함으로 가요.',
		sections: [
			{
				title: '새로운 메시지',
				body: '받는 사람은 저로 정해져 있어요. 이름, 답장받을 주소, 제목과 내용을 쓰고 보내세요.',
				icon: 'fa-solid fa-pen-to-square',
			},
			{
				title: '보낸 메일 확인',
				body: '보낸 메일은 보낸 편지함에 남아요 (이 브라우저에서만).',
				icon: 'fa-solid fa-paper-plane',
			},
		],
	},
	{
		app: 'terminal',
		summary: '명령어로 자기소개를 들어 보세요.',
		intro: '터미널은 진짜처럼 명령을 받아요. 휴대폰에서는 단축어 앱으로, 명령을 타일로 눌러 실행해요.',
		sections: [
			{ title: 'help', body: '쓸 수 있는 명령을 모두 보여 줘요.', icon: 'fa-solid fa-circle-question' },
			{ title: 'resume', body: '이력서를 터미널에 그려 줘요.', icon: 'fa-solid fa-file-lines' },
			{
				title: 'project, open',
				body: 'project로 프로젝트 목록과 자세한 내용을, open으로 앱을 열어요.',
				icon: 'fa-solid fa-terminal',
			},
			{ title: '화면 지우기', body: 'clear를 치거나 ⌃L을 누르세요.', icon: 'fa-solid fa-eraser', keys: '⌃L' },
		],
	},
	{
		app: 'photos',
		summary: '프로젝트 화면을 앨범으로 보세요.',
		intro: '사진 앱에는 프로젝트마다 화면을 모은 앨범이 있어요.',
		sections: [
			{ title: '앨범 고르기', body: '왼쪽에서 프로젝트 앨범을 고르면 그 화면들이 모여요.', icon: 'fa-solid fa-images' },
			{
				title: '크게 보기',
				body: '사진을 누르면 크게 보고, 좌우 화살표나 트랙패드로 넘겨요.',
				icon: 'fa-solid fa-expand',
			},
		],
	},
	{
		app: 'settings',
		summary: '화면 모드와 배경화면을 바꾸세요.',
		intro: '시스템 설정에서 이 사이트를 내 취향으로 바꿀 수 있어요. 고른 값은 이 브라우저에 남아요.',
		sections: [
			{ title: '다크 모드', body: '화면 모드에서 라이트·다크·자동을 골라요.', icon: 'fa-solid fa-circle-half-stroke' },
			{
				title: '배경화면',
				body: '데스크톱과 휴대폰 배경을 따로, 움직이는 배경도 고를 수 있어요.',
				icon: 'fa-solid fa-image',
			},
			{
				title: '정보',
				body: '정보에서 이 사이트의 주인과 프로젝트를 볼 수 있어요.',
				icon: 'fa-solid fa-circle-info',
			},
		],
	},
	{
		app: 'textedit',
		summary: 'Markdown 문서를 읽으세요.',
		intro: '텍스트 편집기는 저장소의 Markdown 문서(README, 설계 문서)와 이력서를 정리된 모양으로 보여 줘요.',
		sections: [
			{
				title: '문서 열기',
				body: 'Finder에서 .md 문서를 두 번 누르거나, 문서 없이 열어 열기 창에서 골라요.',
				icon: 'fa-solid fa-folder-open',
			},
			{
				title: '문서 사이 이동',
				body: '문서 안의 다른 문서 링크는 같은 창에서 열리고, 보기 › 뒤로·앞으로로 오가요.',
				icon: 'fa-solid fa-arrow-right-arrow-left',
				keys: '⌘[ · ⌘]',
			},
			{
				title: '이력서 PDF',
				body: '이력서를 열면 제목 줄의 PDF 버튼으로 내려받아요.',
				icon: 'fa-solid fa-file-arrow-down',
			},
		],
	},
];
