// 사이트 주인의 프로필: 화면과 서버(apps/api)가 함께 쓰는 모양과 한도. 요청 검사(스키마)는 @macfolio/contracts의 ProfileInput
// 이 저장소는 누구나 가져다 자기 사이트로 띄울 수 있게, 프로필을 코드가 아니라 관리자가 시스템 설정에서 고친다.
// 서버에 저장한 값이 없으면 화면은 코드의 기본값(apps/react/src/shared/profile.ts)을 쓴다

export interface SiteProfile {
	/** 이름 (예: 김정현) */
	name: string;
	/** 영문 이름 (예: Kim Jeong Hyeon) */
	nameEn: string;
	/** 직무 */
	role: string;
	school: string;
	location: string;
	/** GitHub 프로필 주소 (https://github.com/<아이디>) */
	github: string;
	email: string;
	/** 다룰 수 있는 기술 */
	skills: { frontend: string[]; backend: string[]; interaction: string[] };
	/** 이 사이트를 만든 기술 */
	siteStack: string[];
}

export const PROFILE_LIMITS = {
	/** 한 줄 값의 길이 */
	text: 80,
	/** 기술 목록 하나의 항목 수와 항목 길이 */
	items: 20,
	item: 40,
} as const;

export const SKILL_GROUPS = ['frontend', 'backend', 'interaction'] as const;

const GITHUB_PROFILE = /^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/?$/;
/** GitHub 아이디 (프로필 주소에서). 주소가 틀리면 빈 문자열 */
export const githubLogin = (profile: Pick<SiteProfile, 'github'>) => GITHUB_PROFILE.exec(profile.github)?.[1] ?? '';
