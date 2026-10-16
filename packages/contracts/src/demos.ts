// 방문자가 실제 AI 서비스를 불러 보는 데모의 몸통: 커버 (/cover), 번역 (/translate), 요약 (/summary), 음성 (/speech).
// 서버는 parse로 검사하고, 데모 화면은 같은 상한·스타일·공급자 목록을 불러 쓴다
import { z } from 'zod';

/* ── 함께 쓰는 규칙 ── */

/** 주소·메일처럼 데모에 필요 없는 것과, 데모에 어울리지 않는 말 몇 가지 */
export const BLOCKED = [/https?:\/\//i, /www\./i, /\S+@\S+\.\S+/, /씨발|시발|병신|좆|fuck|shit|bitch/i];

interface DemoTextRules {
	max: number;
	/** 비었을 때 */
	empty: string;
	/** 막는 말이 있을 때 */
	refused: string;
	/** 길 때 (없으면 "N자까지만 받습니다.") */
	tooLong?: string;
	/** 줄바꿈을 남긴다 (빈 줄만 줄인다). 아니면 줄바꿈까지 띄어쓰기 하나로 줄인다 */
	lines?: boolean;
}

/** 공백 정리 */
const tidy = (raw: string, lines: boolean) =>
	lines
		? raw
				.replace(/\r\n?/g, '\n')
				.replace(/[^\S\n]+/g, ' ')
				.replace(/ ?\n ?/g, '\n')
				.replace(/\n{3,}/g, '\n\n')
				.trim()
		: raw.replace(/\s+/g, ' ').trim();

// 칸이 없어도(undefined) 아래 transform이 돌도록 optional을 앞에 둔다 (빈 글·기본값으로 바꾼다)

/** 몸통의 글 한 칸: 공백을 정리하고, 빈 글·긴 글·제어 문자·막는 말을 거절한다. 글자가 아닌 값은 빈 글로 본다 */
export const demoText = ({ max, empty, refused, tooLong, lines = false }: DemoTextRules) =>
	z
		.unknown()
		.optional()
		.transform((value, ctx) => {
			const text = tidy(typeof value === 'string' ? value : '', lines);
			const reason = !text
				? empty
				: [...text].length > max
					? (tooLong ?? `${max}자까지만 받습니다.`)
					: // 제어 문자는 받지 않는다 (줄바꿈은 위에서 정리했다)
						/[^\P{Cc}\n]/u.test(text)
						? '읽을 수 없는 글자가 있습니다.'
						: BLOCKED.some((pattern) => pattern.test(text))
							? refused
							: null;
			if (reason) {
				ctx.addIssue({ code: 'custom', message: reason });
				return z.NEVER;
			}
			return text;
		});

/** 막아 둘 공급자: 아는 이름만 남긴다 (대체 순서를 보여 주려고 화면에서 고른다). 목록이 아니면 없음 */
const skipOf = <P extends string>(all: readonly P[]) =>
	z
		.unknown()
		.optional()
		.transform((value): P[] => (Array.isArray(value) ? all.filter((provider) => value.includes(provider)) : []));

/** 두 언어 중 하나: en이 아니면 ko */
const lang = z
	.unknown()
	.optional()
	.transform((value): 'ko' | 'en' => (value === 'en' ? 'en' : 'ko'));

/** 몸통이 객체가 아니면(null, 문자열, 없음) 빈 객체로 보고 각 칸의 문구를 알린다 */
const body = <T extends z.ZodRawShape>(shape: T) =>
	z.preprocess((input) => (typeof input === 'object' && input !== null ? input : {}), z.object(shape));

/* ── AI 커버 ── */

/** 공급자 차례: 매일 무료 할당이 다시 채워지는 Cloudflare Workers AI → 실패하면 Hugging Face */
export const COVER_PROVIDERS = ['cloudflare', 'huggingface'] as const;
export type CoverProvider = (typeof COVER_PROVIDERS)[number];
/** 제목 글자 수 상한 */
export const MAX_COVER_CHARS = 60;
/** HYEONIVERSE 커버 선택창의 스타일 열 가지 */
export const COVER_STYLE_KEYS = [
	'abstract',
	'minimal',
	'geometric',
	'photographic',
	'illustration',
	'watercolor',
	'cyberpunk',
	'vintage',
	'3d-render',
	'flat-design',
] as const;
export type CoverStyle = (typeof COVER_STYLE_KEYS)[number];

/** 그릴 커버 (POST /cover). 모르는 스타일은 abstract (HYEONIVERSE 기본) */
export const CoverInput = body({
	title: demoText({
		max: MAX_COVER_CHARS,
		empty: '커버로 그릴 제목을 써 주세요.',
		refused: '이 제목으로는 그려 드릴 수 없습니다.',
	}),
	style: z
		.unknown()
		.optional()
		.transform((value): CoverStyle =>
			COVER_STYLE_KEYS.includes(value as CoverStyle) ? (value as CoverStyle) : 'abstract'
		),
	skip: skipOf(COVER_PROVIDERS),
});
export type CoverInput = z.infer<typeof CoverInput>;

/* ── 번역 ── */

/** 공급자 차례: DeepL → 실패하면 Google */
export const TRANSLATE_PROVIDERS = ['deepl', 'google'] as const;
export type TranslateProvider = (typeof TRANSLATE_PROVIDERS)[number];
/** 한 번에 번역할 글자 수 상한 (칸을 모두 합쳐서) */
export const MAX_TRANSLATE_CHARS = 200;
/** 한 번에 보낼 칸 수 (HYEONIVERSE 편집기처럼 빈 칸을 한 번에 채운다) */
export const MAX_TRANSLATE_FIELDS = 3;

const translateText = demoText({
	max: MAX_TRANSLATE_CHARS,
	empty: '번역할 글을 써 주세요.',
	refused: '이 글은 번역해 드릴 수 없습니다.',
});

/** 번역할 글 (POST /translate). 칸 하나는 text로, 여러 칸은 texts로 받는다. 도착 언어는 늘 다른 쪽이다 */
export const TranslateInput = z
	.preprocess(
		(input) => {
			const fields = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
			return { ...fields, texts: Array.isArray(fields.texts) ? fields.texts : [fields.text] };
		},
		z.object({
			// 칸 수를 먼저 본다 (넘으면 칸마다 검사하지 않는다)
			texts: z
				.array(z.unknown())
				.max(MAX_TRANSLATE_FIELDS, `${MAX_TRANSLATE_FIELDS}칸까지만 번역합니다.`)
				.pipe(z.array(translateText))
				// 칸마다가 아니라 모두 합쳐 상한을 센다
				.refine(
					(texts) => [...texts.join('')].length <= MAX_TRANSLATE_CHARS,
					`모두 합쳐 ${MAX_TRANSLATE_CHARS}자까지만 번역합니다.`
				),
			from: lang,
			skip: skipOf(TRANSLATE_PROVIDERS),
		})
	)
	.transform(({ texts, from, skip }) => ({ texts, from, to: from === 'ko' ? ('en' as const) : ('ko' as const), skip }));
export type TranslateInput = z.infer<typeof TranslateInput>;

/* ── AI 요약 ── */

/** 요약 공급자 순서: Groq가 기본, 실패하면 Gemini */
export const SUMMARY_PROVIDERS = ['groq', 'gemini'] as const;
export type SummaryProvider = (typeof SUMMARY_PROVIDERS)[number];
/** 한 번에 요약할 글자 수 상한 */
export const MAX_SUMMARY_CHARS = 800;

/** 요약할 글 (POST /summary). 줄바꿈은 남긴다 */
export const SummaryInput = body({
	text: demoText({
		max: MAX_SUMMARY_CHARS,
		empty: '요약할 글을 써 주세요.',
		refused: '이 글은 요약해 드릴 수 없습니다.',
		lines: true,
	}),
});
export type SummaryInput = z.infer<typeof SummaryInput>;

/* ── 음성 ── */

/** 공급자 차례: 가장 자연스러운 Fish → 공식 API인 Google → 키가 필요 없는 Edge */
export const SPEECH_PROVIDERS = ['fish', 'google', 'edge'] as const;
export type SpeechProvider = (typeof SPEECH_PROVIDERS)[number];
/** 한 번에 읽을 글자 수 상한 */
export const MAX_SPEECH_CHARS = 80;

/** 읽을 글 (POST /speech) */
export const SpeechInput = body({
	text: demoText({
		max: MAX_SPEECH_CHARS,
		empty: '읽을 글을 써 주세요.',
		refused: '이 글은 읽어 드릴 수 없습니다.',
		tooLong: `${MAX_SPEECH_CHARS}자까지만 읽습니다.`,
	}),
	lang,
	skip: skipOf(SPEECH_PROVIDERS),
});
export type SpeechInput = z.infer<typeof SpeechInput>;
