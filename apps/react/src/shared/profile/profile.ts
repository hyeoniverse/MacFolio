// 사이트 주인의 프로필 (코드의 기본값. 관리자가 시스템 설정에서 고치면 서버의 값을 쓴다: shared/site/profileStore.ts)

export const PROFILE = {
	name: '김정현',
	nameEn: 'Kim Jeong Hyeon',
	role: 'Frontend Focused Fullstack Developer',
	school: '서울여자대학교',
	location: 'Seoul, South Korea',
	github: 'https://github.com/hyeoniverse',
	email: 'hyeoniverse.dev@gmail.com',
} as const;
