// '이 Mac에 관하여' 창과 시스템 설정의 '정보'가 함께 쓰는 프로필 줄 (값은 shared/site/profileStore.ts)
import { githubLogin, type SiteProfile } from '@/shared/site/profileStore';

export interface ProfileRow {
	label: string;
	value: string;
	/** 누르면 여는 곳 (mailto:는 메일 앱, 나머지는 새 탭) */
	href?: string;
}

/** 이 Mac의 사양 자리에 놓는 프로필 (macOS의 칩·메모리·일련 번호·macOS 줄처럼). 비운 값은 줄째 뺀다 */
export const profileRows = (profile: SiteProfile): ProfileRow[] =>
	[
		{ label: '직무', value: profile.role },
		{ label: '학교', value: profile.school },
		{ label: '위치', value: profile.location },
		{ label: '이메일', value: profile.email, href: `mailto:${profile.email}` },
		{ label: 'GitHub', value: githubLogin(profile), href: profile.github },
		{ label: '주요 기술', value: profile.skills.frontend.slice(0, 3).join(' · ') },
	].filter((row) => row.value);

/** '김정현 (Kim Jeong Hyeon)', 영문 이름이 없으면 이름만 */
export const fullName = (profile: SiteProfile) =>
	profile.nameEn ? `${profile.name} (${profile.nameEn})` : profile.name;
