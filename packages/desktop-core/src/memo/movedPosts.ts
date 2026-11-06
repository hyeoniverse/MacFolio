import { postSlug, type PostSlug } from './rules.js';

/**
 * 합치거나 옮긴 글의 옛 주소 → 지금 주소. 값은 `<글 주소>` 또는 `<글 주소>#<제목 id>`(옛 글의 내용이 들어간 절).
 * 검색엔진 색인과 바깥 링크에 남은 옛 주소가 404가 되지 않게 Worker가 301로 넘긴다(worker/index.ts).
 * 앱 번들에는 넣지 않는다(첫 화면 번들 예산). 저장소 글 링크는 지금 주소로 고쳐 쓴다(content.test.ts가 검사한다)
 */
export const MOVED_POSTS: Readonly<Record<string, string>> = {
	// 2026-11: 일별 회고를 주간 회고로, 같은 주제를 나눠 쓴 개발 기록을 한 글로 합쳤다
	'analytics-public': 'analytics-api#요약을-방문자에게-공개한다-세션에-따라-응답-범위를-나눈다',
	'bin-empty-state': 'bin-app#빈-휴지통-아이콘과-빈-창',
	'color-tokens': 'design-tokens#색---color--토큰과-apple-시스템-색-이름-249',
	'contracts-analytics': 'contracts-package#분석-이벤트의-전송수신조회-형식-206',
	'contracts-comments': 'contracts-package#댓글좋아요-스키마-200',
	'contracts-contact': 'contracts-validation#연락-메일-칸마다-첫-실패-문구-하나-203',
	'contracts-files': 'contracts-validation#업로드-파일-화면이-알아야-하는-값만-contracts로-205',
	'contracts-messages': 'contracts-package#메시지-스키마와-두-저장소-구현-202',
	'contracts-posts': 'contracts-package#블로그-글-스키마를-desktop-core-타입에-고정하기-201',
	'contracts-site': 'contracts-validation#사이트-프로필-배치-규칙에-맞춰-desktop-core에서-옮기기-207',
	'contracts-wallpapers': 'contracts-validation#배경화면-이름-한도-40과-정리-함수-204',
	'creative-css-dedupe': 'css-cleanup-tools#중복-규칙-삭제-creativepartscss와-hyeoniversepagecss',
	'day-0929': 'week-0928#api-서버와-관리자-로그인',
	'day-0930': 'week-0928#api-서버-배포와-서버-반영',
	'day-1001': 'week-0928#공통-컴포넌트-important-72개를-0개로',
	'day-1002': 'week-0928#메시지댓글의-방문자-쿠키',
	'day-1003': 'week-0928#프론트엔드-배포-시험을-통과한-커밋만',
	'day-1005': 'week-1005#서버-운영-백업자동-배포감시',
	'day-1006': 'week-1005#메뉴-막대-서버-상태앱별-메뉴단축키',
	'day-1007': 'week-1005#main에서만-실패한-시험과-생략된-api-배포',
	'day-1008': 'week-1005#휴대폰-화면과-퇴장-애니메이션',
	'day-1010': 'week-1005#보안-점검-목록',
	'day-1011': 'week-1005#리팩터링-계획과-contracts-패키지',
	'day-1012': 'week-1012#공통-컴포넌트와-리팩터링-계획-완료',
	'day-1013': 'week-1012#187-프로젝트-페이지-템플릿',
	'day-1014': 'week-1012#포트폴리오-필수-섹션-세-가지-14일',
	'day-1015': 'week-1012#메모-편집기',
	'day-1016': 'week-1012#휴대폰-화면-pr-다섯-16일',
	'day-1017': 'week-1012#187-프로젝트-페이지-템플릿',
	'day-1018': 'week-1012#계획-완료-18일',
	'day-1019': 'week-1019#finder-미리보기-파일',
	'day-1021': 'week-1019#markdown-이력서와-텍스트-편집기-21일',
	'day-1022': 'week-1019#첫-방문-성능',
	'day-1023': 'week-1019#메모-앱',
	'day-1024': 'week-1019#머지-뒤-연달아-실패한-ci-22일24일',
	'day-1026': 'week-1026#글꼴-os와-관계없이-같은-글꼴로-26일',
	'day-1027': 'week-1026#메모-검색-27일',
	'day-20240827': 'history-2024-2025#첫-커밋-빌드-도구-없는-세-파일',
	'day-20241011': 'history-2024-2025#cra와-typescript로-이전-2024년-10월-11일',
	'day-20241013': 'history-2024-2025#앱-상태를-appcontext-하나로-2024년-10월-13일',
	'day-20241014': 'history-2024-2025#최소화-애니메이션-위치-저장-최대화-2024년-10월-14일',
	'day-20241015': 'history-2024-2025#메모-앱-첫판-데이터는-코드-안에-2024년-10월-15일',
	'day-20241021': 'history-2024-2025#express와-mysql-메모-단위-비밀번호-2024년-10월-2122일',
	'day-20241026': 'history-2024-2025#node_modules-6만-개-커밋-2024년-10월-27일',
	'day-20241104': 'history-2024-2025#webpack-캐시-커밋-2024년-11월-4일',
	'day-20241222': 'history-2024-2025#서버-삭제와-firebase-이전-2024년-12월-23일',
	'day-20250323': 'history-2024-2025#vite-6으로-이전-2025년-3월-23일',
	'dependency-vulnerabilities': 'supply-chain-security#하위-의존성-취약점과-pnpm-overrides',
	'desktop-core-memo': 'desktop-core-stores#메모-값-검사와-localstorage-읽기쓰기-분리',
	'desktop-core-music': 'desktop-core-stores#음악-결과-값을-돌려주는-플레이어-store',
	'desktop-core-windows': 'desktop-core-stores#창-관리-작은-store와-usesyncexternalstore',
	'finder-home-tree': 'finder-filesystem#가상본이-빈-폴더로-열린-원인',
	'font-size-tokens': 'design-tokens#글자-크기-apple-hig-스타일-이름의---text--234',
	'memo-css-split': 'css-cleanup-tools#memocss-분할-선언-순서-유지',
	'memo-keyboard-toolbar': 'ios-keyboard-viewport#메모-서식-막대를-키보드-위에-붙이기',
	'messages-layout-fixes': 'ios-keyboard-viewport#메시지-앱-화면을-비주얼-뷰포트에-맞추기',
	'pin-actions-dependabot': 'supply-chain-security#github-actions-커밋-sha-고정과-dependabot',
	'profile-split': 'module-splitting#import-경로를-유지하는-indexts-재내보내기-sharedprofile',
	'radius-tokens': 'design-tokens#모서리-반경---radius--여섯-값-232',
	'refactor-step1-types': 'refactor-retrospective#1단계-타입과-데이터-구조',
	'refactor-step2-structure': 'refactor-retrospective#2단계-폴더-구조와-의존',
	'refactor-step3-foundation': 'refactor-retrospective#3단계-공통-기반-코드',
	'refactor-step4-components': 'refactor-retrospective#4단계-공통-컴포넌트',
	'refactor-step5-styles': 'refactor-retrospective#5단계-스타일',
	'refactor-step6-server': 'refactor-retrospective#6단계-서버',
	'refactor-step7-security': 'refactor-retrospective#7단계-보안',
	'secret-scanning': 'supply-chain-security#gitleaks로-저장소-기록-전체의-비밀-값-검사',
	'server-status-blocked-origin': 'server-status-wifi#no-cors-요청으로-cors-차단과-서버-중지-구분',
	'settings-schemas': 'contracts-validation#관리자-설정과-ai-데모의-if-문-일곱-개-235236',
	'shadow-space-tokens': 'design-tokens#그림자와-간격---shadow---space--248',
	'shared-api-client': 'shared-modules#서버-호출-apiapifetch',
	'shared-media': 'shared-modules#화면-조건-조회-mediats와-getviewport',
	'shared-storage': 'shared-modules#브라우저-저장소-readjsonwritejson',
	'shared-text-button': 'shared-button#button-텍스트-버튼-6종-통합',
	'site-performance-remeasure': 'site-performance-lcp-budget#운영-사이트-재측정',
	'site-performance-report': 'site-performance-diet#병목-분석',
	'split-creative-demos': 'module-splitting#둘-이상이-쓰는-코드만-공유-모듈로-creativedemos',
	'split-sidebar-photos': 'module-splitting#서로-쓰는-타입은-model-파일로-폴더-사이드바와-사진-앱',
	'ui-inventory': 'ui-modal#공통-부품-집계',
	'unused-css-selectors': 'css-cleanup-tools#사용하지-않는-css-클래스-삭제',
	'z-index-layers': 'design-tokens#z-index-층-흩어진-숫자를---z--변수로-모으기-231',
};

/** 옮긴 글이 지금 있는 곳 */
export interface MovedPost {
	slug: PostSlug;
	/** 옛 글의 내용이 들어간 절의 제목 id (`#` 없이). 글 전체면 null */
	heading: string | null;
}

/** 옛 주소면 지금 주소, 옮기지 않은 글이면 null */
export function movedPost(slug: string): MovedPost | null {
	const target = Object.hasOwn(MOVED_POSTS, slug) ? MOVED_POSTS[slug] : undefined;
	if (!target) return null;
	const [to, heading] = target.split('#');
	const moved = postSlug(to);
	return moved ? { slug: moved, heading: heading || null } : null;
}

/** 경로(`/memo/<옛 주소>`)가 옮긴 글이면 지금 경로(`/memo/<주소>#<제목 id>`), 아니면 null */
export function movedPostPath(pathname: string): string | null {
	const match = /^\/memo\/([\w-]+)\/?$/.exec(pathname);
	const moved = match ? movedPost(match[1]) : null;
	if (!moved) return null;
	return `/memo/${moved.slug}${moved.heading ? `#${moved.heading}` : ''}`;
}
