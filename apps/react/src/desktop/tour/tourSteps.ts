// 처음 온 사람을 위한 둘러보기(팁 앱처럼)의 단계. 화면의 한 곳을 비추고 "이거 눌러 보세요"라고 말한다. React와 DOM에 의존하지 않는 데이터만 둔다.

export interface TourStep {
	id: string;
	/** 비출 곳 (CSS 선택자). 없으면 가운데 카드. 화면에 없는 곳(좁은 화면의 Dock 밖 앱 등)은 건너뛴다 */
	target?: string;
	title: string;
	body: string;
	/** 팁 앱 목록에 보일 아이콘 (Font Awesome) */
	icon?: string;
}

const dock = (app: string) => `.dock .dock-item[aria-label="${app}"]`;
const phoneApp = (app: string) => `.mobile-app[data-launch="${app}"]`;

export const WELCOME_ID = 'welcome';
export const FINISH_ID = 'finish';

const welcome: TourStep = {
	id: WELCOME_ID,
	title: 'MacFolio에 오신 걸 환영해요',
	body: 'macOS를 그대로 옮긴 김정현의 포트폴리오예요. 어디부터 눌러 보면 좋은지 1분 만에 알려 드릴게요.',
};

const finish: TourStep = {
	id: FINISH_ID,
	title: '이제 마음껏 둘러보세요',
	body: '다시 보고 싶으면 팁 앱이나 메뉴 막대의 도움말 › MacFolio 둘러보기를 여세요.',
};

/** 데스크톱 둘러보기 */
export const DESKTOP_STEPS: TourStep[] = [
	welcome,
	{
		id: 'resume',
		target: '.desktop-icon[aria-label="이력서"]',
		title: '이력서부터 보세요',
		body: '두 번 누르면 이력서 폴더가 열려요. Markdown 이력서와 PDF가 국문·영문으로 있어요.',
		icon: 'fa-solid fa-file-lines',
	},
	{
		id: 'finder',
		target: dock('finder'),
		title: 'Finder로 파일 둘러보기',
		body: '문서(설계 문서·README), 포트폴리오, 자격증, 블로그 글까지 진짜 Mac처럼 폴더로 찾아볼 수 있어요.',
		icon: 'fa-solid fa-folder-open',
	},
	{
		id: 'projects',
		target: dock('safari'),
		title: '프로젝트는 Safari에서',
		body: '만든 서비스들을 소개 페이지로 모아 뒀어요. 무엇을 왜 만들었는지 볼 수 있어요.',
		icon: 'fa-solid fa-compass',
	},
	{
		id: 'project-apps',
		target: dock('hyeoniverse'),
		title: '배포한 서비스를 앱처럼',
		body: 'Dock의 프로젝트 아이콘을 누르면 실제로 배포한 사이트가 창 안에서 열려요.',
		icon: 'fa-solid fa-rocket',
	},
	{
		id: 'blog',
		target: dock('memo'),
		title: '메모 앱은 블로그예요',
		body: '개발하며 겪은 일과 고민을 글로 남겨요. 왼쪽 폴더에서 주제별로 골라 읽어 보세요.',
		icon: 'fa-solid fa-note-sticky',
	},
	{
		id: 'photos',
		target: dock('photos'),
		title: '사진은 프로젝트 갤러리',
		body: '프로젝트마다 화면을 앨범으로 모아 뒀어요. 크게 보고 넘겨 볼 수 있어요.',
		icon: 'fa-solid fa-images',
	},
	{
		id: 'guestbook',
		target: dock('messages'),
		title: '방명록은 메시지 앱에',
		body: '한마디 남겨 주시면 답장할게요.',
		icon: 'fa-solid fa-comment',
	},
	{
		id: 'mail',
		target: dock('mail'),
		title: '메일은 진짜로 보내져요',
		body: '연락하고 싶으면 메일 앱에서 바로 보내세요. 제 메일함으로 갑니다.',
		icon: 'fa-solid fa-envelope',
	},
	{
		id: 'github',
		target: dock('github'),
		title: 'GitHub 활동',
		body: '고정한 저장소와 지난 1년의 기여 달력을 볼 수 있어요.',
		icon: 'fa-brands fa-github',
	},
	{
		id: 'terminal',
		target: dock('terminal'),
		title: '터미널도 진짜예요',
		body: 'help를 치면 쓸 수 있는 명령이 나와요. resume을 치면 이력서를 그려 줘요.',
		icon: 'fa-solid fa-terminal',
	},
	{
		id: 'music',
		target: '.menu-item-player',
		title: '음악을 틀어 두고 둘러보세요',
		body: '메뉴 막대에서 바로 재생·다음 곡을 고를 수 있어요. 음악 앱에는 앨범이 더 있어요.',
		icon: 'fa-solid fa-music',
	},
	{
		id: 'settings',
		target: dock('settings'),
		title: '다크 모드와 배경화면',
		body: '시스템 설정에서 화면 모드와 배경화면(움직이는 배경도)을 바꿀 수 있어요.',
		icon: 'fa-solid fa-gear',
	},
	{
		id: 'launchpad',
		target: dock('launchpad'),
		title: '모든 앱은 Launchpad에',
		body: 'Dock에 없는 앱(미리보기, 텍스트 편집기, 날씨, 활동 상태 보기…)도 여기 다 있어요.',
		icon: 'fa-solid fa-table-cells',
	},
	{
		id: 'server',
		target: '[aria-label^="서버 상태"]',
		title: '이 사이트에는 진짜 서버가 있어요',
		body: '메뉴 막대의 이 표시가 API 서버 상태예요. 눌러서 응답 속도와 API 문서를 볼 수 있어요.',
		icon: 'fa-solid fa-server',
	},
	{
		id: 'about',
		target: 'button[aria-label="Apple 메뉴"]',
		title: '이 사이트는 어떻게 만들었을까',
		body: 'Apple 메뉴 › 이 Mac에 관하여에서 쓴 기술과 서버 구성을 볼 수 있어요.',
		icon: 'fa-brands fa-apple',
	},
	finish,
];

