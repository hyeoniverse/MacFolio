// 휴지통의 '지운 기능': 이 사이트를 만들며 버리거나 바꾼 것. 왜 바꿨는지는 개발 일지 글(post)에 있다.
// 날짜는 바꾼 날. 근거가 되는 글이나 커밋이 있는 것만 둔다.
// 줄 수는 그 커밋들의 코드 변경 (잠금 파일, 실수로 넣었던 node_modules, 생성한 openapi.json, 글(.md)은 뺐다)
import oldBlog from './images/old-blog.jpg';
import oldFolders from './images/old-folders.jpg';
import oldMemo from '../memo/content/images/bin-app-old-memo.jpg';
import swagger from './images/swagger.jpg';
import craBenchmark from '../memo/content/images/cra-vite-benchmark.svg';
import githubBefore from '../memo/content/images/github-live-profile-app.jpg';
import visitorBefore from '../memo/content/images/visitor-identity-messages.jpg';

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
	/** 바꾼 커밋 (main의 전체 해시) */
	commits: string[];
	/** 그 커밋들에서 더하고 지운 코드 줄 수 */
	lines: { added: number; deleted: number };
	/** 바꾸기 전 모습: 그때의 커밋을 빌드해 찍은 화면, 또는 그 글의 전후 그림 */
	before?: { src: string; caption: string };
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
		commits: ['f91e6252261782515e95a358a46a7f2dccbc6868'],
		lines: { added: 2693, deleted: 2247 },
		before: { src: craBenchmark, caption: 'CRA와 Vite의 dev 서버 시작·빌드 시간 (cra-to-vite 글)' },
	},
	{
		id: 'firebase',
		name: 'Firebase (방명록 저장, 호스팅)',
		replacedBy: '직접 만든 API 서버(NestJS)와 Cloudflare Workers',
		date: '2026-09-28',
		why: '첫 방명록은 Firebase에 비밀번호를 평문으로 두고, 규칙이 열려 있어 누구나 읽을 수 있었다. 검증을 서버에서 하는 API가 필요했다.',
		post: 'day-0928',
		icon: 'fa-solid fa-fire',
		commits: ['e78847ea8266a3b3bdc61203e98d54d16bf89b4e'],
		lines: { added: 8, deleted: 105 },
	},
	{
		id: 'guestbook-memo',
		name: '방명록이던 메모 앱',
		replacedBy: 'Markdown 블로그 (메모 앱)',
		date: '2026-09-28',
		why: '방명록은 메시지 앱이 맡고, 메모 앱은 개발 일지를 쓰는 블로그가 되었다.',
		post: 'day-0928',
		icon: 'fa-regular fa-note-sticky',
		commits: ['844688c42f90264ce2d4fdee407028c7e4489970'],
		lines: { added: 663, deleted: 1253 },
		before: {
			src: oldMemo,
			caption: '방명록이던 메모 앱 (바꾸기 직전 커밋을 빌드해 찍은 화면). 닉네임과 내용을 적어 남겼다',
		},
	},
	{
		id: 'blog-app',
		name: 'Blog 앱 (예전 블로그를 창에 띄우던 앱)',
		replacedBy: '메모 앱',
		date: '2026-09-28',
		why: '메모 앱이 블로그가 되면서 하는 일이 겹쳤다.',
		post: 'day-0928',
		icon: 'fa-solid fa-blog',
		commits: ['df07a4bf5a483bfc8eb0d614f42231660237fab7'],
		lines: { added: 4, deleted: 66 },
		before: { src: oldBlog, caption: 'Blog 앱 (지우기 직전 커밋). 창에 띄우던 예전 블로그는 이미 404였다' },
	},
	{
		id: 'visitor-folders',
		name: '방문자가 정리하는 메모 폴더',
		replacedBy: '관리자만 정리하고 서버에 저장',
		date: '2026-09-28',
		why: '정적 사이트에서는 관리자를 가릴 수 없고, 브라우저에 저장한 정리는 다른 방문자에게 보여 줄 수 없다.',
		post: 'read-only-memo',
		icon: 'fa-regular fa-folder-open',
		commits: ['a8103b47dd73b8a830ef25558cddcb2145722ab5'],
		lines: { added: 281, deleted: 189 },
		before: { src: oldFolders, caption: "방문자도 '새로운 폴더'를 만들 수 있던 메모 (잠그기 직전 커밋)" },
	},
	{
		id: 'name-password',
		name: '메시지·댓글의 이름과 비밀번호 칸',
		replacedBy: '방문자 쿠키로 정하는 이름 (🦊 날쌘 여우)',
		date: '2026-10-02',
		why: '한 줄 남기려는 사람에게 이름과 비밀번호를 정하게 하는 건 번거롭고, 휴대폰에서는 두 칸이 입력창보다 눈에 띄었다.',
		post: 'visitor-identity',
		icon: 'fa-solid fa-key',
		commits: ['6ce07d77472d9abb5b2889608b2230371a8a920c'],
		lines: { added: 643, deleted: 563 },
		before: {
			src: visitorBefore,
			caption: '전: 이름·비밀번호 칸 / 후: 입력창 위에 자동으로 정한 이름 한 줄 (visitor-identity 글)',
		},
	},
	{
		id: 'github-stats',
		name: '손으로 옮겨 적은 GitHub 프로필과 통계 이미지',
		replacedBy: '서버가 GitHub에서 받아 오는 프로필·README·저장소',
		date: '2026-10-02',
		why: '팔로워 수와 README를 코드에 적어 두어서, GitHub이 바뀌어도 앱은 그대로였다.',
		post: 'github-live-profile',
		icon: 'fa-brands fa-github',
		commits: ['671df0df2b0c5794b51b6f1e1d52bb9405723257'],
		lines: { added: 2650, deleted: 294 },
		before: {
			src: githubBefore,
			caption: '위: 손으로 옮겨 적은 화면 / 아래: 서버가 받은 README를 그린 화면 (github-live-profile 글)',
		},
	},
	{
		id: 'workers-builds',
		name: 'Cloudflare의 빌드 서버',
		replacedBy: 'GitHub Actions에서 빌드하고 wrangler deploy',
		date: '2026-10-03',
		why: '빌드 환경을 띄우지 못하고 시간 초과로 실패하는 일이 이어졌다. 이제 시험을 통과한 main 커밋만 배포한다.',
		post: 'deploy-github-actions',
		icon: 'fa-solid fa-cloud',
		commits: ['466fc33c3d1f4c105a93b80f2b7ba1ed5177ce8e'],
		lines: { added: 91, deleted: 3 },
	},
	{
		id: 'important',
		name: '!important 72개',
		replacedBy: 'CSS @layer와 공통 단추',
		date: '2026-10-01',
		why: '앱마다 둔 단추 기본값이 단추 클래스를 이겨서, 단추마다 색과 글꼴을 !important로 덮어 왔다.',
		post: 'css-layer-reset',
		icon: 'fa-solid fa-exclamation',
		commits: ['f9444130ea947b2694f15e34e361cf748430c9a2', '7596c9f115afb0a2b44254e5cbccc68061196606'],
		lines: { added: 394, deleted: 378 },
	},
	{
		id: 'context-menus',
		name: '앱마다 따로 만든 메뉴 다섯 벌',
		replacedBy: '공통 Menu, useDismiss, placement',
		date: '2026-10-01',
		why: '우클릭 메뉴, Apple 메뉴, 서식 창, 달력이 "바깥을 누르면 닫기"와 "화면 안에 자리 잡기"를 저마다 짜고 있었다.',
		post: 'shared-menu',
		icon: 'fa-solid fa-bars',
		commits: ['627dc429ad1bcf895809d568c605364056f9b857'],
		lines: { added: 403, deleted: 428 },
	},
	{
		id: 'swagger-tab',
		name: '새 탭으로 여는 Swagger 문서',
		replacedBy: '사이트 안의 API 문서 앱 (Scalar)',
		date: '2026-10-05',
		why: 'macOS처럼 꾸민 사이트에서 다른 탭으로 넘어가는 것이 어색했다.',
		post: 'api-docs-app',
		icon: 'fa-solid fa-book',
		commits: ['ee12d4564eddf612a5ea79ffdfc43e6709a57383', 'bf3117d7ced4bb0a455a44abeea03aa0d8285a68'],
		lines: { added: 261, deleted: 183 },
		before: { src: swagger, caption: '서버의 Swagger 화면 (/docs). 예전에는 메뉴에서 이 화면을 새 탭으로 열었다' },
	},
];
