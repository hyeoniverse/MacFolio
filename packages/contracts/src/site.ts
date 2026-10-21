// 사이트 주인의 프로필 (apps/api의 /site). 관리자가 시스템 설정에서 고치고, 누구나 읽는다.
// 타입·한도·GitHub 아이디 규칙은 desktop-core/site에 있고, 여기 스키마가 그 타입대로 검사한다 (서버의 저장·화면의 입력 칸이 같은 규칙)
import { z } from 'zod';
import {
	githubLogin,
	PROFILE_LIMITS,
	type SiteProfile as SiteProfileShape,
	type SiteProjects,
} from '@macfolio/desktop-core/site';
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

/**
 * 관리자가 고친 프로젝트 (순서·숨김·덮어쓸 필드·새 프로젝트). 검사는 desktop-core/site의 parseProjects 하나다:
 * 서버만 아는 올린 그림 주소(allowOrigins)를 옵션으로 받아서 스키마가 아니라 함수로 두고, 여기서는 모양만 적는다
 */
const StoredProjects = z.custom<SiteProjects>(
	(value) => typeof value === 'object' && value !== null && Array.isArray((value as { items?: unknown }).items),
	'items 목록을 보내 주세요.'
);

/** 이력서 Markdown 한 장의 한도 (A4 두 쪽이 넉넉히 들어가는 길이) */
export const RESUME_LIMITS = { markdown: 20_000 } as const;

/** 줄바꿈(\n·\r)과 탭 말고 제어 문자가 있는지 (이력서는 여러 줄 글이다) */
const hasControlInText = (value: string) =>
	[...value].some((char) => {
		const code = char.charCodeAt(0);
		return (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) || code === 0x7f;
	});

/**
 * PUT /site/resume 몸통: 이력서 Markdown 한 장. Finder의 이력서 문서·PDF·터미널 resume가 모두 이 글 하나에서 나온다.
 * 줄바꿈은 \n으로 맞추고 앞뒤 빈 줄을 다듬는다
 */
export const ResumeInput = z.object(
	{
		markdown: z.unknown().transform((raw, ctx) => {
			if (typeof raw !== 'string') {
				ctx.addIssue({ code: 'custom', message: '이력서는 글자여야 합니다.' });
				return '';
			}
			const value = raw.replace(/\r\n?/g, '\n').trim();
			if (!value) ctx.addIssue({ code: 'custom', message: '이력서 내용을 입력해 주세요.' });
			else if (value.length > RESUME_LIMITS.markdown)
				ctx.addIssue({
					code: 'custom',
					message: `이력서는 ${RESUME_LIMITS.markdown.toLocaleString('ko-KR')}자까지입니다.`,
				});
			else if (hasControlInText(value))
				ctx.addIssue({ code: 'custom', message: '이력서에 쓸 수 없는 글자가 있습니다.' });
			return value;
		}),
	},
	{ error: '이력서를 보내 주세요.' }
);
export type ResumeInput = z.infer<typeof ResumeInput>;

/** 요청 본문을 검사해 이력서로 바꾼다 */
export const parseResume = (input: unknown) => parse(ResumeInput, input);

/** 저장해 둔 이력서(DB)를 읽을 때: 규칙에 맞으면 그 값, 아니면 null (기본 이력서를 쓴다) */
export function readResume(stored: unknown): ResumeInput | null {
	if (stored === null || stored === undefined) return null;
	const parsed = parseResume(stored);
	return 'value' in parsed ? parsed.value : null;
}

/** GET /site, PUT·DELETE /site/profile·/site/projects·/site/resume의 응답 */
export const SiteView = z.object({
	/** 관리자가 저장한 프로필 (없으면 null: 화면이 코드의 기본값을 쓴다) */
	profile: ProfileInput.nullable(),
	/** 관리자가 고친 프로젝트. 없으면 null: 화면이 코드의 기본값을 쓴다 */
	projects: StoredProjects.nullable(),
	/** 관리자가 저장한 이력서 Markdown. 없으면 null: 화면이 코드의 기본 이력서를 쓴다 (예전 서버는 이 필드가 없다) */
	resume: ResumeInput.nullable().optional(),
	/** ISO 8601. 저장한 적이 없으면 null */
	updatedAt: z.string().nullable(),
});
export type SiteView = z.infer<typeof SiteView>;