/** 휴대폰 둘러보기 (홈 화면). 다른 쪽에 있어 화면에 안 보이는 앱은 건너뛴다 */
export const PHONE_STEPS: TourStep[] = [
	welcome,
	{
		id: 'resume',
		target: phoneApp('finder'),
		title: '이력서는 파일 앱에',
		body: '둘러보기 › 문서 › 이력서에서 이력서를 읽고 PDF로 받을 수 있어요.',
		icon: 'fa-solid fa-file-lines',
	},
	{
		id: 'projects',
		target: phoneApp('safari'),
		title: '프로젝트는 Safari에서',
		body: '만든 서비스들을 소개 페이지로 모아 뒀어요.',
		icon: 'fa-solid fa-compass',
	},
	{
		id: 'project-apps',
		target: phoneApp('hyeoniverse'),
		title: '배포한 서비스를 앱처럼',
		body: '프로젝트 아이콘을 누르면 실제로 배포한 사이트가 열려요.',
		icon: 'fa-solid fa-rocket',
	},
	{
		id: 'blog',
		target: phoneApp('memo'),
		title: '메모 앱은 블로그예요',
		body: '개발하며 겪은 일과 고민을 글로 남겨요.',
		icon: 'fa-solid fa-note-sticky',
	},
	{
		id: 'photos',
		target: phoneApp('photos'),
		title: '사진은 프로젝트 갤러리',
		body: '프로젝트마다 화면을 앨범으로 모아 뒀어요.',
		icon: 'fa-solid fa-images',
	},
	{
		id: 'github',
		target: phoneApp('github'),
		title: 'GitHub 활동',
		body: '고정한 저장소와 기여 달력을 볼 수 있어요.',
		icon: 'fa-brands fa-github',
	},
	{
		id: 'guestbook',
		target: phoneApp('messages'),
		title: '방명록은 메시지 앱에',
		body: '한마디 남겨 주시면 답장할게요.',
		icon: 'fa-solid fa-comment',
	},
	{
		id: 'mail',
		target: phoneApp('mail'),
		title: '메일은 진짜로 보내져요',
		body: '연락하고 싶으면 메일 앱에서 바로 보내세요.',
		icon: 'fa-solid fa-envelope',
	},
	{
		id: 'music',
		target: phoneApp('music'),
		title: '음악을 틀어 두고 둘러보세요',
		body: '홈 화면의 음악 위젯에서도 재생할 수 있어요.',
		icon: 'fa-solid fa-music',
	},
	{
		id: 'terminal',
		target: phoneApp('terminal'),
		title: '단축어로 자기소개',
		body: '터미널 명령을 타일로 눌러 실행해요. 이력서 타일을 눌러 보세요.',
		icon: 'fa-solid fa-terminal',
	},
	finish,
];

export const stepsFor = (phone: boolean) => (phone ? PHONE_STEPS : DESKTOP_STEPS);

/** 팁 앱에 하나씩 보여 줄 수 있는 단계 (환영·마무리 카드는 뺀다) */
export const tipSteps = (phone: boolean) => stepsFor(phone).filter((step) => step.target);
