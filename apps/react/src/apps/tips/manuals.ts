// 팁 앱의 '사용 설명서' (macOS 팁 앱의 사용자의 앱처럼): 앱마다 무엇을 할 수 있는지 절로 나눠 설명한다. 데이터만 둔다.
import { PROJECT_APPS, type AppName } from '@/apps/manifest';
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
	{
		app: 'music',
		summary: '작업하며 듣는 곡을 틀어 보세요.',
		intro: '음악은 macOS 음악 앱처럼 왼쪽에 재생 목록, 가운데에 곡 목록이 있어요. 다른 창을 열어도 계속 재생돼요.',
		sections: [
			{
				title: '재생 목록 고르기',
				body: '왼쪽에서 재생 목록을 고르면 가운데에 곡이 보여요. 곡을 누르면 바로 재생해요.',
				icon: 'fa-solid fa-list',
			},
			{
				title: '재생 막대',
				body: '위쪽 막대에서 재생·일시 정지, 이전·다음 곡, 셔플과 반복(전체·한 곡)을 고를 수 있어요.',
				icon: 'fa-solid fa-play',
			},
			{
				title: '원하는 곳부터 듣기',
				body: '재생 위치 막대를 누르거나 끌어서 옮겨요. 막대를 고른 채 방향키를 누르면 5초씩 움직여요.',
				icon: 'fa-solid fa-sliders',
			},
			{
				title: '메뉴 막대에서도',
				body: '창을 닫아도 메뉴 막대의 음악 아이콘으로 지금 곡을 보고 넘길 수 있어요.',
				icon: 'fa-solid fa-music',
			},
		],
	},
	{
		app: 'github',
		summary: 'GitHub 프로필과 기여 기록을 보세요.',
		intro: 'GitHub 앱은 이 사이트 주인의 GitHub 프로필을 GitHub 화면 그대로 보여 줘요.',
		sections: [
			{
				title: '프로필과 README',
				body: '왼쪽에 프로필, 오른쪽에 프로필 README가 있어요. README의 링크는 새 탭으로 열려요.',
				icon: 'fa-brands fa-github',
			},
			{
				title: '고정 저장소',
				body: '골라 둔 저장소가 카드로 보여요. 누르면 GitHub의 그 저장소로 가요.',
				icon: 'fa-solid fa-thumbtack',
			},
			{
				title: '기여 달력과 활동',
				body: '아래에 1년 동안의 기여 달력(잔디)과 최근 공개 활동이 달마다 묶여 있어요.',
				icon: 'fa-solid fa-calendar-days',
			},
		],
	},
	{
		app: 'share',
		summary: '이 사이트 링크를 바로 복사하세요.',
		intro: '공유는 창이 열리지 않는 앱이에요. Dock에서 누르면 이 사이트 주소를 바로 복사해요.',
		sections: [
			{
				title: '누르면 복사',
				body: 'Dock의 공유를 누르면 링크가 복사되고, 오른쪽 위에 "링크 복사됨" 알림이 떠요.',
				icon: 'fa-solid fa-link',
			},
			{
				title: '지금 보는 앱까지',
				body: '앱을 열면 주소 막대의 주소도 그 앱으로 바뀌어요. 그 주소를 보내면 받은 사람도 같은 앱이 열린 화면에서 시작해요.',
				icon: 'fa-solid fa-share-from-square',
			},
		],
	},
	{
		app: 'weather',
		summary: '세계 여러 곳의 날씨를 보세요.',
		intro:
			'날씨는 macOS·iOS 날씨 앱처럼 장소 목록과, 고른 곳의 하늘색 배경·기온·예보를 보여 줘요. 공개 날씨 정보(Open-Meteo)를 써요.',
		sections: [
			{
				title: '장소 고르기',
				body: '넓은 창에서는 왼쪽 목록에서 장소를 고르세요. 좁은 창과 휴대폰에서는 옆으로 밀거나 아래 점을 눌러 넘겨요.',
				icon: 'fa-solid fa-location-dot',
			},
			{
				title: '장소 더하기',
				body: '검색으로 도시를 찾아 목록에 더할 수 있어요. 더한 장소와 기온 단위는 이 브라우저에 남아요.',
				icon: 'fa-solid fa-magnifying-glass',
			},
			{
				title: '시간별·10일 예보',
				body: '큰 기온 아래로 시간별 날씨, 10일 일기예보, 바람·습도 같은 상세 칸이 이어져요.',
				icon: 'fa-solid fa-cloud-sun',
			},
		],
	},
	{
		app: 'preview',
		summary: 'PDF와 그림을 바로 보세요.',
		intro: '미리보기는 이력서 PDF와 그림을 열어 보는 앱이에요. 내려받지 않고 바로 볼 수 있어요.',
		sections: [
			{
				title: '파일 열기',
				body: 'Finder에서 PDF나 그림을 두 번 누르면 열려요. 파일 없이 열면 열기 창에서 고를 수 있어요.',
				icon: 'fa-solid fa-folder-open',
			},
			{
				title: '확대와 축소',
				body: '도구 막대의 확대·축소로 배율을 바꾸고, 맞춤으로 창 크기에 맞춰요.',
				icon: 'fa-solid fa-magnifying-glass-plus',
			},
			{
				title: 'PDF 안에서 찾기',
				body: 'PDF의 글자를 고르고 복사할 수 있고, 찾기로 낱말을 칠해 보여 줘요. 사이드바에는 쪽 그림이 있어요.',
				icon: 'fa-solid fa-file-pdf',
			},
		],
	},
	{
		app: 'quicktime',
		summary: '동영상과 소리 파일을 재생하세요.',
		intro: 'QuickTime Player는 Finder와 바탕화면에서 연 동영상·소리 파일을 재생해요.',
		sections: [
			{
				title: '떠 있는 재생 막대',
				body: '마우스를 움직이면 아래 가운데에 재생 막대가 나와요. 재생 중에 가만히 있으면 사라지고, 화면을 누르면 재생·멈춤이에요.',
				icon: 'fa-solid fa-circle-play',
			},
			{
				title: '소리·속도·PIP',
				body: '막대에서 소리 크기, 앞뒤로 넘기기, 재생 속도를 바꾸고, 동영상은 PIP로 작게 띄워 둘 수 있어요.',
				icon: 'fa-solid fa-gauge',
			},
		],
	},
	{
		app: 'activity',
		summary: '이 사이트의 방문 통계를 보세요.',
		intro:
			'활동 상태 보기는 macOS의 활동 상태 보기처럼 이 사이트의 방문을 표와 그래프로 보여 줘요. 누구나 열 수 있어요.',
		sections: [
			{
				title: '개요',
				body: '기간을 고르면 방문과 순방문자 수, 앞 기간과 비교한 변화, 일별 그래프가 보여요.',
				icon: 'fa-solid fa-chart-line',
			},
			{
				title: '표 정렬',
				body: '표의 머리를 누르면 그 칸으로 정렬하고, 다시 누르면 반대로 정렬해요.',
				icon: 'fa-solid fa-arrow-down-wide-short',
			},
			{
				title: '관리자만 보는 칸',
				body: '들어온 곳의 주소, 캠페인, 실시간 방문, 서버 상태는 관리자에게만 보여요.',
				icon: 'fa-solid fa-lock',
			},
		],
	},
	{
		app: 'apidocs',
		summary: '이 사이트 서버의 API를 살펴보세요.',
		intro: 'API 문서는 이 사이트를 움직이는 서버의 모든 API를 정리한 문서예요. 서버가 꺼져 있어도 볼 수 있어요.',
		sections: [
			{
				title: '엔드포인트 둘러보기',
				body: '왼쪽 목록에서 블로그·방명록·메일 같은 묶음을 고르면 요청과 응답 모양이 보여요.',
				icon: 'fa-solid fa-code',
			},
			{
				title: '메뉴 막대에서도',
				body: '메뉴 막대의 서버 상태를 누르고 "API 문서 열기"를 골라도 열려요.',
				icon: 'fa-solid fa-server',
			},
		],
	},
	{
		app: 'passwords',
		summary: '관리자 로그인을 하는 곳이에요.',
		intro: '암호는 이 사이트 관리자가 로그인·로그아웃하는 곳이에요. 방문자는 쓸 일이 없어요.',
		sections: [
			{
				title: '관리자 로그인',
				body: 'GitHub로 로그인해요. 관리자로 정해진 계정만 들어갈 수 있어요.',
				icon: 'fa-solid fa-key',
			},
			{
				title: '데스크톱에서는',
				body: '메뉴 막대의 Apple 메뉴나 시스템 설정에서도 같은 일을 할 수 있어요.',
				icon: 'fa-brands fa-apple',
			},
		],
	},
	{
		app: 'bin',
		summary: '이 브라우저에 남은 기록을 보고 지우세요.',
		intro:
			'휴지통에는 지울 수 있는 것이 모여 있어요. 방문자도 이 사이트가 브라우저에 남긴 것을 직접 보고 지울 수 있어요.',
		sections: [
			{
				title: '내 브라우저 데이터',
				body: '설정, 검색어, 둘러보기를 본 기록처럼 이 사이트가 이 브라우저에 남긴 것을 보고 비울 수 있어요.',
				icon: 'fa-solid fa-broom',
			},
			{
				title: '휴지통',
				body: 'Finder에서 휴지통으로 보낸 폴더와 파일이 보여요. 되돌리거나 영구 삭제하는 것은 관리자만 할 수 있어요.',
				icon: 'fa-solid fa-trash-can',
			},
		],
	},
	{
		app: 'tips',
		summary: '이 사이트를 쓰는 법을 모아 두었어요.',
		intro: '지금 보고 있는 팁 앱이에요. 처음 온 사람을 위한 둘러보기와 팁, 앱마다의 사용 설명서가 있어요.',
		sections: [
			{
				title: '둘러보기',
				body: '"MacFolio 둘러보기"를 누르면 화면의 한 곳씩 비추며 무엇을 눌러 보면 좋은지 알려 줘요.',
				icon: 'fa-solid fa-wand-magic-sparkles',
			},
			{
				title: '찾기',
				body: '위의 찾기 칸에 낱말을 쓰면 모든 팁과 사용 설명서에서 찾아요.',
				icon: 'fa-solid fa-magnifying-glass',
			},
			{
				title: '언제든 다시',
				body: '메뉴 막대의 도움말 › MacFolio 둘러보기로도 언제든 다시 볼 수 있어요.',
				icon: 'fa-regular fa-lightbulb',
			},
		],
	},
	// 프로젝트 앱: 배포한 사이트를 창 안에 띄운다. 쓰는 법은 프로젝트 정보(usage)에서
	...PROJECT_APPS.map((project): Manual => ({
		app: project.id as AppName,
		summary: project.description,
		intro: `${project.name}은(는) 실제로 배포한 사이트를 이 창 안에서 바로 써 볼 수 있는 앱이에요. ${project.description}`,
		sections: [
			...(project.usage ?? []).map(({ title, body }) => ({ title, body, icon: 'fa-solid fa-hand-pointer' })),
			{
				title: '자세한 이야기',
				body: `어떻게 만들었는지는 Safari의 ${project.name} 프로젝트 페이지에서 볼 수 있어요.`,
				icon: 'fa-solid fa-compass',
			},
		],
	})),
];
