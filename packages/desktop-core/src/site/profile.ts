// 사이트 주인의 프로필: 화면과 서버(apps/api)가 함께 쓰는 모양과 검사.
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
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 줄바꿈·제어 문자는 받지 않는다 (메일 머리, 터미널 출력에 들어간다)
const hasControl = (value: string) =>
	[...value].some((char) => {
		const code = char.charCodeAt(0);
		return code < 0x20 || code === 0x7f;
	});

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/** GitHub 아이디 (프로필 주소에서). 주소가 틀리면 빈 문자열 */
export const githubLogin = (profile: Pick<SiteProfile, 'github'>) => GITHUB_PROFILE.exec(profile.github)?.[1] ?? '';

/**
 * 요청 본문을 검사해 프로필로 바꾼다. 문제가 있으면 모든 이유를 모아 돌려준다.
 * 이름·이메일·GitHub 주소는 꼭 있어야 하고, 나머지 한 줄 값은 비워도 된다. 모르는 필드는 버린다
 */
export function parseProfile(input: unknown): { value: SiteProfile } | { errors: string[] } {
	if (!isRecord(input)) return { errors: ['프로필을 보내 주세요.'] };
	const errors: string[] = [];

	const text = (key: keyof SiteProfile, label: string, required: boolean) => {
		const raw = input[key];
		if (raw !== undefined && typeof raw !== 'string') {
			errors.push(`${label}은(는) 글자여야 합니다.`);
			return '';
		}
		const value = (raw ?? '').trim();
		if (required && !value) errors.push(`${label}을(를) 입력해 주세요.`);
		else if (value.length > PROFILE_LIMITS.text) errors.push(`${label}은(는) ${PROFILE_LIMITS.text}자까지입니다.`);
		else if (hasControl(value)) errors.push(`${label}에 쓸 수 없는 글자가 있습니다.`);
		return value;
	};

	const list = (raw: unknown, label: string) => {
		if (raw === undefined) return [];
		if (!Array.isArray(raw)) {
			errors.push(`${label}은(는) 목록이어야 합니다.`);
			return [];
		}
		const items = raw.map((item) => (typeof item === 'string' ? item.trim() : null));
		if (items.some((item) => item === null)) errors.push(`${label}의 항목은 글자여야 합니다.`);
		const kept = [...new Set(items.filter((item): item is string => Boolean(item)))];
		if (kept.length > PROFILE_LIMITS.items) errors.push(`${label}은(는) ${PROFILE_LIMITS.items}개까지입니다.`);
		if (kept.some((item) => item.length > PROFILE_LIMITS.item || hasControl(item)))
			errors.push(`${label}의 항목은 ${PROFILE_LIMITS.item}자까지, 한 줄로 써 주세요.`);
		return kept;
	};

	const name = text('name', '이름', true);
	const nameEn = text('nameEn', '영문 이름', false);
	const role = text('role', '직무', false);
	const school = text('school', '학교', false);
	const location = text('location', '위치', false);
	const github = text('github', 'GitHub 주소', true);
	if (github && !GITHUB_PROFILE.test(github)) errors.push('GitHub 주소는 https://github.com/아이디 모양이어야 합니다.');
	const email = text('email', '이메일', true);
	if (email && !EMAIL.test(email)) errors.push('이메일 주소가 올바르지 않습니다.');

	const rawSkills = input.skills;
	if (rawSkills !== undefined && !isRecord(rawSkills))
		errors.push('기술은 묶음(frontend·backend·interaction)이어야 합니다.');
	const skillsInput = isRecord(rawSkills) ? rawSkills : {};
	const skills = {
		frontend: list(skillsInput.frontend, '프론트엔드 기술'),
		backend: list(skillsInput.backend, '백엔드 기술'),
		interaction: list(skillsInput.interaction, '인터랙션 기술'),
	};
	const siteStack = list(input.siteStack, '이 사이트를 만든 기술');

	if (errors.length) return { errors: [...new Set(errors)] };
	return {
		value: { name, nameEn, role, school, location, github: github.replace(/\/$/, ''), email, skills, siteStack },
	};
}

/** 저장해 둔 값(DB)을 읽을 때: 규칙에 맞으면 그 값, 아니면 null (기본값을 쓴다) */
export function readProfile(stored: unknown): SiteProfile | null {
	if (stored === null || stored === undefined) return null;
	const parsed = parseProfile(stored);
	return 'value' in parsed ? parsed.value : null;
}
