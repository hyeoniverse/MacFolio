// 번역 데모의 규칙: 받을 글과 언어, 공급자 차례. 바깥 호출 없이 시험할 수 있게 여기에 모은다.
import { DemoInputError, demoText, pickProviders } from '../common/demo.js';

/** 공급자 차례 (HYEONIVERSE 번역 기본과 같다): DeepL → 실패하면 Google */
export const TRANSLATE_PROVIDERS = ['deepl', 'google'] as const;
export type TranslateProvider = (typeof TRANSLATE_PROVIDERS)[number];
export type TranslateLang = 'ko' | 'en';

/** 한 번에 번역할 글자 수 상한 (칸을 모두 합쳐서. 데모라 짧게) */
export const MAX_TRANSLATE_CHARS = 200;
/** 한 번에 보낼 칸 수 (HYEONIVERSE 편집기처럼 빈 칸을 한 번에 채운다) */
export const MAX_TRANSLATE_FIELDS = 3;

export interface TranslateRequest {
	/** 번역할 칸들 (차례 그대로 돌려준다) */
	texts: string[];
	from: TranslateLang;
	to: TranslateLang;
	/** 막아 둔 공급자: 대체 순서를 보여 주려고 화면에서 고른다 */
	skip: TranslateProvider[];
}

/** 몸통을 검사해 요청으로 바꾼다. 맞지 않으면 사람이 읽을 이유를 던진다 */
export function parseTranslateRequest(body: unknown): TranslateRequest {
	const input = (body ?? {}) as Record<string, unknown>;
	// 칸 하나는 text로, 여러 칸은 texts로 받는다
	const raw = Array.isArray(input.texts) ? input.texts : [input.text];
	if (raw.length > MAX_TRANSLATE_FIELDS) throw new DemoInputError(`${MAX_TRANSLATE_FIELDS}칸까지만 번역합니다.`);
	const rules = {
		max: MAX_TRANSLATE_CHARS,
		empty: '번역할 글을 써 주세요.',
		refused: '이 글은 번역해 드릴 수 없습니다.',
	};
	const texts = raw.map((value) => demoText(value, rules));
	// 칸마다가 아니라 모두 합쳐 상한을 센다
	if ([...texts.join('')].length > MAX_TRANSLATE_CHARS)
		throw new DemoInputError(`모두 합쳐 ${MAX_TRANSLATE_CHARS}자까지만 번역합니다.`);
	const from: TranslateLang = input.from === 'en' ? 'en' : 'ko';
	// 두 언어뿐이라 도착 언어는 늘 다른 쪽이다
	const to: TranslateLang = from === 'ko' ? 'en' : 'ko';
	return { texts, from, to, skip: pickProviders(TRANSLATE_PROVIDERS, input.skip) };
}
