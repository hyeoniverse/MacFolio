// '이 Mac에 관하여' 창과 시스템 설정의 '정보'가 함께 쓰는 프로필 (값은 shared/profile.ts)
import { PROFILE, SKILLS } from '@/shared/profile';

export const GITHUB_LOGIN = PROFILE.github.split('/').at(-1) ?? '';

/** GitHub 프로필 사진. 132px 동그라미를 레티나 화면에서도 또렷하게 (2배) */
export const PHOTO_URL = `https://github.com/${encodeURIComponent(GITHUB_LOGIN)}.png?size=280`;

export interface ProfileRow {
	label: string;
	value: string;
	/** 누르면 여는 곳 (mailto:는 메일 앱, 나머지는 새 탭) */
	href?: string;
}

/** 이 Mac의 사양 자리에 놓는 프로필 (macOS의 칩·메모리·일련 번호·macOS 줄처럼) */
export const PROFILE_ROWS: ProfileRow[] = [
	{ label: '직무', value: PROFILE.role },
	{ label: '학교', value: PROFILE.school },
	{ label: '위치', value: PROFILE.location },
	{ label: '이메일', value: PROFILE.email, href: `mailto:${PROFILE.email}` },
	{ label: 'GitHub', value: GITHUB_LOGIN, href: PROFILE.github },
	{ label: '주요 기술', value: SKILLS.frontend.slice(0, 3).join(' · ') },
];
