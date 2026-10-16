// 관리자 설정 화면이 보내는 몸통: 사진 캡션 (/photos/captions), 사람 확인 (/security), GitHub 앱 저장소 (/github/showcase).
// 서버는 parse로 검사하고, 설정 화면은 같은 타입으로 보낸다
import { z } from 'zod';

/* ── 사진 캡션 ── */

/** 캡션 길이 (DB CHECK 제약과 같다) */
export const CAPTION_MAX = 200;
/** 사진 주소 길이 */
export const PHOTO_SRC_MAX = 500;

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/g;
// 있는지 볼 때는 g 없이 (g가 있으면 test가 lastIndex를 이어 써서 번갈아 틀린다)
// eslint-disable-next-line no-control-regex
const HAS_CONTROL = /[\u0000-\u001f\u007f]/;

/** 사진 주소: 사이트 안의 경로(/로 시작)나 https 주소. 제어 문자 없이 500자까지 */
const isPhotoSrc = (src: string) =>
	src.length <= PHOTO_SRC_MAX && !HAS_CONTROL.test(src) && (/^\/[^/]/.test(src) || /^https:\/\//.test(src));

/**
 * 고칠 캡션 (PUT /photos/captions). 캡션은 제어 문자를 빼고 앞뒤 공백을 지운 뒤 200자까지 (넘으면 거절),
 * 비면 null(고친 것을 지우고 원래 캡션으로)
 */
export const CaptionInput = z.object(
	{
		src: z.string({ error: '사진 주소가 잘못되었습니다.' }).refine(isPhotoSrc, '사진 주소가 잘못되었습니다.'),
		caption: z
			.string({ error: '캡션은 글자여야 합니다.' })
			.transform((caption) => caption.replace(CONTROL, '').trim())
			.refine((caption) => Array.from(caption).length <= CAPTION_MAX, `캡션은 ${CAPTION_MAX}자까지 쓸 수 있습니다.`)
			.transform((caption) => caption || null),
	},
	{ error: '본문이 비었습니다.' }
);
export type CaptionInput = z.infer<typeof CaptionInput>;

/* ── 사람 확인 (Turnstile) ── */

/** 사람 확인을 켜고 끄는 곳 */
export const HUMAN_CHECKS = ['contact', 'comment', 'message'] as const;
export type HumanCheck = (typeof HUMAN_CHECKS)[number];

const toggle = (key: HumanCheck) => z.boolean({ error: `${key}는 켜기(true)나 끄기(false)여야 합니다.` }).optional();

/** 바꿀 값 (PUT /security): 켜고 끌 곳만 true/false로. 다른 키가 있거나 바꿀 것이 없으면 거절 */
export const SecurityUpdate = z
	.strictObject(
		{ contact: toggle('contact'), comment: toggle('comment'), message: toggle('message') },
		{
			error: (issue) =>
				issue.code === 'unrecognized_keys' ? `알 수 없는 설정입니다: ${issue.keys.join(', ')}` : '설정을 보내 주세요.',
		}
	)
	// 다른 키·값이 틀렸으면 그 이유만 알린다 ("바꿀 설정이 없습니다"를 덧붙이지 않는다)
	.refine((value) => Object.values(value).some((field) => field !== undefined), {
		error: '바꿀 설정이 없습니다.',
		when: (payload) => payload.issues.length === 0,
	});
export type SecurityUpdate = z.infer<typeof SecurityUpdate>;

/* ── GitHub 앱에 보여 줄 저장소 ── */

/** GitHub의 Pinned처럼 6개까지 */
export const MAX_SHOWCASE = 6;

/** "owner/이름". owner는 GitHub 계정·조직 이름 규칙, 이름은 영문·숫자·. _ - */
const FULL_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;

export const isFullName = (value: unknown): value is string =>
	typeof value === 'string' && FULL_NAME.test(value) && !value.endsWith('/.') && !value.endsWith('/..');

/** 같은 저장소인지 (GitHub 이름은 대소문자를 가리지 않는다) */
export const sameRepo = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** PUT /github/showcase 몸통: { repos: ["owner/이름", ...] }. 6개까지, 같은 저장소는 한 번 */
export const ShowcaseInput = z.object(
	{
		repos: z
			.array(
				z.custom<string>(isFullName, {
					error: (issue) => `저장소 이름이 올바르지 않습니다: ${String(issue.input)}`,
				}),
				{ error: 'repos는 "owner/이름" 목록이어야 합니다.' }
			)
			.max(MAX_SHOWCASE, `저장소는 ${MAX_SHOWCASE}개까지 고를 수 있습니다.`)
			.superRefine((repos, ctx) => {
				repos.forEach((repo, index) => {
					if (repos.slice(0, index).some((other) => sameRepo(other, repo)))
						ctx.addIssue({ code: 'custom', message: `같은 저장소가 두 번 있습니다: ${repo}` });
				});
			}),
	},
	{ error: 'repos는 "owner/이름" 목록이어야 합니다.' }
);
export type ShowcaseInput = z.infer<typeof ShowcaseInput>;
