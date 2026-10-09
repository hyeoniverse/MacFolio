// 휴지통의 '지운 기능': 이 사이트를 만들며 버리거나 바꾼 것. 왜 바꿨는지는 개발 일지 글(post)에 있다.
// 날짜는 바꾼 날. 근거가 되는 글이나 커밋이 있는 것만 둔다

export interface RemovedItem {
	id: string;
	/** 버린 것 */
	name: string;
	/** 대신 쓰는 것 */
	replacedBy: string;
	/** 바꾼 날 (YYYY-MM-DD) */
	date: string;
	/** 바꾼 까닭 */
	why: string;
	/** 자세한 이야기가 있는 블로그 글 (메모 앱의 글 주소) */
	post?: string;
	/** 아이콘 (Font Awesome) */
	icon: string;
}

export const REMOVED: RemovedItem[] = [
	{
		id: 'cra',
		name: 'Create React App',
		replacedBy: 'Vite',
		date: '2025-03-23',
		why: 'React 팀이 2025년 2월에 CRA를 공식적으로 deprecated했다. Vite로 옮기자 개발 서버 시작이 5.05초에서 0.58초로 줄었다.',
		post: 'cra-to-vite',
		icon: 'fa-brands fa-react',
	},
	{
		id: 'firebase',
		name: 'Firebase (방명록 저장, 호스팅)',
		replacedBy: '직접 만든 API 서버(NestJS)와 Cloudflare Workers',
		date: '2026-09-28',
		why: '첫 방명록은 Firebase에 비밀번호를 평문으로 두고, 규칙이 열려 있어 누구나 읽을 수 있었다. 검증을 서버에서 하는 API가 필요했다.',
		post: 'day-0928',
		icon: 'fa-solid fa-fire',
	},
	{
		id: 'guestbook-memo',
		name: '방명록이던 메모 앱',
		replacedBy: 'Markdown 블로그 (메모 앱)',
		date: '2026-09-28',
		why: '방명록은 메시지 앱이 맡고, 메모 앱은 개발 일지를 쓰는 블로그가 되었다.',
		post: 'day-0928',
		icon: 'fa-regular fa-note-sticky',
	},
	{
		id: 'blog-app',
		name: 'Blog 앱 (예전 블로그를 창에 띄우던 앱)',
		replacedBy: '메모 앱',
		date: '2026-09-28',
		why: '메모 앱이 블로그가 되면서 하는 일이 겹쳤다.',
		post: 'day-0928',
		icon: 'fa-solid fa-blog',
	},
	{
		id: 'visitor-folders',
		name: '방문자가 정리하는 메모 폴더',
		replacedBy: '관리자만 정리하고 서버에 저장',
		date: '2026-09-29',
		why: '정적 사이트에서는 관리자를 가릴 수 없고, 브라우저에 저장한 정리는 다른 방문자에게 보여 줄 수 없다.',
		post: 'read-only-memo',
		icon: 'fa-regular fa-folder-open',
	},
	{
		id: 'name-password',
		name: '메시지·댓글의 이름과 비밀번호 칸',
		replacedBy: '방문자 쿠키로 정하는 이름 (🦊 날쌘 여우)',
		date: '2026-10-02',
		why: '한 줄 남기려는 사람에게 이름과 비밀번호를 정하게 하는 건 번거롭고, 휴대폰에서는 두 칸이 입력창보다 눈에 띄었다.',
		post: 'visitor-identity',
		icon: 'fa-solid fa-key',
	},
	{
		id: 'github-stats',
		name: '손으로 옮겨 적은 GitHub 프로필과 통계 이미지',
		replacedBy: '서버가 GitHub에서 받아 오는 프로필·README·저장소',
		date: '2026-10-02',
		why: '팔로워 수와 README를 코드에 적어 두어서, GitHub이 바뀌어도 앱은 그대로였다.',
		post: 'github-live-profile',
		icon: 'fa-brands fa-github',
	},
	{
		id: 'workers-builds',
		name: 'Cloudflare의 빌드 서버',
		replacedBy: 'GitHub Actions에서 빌드하고 wrangler deploy',
		date: '2026-10-03',
		why: '빌드 환경을 띄우지 못하고 시간 초과로 실패하는 일이 이어졌다. 이제 시험을 통과한 main 커밋만 배포한다.',
		post: 'deploy-github-actions',
		icon: 'fa-solid fa-cloud',
	},
	{
		id: 'important',
		name: '!important 72개',
		replacedBy: 'CSS @layer와 공통 단추',
		date: '2026-10-01',
		why: '앱마다 둔 단추 기본값이 단추 클래스를 이겨서, 단추마다 색과 글꼴을 !important로 덮어 왔다.',
		post: 'css-layer-reset',
		icon: 'fa-solid fa-exclamation',
	},
	{
		id: 'context-menus',
		name: '앱마다 따로 만든 메뉴 다섯 벌',
		replacedBy: '공통 Menu, useDismiss, placement',
		date: '2026-10-01',
		why: '우클릭 메뉴, Apple 메뉴, 서식 창, 달력이 "바깥을 누르면 닫기"와 "화면 안에 자리 잡기"를 저마다 짜고 있었다.',
		post: 'shared-menu',
		icon: 'fa-solid fa-bars',
	},
	{
		id: 'swagger-tab',
		name: '새 탭으로 여는 Swagger 문서',
		replacedBy: '사이트 안의 API 문서 앱 (Scalar)',
		date: '2026-10-05',
		why: 'macOS처럼 꾸민 사이트에서 다른 탭으로 넘어가는 것이 어색했다.',
		post: 'api-docs-app',
		icon: 'fa-solid fa-book',
	},
];
