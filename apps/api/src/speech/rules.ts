// 음성 만들기 데모의 규칙: 받을 글, 공급자 차례. 바깥 호출 없이 시험할 수 있게 여기에 모은다.
// 하루 상한과 막는 말은 다른 데모와 함께 쓴다 (common/demo.ts)
import { BLOCKED } from '../common/demo.js';

export { DailyQuota } from '../common/demo.js';

/** 공급자 차례 (HYEONIVERSE와 같다): 가장 자연스러운 Fish → 공식 API인 Google → 키가 필요 없는 Edge */
export const SPEECH_PROVIDERS = ['fish', 'google', 'edge'] as const;
export type SpeechProvider = (typeof SPEECH_PROVIDERS)[number];
export type SpeechLang = 'ko' | 'en';

/** 한 번에 읽을 글자 수 상한 (데모라 짧게) */
export const MAX_SPEECH_CHARS = 80;

export interface SpeechRequest {
	text: string;
	lang: SpeechLang;
	/** 막아 둔 공급자: 대체 순서를 보여 주려고 화면에서 고른다 */
	skip: SpeechProvider[];
}

/** 몸통을 검사해 요청으로 바꾼다. 맞지 않으면 사람이 읽을 이유를 던진다 */
export function parseSpeechRequest(body: unknown): SpeechRequest {
	const input = (body ?? {}) as Record<string, unknown>;
	const text = typeof input.text === 'string' ? input.text.replace(/\s+/g, ' ').trim() : '';
	if (!text) throw new SpeechInputError('읽을 글을 써 주세요.');
	if ([...text].length > MAX_SPEECH_CHARS) throw new SpeechInputError(`${MAX_SPEECH_CHARS}자까지만 읽습니다.`);
	// 제어 문자는 지운다 (줄바꿈은 위에서 띄어쓰기로 바꿨다)
	if (/\p{Cc}/u.test(text)) throw new SpeechInputError('읽을 수 없는 글자가 있습니다.');
	if (BLOCKED.some((pattern) => pattern.test(text))) throw new SpeechInputError('이 글은 읽어 드릴 수 없습니다.');
	const lang: SpeechLang = input.lang === 'en' ? 'en' : 'ko';
	const skip = Array.isArray(input.skip)
		? SPEECH_PROVIDERS.filter((provider) => (input.skip as unknown[]).includes(provider))
		: [];
	return { text, lang, skip };
}

export class SpeechInputError extends Error {}

/**
 * 시도할 차례: 막아 둔 공급자는 건너뛰고, 영어는 한국어 목소리만 고른 Fish를 건너뛰지 않는다
 * (Fish에도 영어 목소리가 있다). 막은 것도 결과에 남겨 화면이 차례를 그대로 그린다
 */
export function speechOrder(skip: SpeechProvider[]) {
	return SPEECH_PROVIDERS.map((provider) => ({ provider, skipped: skip.includes(provider) }));
}
