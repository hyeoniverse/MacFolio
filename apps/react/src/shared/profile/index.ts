// 사이트 주인의 프로필과 프로젝트. 여러 앱(GitHub, 터미널 등)이 함께 쓰는 단일 출처.
// 바깥에서는 '@/shared/profile'로 가져온다 (파일을 나누기 전과 같은 경로)
export { PROFILE } from './profile';
export { SITE_STACK, SKILLS } from './skills';
export type {
	Project,
	ProjectAppInfo,
	ProjectChapter,
	ProjectFact,
	ProjectLook,
	ProjectPoint,
	ThemeSwatch,
} from './types';
export { PROJECTS } from './projects';
