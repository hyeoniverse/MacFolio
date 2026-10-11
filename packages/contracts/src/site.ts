// 사이트 주인의 프로필 (apps/api의 /site). 관리자가 시스템 설정에서 고치고, 누구나 읽는다.
// 타입·한도·GitHub 아이디 규칙은 desktop-core/site에 있고, 여기 스키마가 그 타입대로 검사한다 (서버의 저장·화면의 입력 칸이 같은 규칙)
import { z } from 'zod';
import { githubLogin, PROFILE_LIMITS, type SiteProfile as SiteProfileShape } from '@macfolio/desktop-core/site';
import { parse } from './parse.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** 줄바꿈·제어 문자는 받지 않는다 (메일 머리, 터미널 출력에 들어간다) */
const hasControl = (value: string) =>
	[...value].some((char) => {
		const code = char.charCodeAt(0);
		return code < 0x20 || code === 0x7f;
	});

/** 한 줄 값: 다듬고, 필수면 비었는지, 길이, 제어 문자 순으로 처음 어긋난 것 하나 */
const text = (label: string, required: boolean) =>
	z
		.unknown()
		.optional()
		.transform((raw, ctx) => {
			if (raw !== undefined && typeof raw !== 'string') {
				ctx.addIssue({ code: 'custom', message: `${label}은(는) 글자여야 합니다.` });
				return '';
			}
			const value = (raw ?? '').trim();
			if (required && !value) ctx.addIssue({ code: 'custom', message: `${label}을(를) 입력해 주세요.` });
			else if (value.length > PROFILE_LIMITS.text)
				ctx.addIssue({ code: 'custom', message: `${label}은(는) ${PROFILE_LIMITS.text}자까지입니다.` });
			else if (hasControl(value)) ctx.addIssue({ code: 'custom', message: `${label}에 쓸 수 없는 글자가 있습니다.` });
			return value;
		});

/** 기술 목록: 다듬고, 빈 항목·겹친 항목을 빼고, 개수와 항목 길이를 본다 */
const list = (label: string) =>
	z
		.unknown()
		.optional()
		.transform((raw, ctx) => {
			if (raw === undefined) return [] as string[];
			if (!Array.isArray(raw)) {
				ctx.addIssue({ code: 'custom', message: `${label}은(는) 목록이어야 합니다.` });
				return [] as string[];
			}
			const items = raw.map((item) => (typeof item === 'string' ? item.trim() : null));
			if (items.some((item) => item === null))
				ctx.addIssue({ code: 'custom', message: `${label}의 항목은 글자여야 합니다.` });
			const kept = [...new Set(items.filter((item): item is string => Boolean(item)))];
			if (kept.length > PROFILE_LIMITS.items)
				ctx.addIssue({ code: 'custom', message: `${label}은(는) ${PROFILE_LIMITS.items}개까지입니다.` });
			if (kept.some((item) => item.length > PROFILE_LIMITS.item || hasControl(item)))
				ctx.addIssue({ code: 'custom', message: `${label}의 항목은 ${PROFILE_LIMITS.item}자까지, 한 줄로 써 주세요.` });
			return kept;
		});

/**
 * PUT /site/profile 몸통. 이름·이메일·GitHub 주소는 꼭 있어야 하고, 나머지 한 줄 값은 비워도 된다.
 * 이유는 칸 순서대로 모두 모은다. 모르는 필드는 버린다
 */
export const ProfileInput: z.ZodType<SiteProfileShape, unknown> = z.object(
	{
		name: text('이름', true),
		nameEn: text('영문 이름', false),
		role: text('직무', false),
		school: text('학교', false),
		location: text('위치', false),
		github: text('GitHub 주소', true)
			.refine(
				(github) => !github || githubLogin({ github }) !== '',
				'GitHub 주소는 https://github.com/아이디 모양이어야 합니다.'
			)
			.transform((github) => github.replace(/\/$/, '')),
		email: text('이메일', true).refine((email) => !email || EMAIL.test(email), '이메일 주소가 올바르지 않습니다.'),
		skills: z.preprocess(
			(value) => (value === undefined ? {} : value),
			z.object(
				{ frontend: list('프론트엔드 기술'), backend: list('백엔드 기술'), interaction: list('인터랙션 기술') },
				{ error: '기술은 묶음(frontend·backend·interaction)이어야 합니다.' }
			)
		),
		siteStack: list('이 사이트를 만든 기술'),
	},
	{ error: '프로필을 보내 주세요.' }
);
export type ProfileInput = SiteProfileShape;

/** 요청 본문을 검사해 프로필로 바꾼다. 문제가 있으면 모든 이유를 모아 돌려준다 */
export const parseProfile = (input: unknown) => parse(ProfileInput, input);

/** 저장해 둔 값(DB)을 읽을 때: 규칙에 맞으면 그 값, 아니면 null (기본값을 쓴다) */
export function readProfile(stored: unknown): SiteProfileShape | null {
	if (stored === null || stored === undefined) return null;
	const parsed = parseProfile(stored);
	return 'value' in parsed ? parsed.value : null;
}

/** GET /site, PUT·DELETE /site/profile의 응답 */
export const SiteView = z.object({
	/** 관리자가 저장한 프로필 (없으면 null: 화면이 코드의 기본값을 쓴다) */
	profile: ProfileInput.nullable(),
	/** ISO 8601. 저장한 적이 없으면 null */
	updatedAt: z.string().nullable(),
});
export type SiteView = z.infer<typeof SiteView>;
