// 음성 만들기 데모의 규칙: 받을 글, 공급자 차례. 바깥 호출 없이 시험할 수 있게 여기에 모은다.
// 받을 글의 규칙은 화면과 함께 쓰려고 @macfolio/contracts에, 하루 상한은 다른 데모와 함께 common/demo.ts에 둔다
import { parse, SPEECH_PROVIDERS, SpeechInput, type SpeechProvider } from '@macfolio/contracts';
import { demoInput } from '../common/demo.js';

export { DailyQuota } from '../common/demo.js';
export { MAX_SPEECH_CHARS, SPEECH_PROVIDERS, type SpeechProvider } from '@macfolio/contracts';
export type SpeechRequest = SpeechInput;
export type SpeechLang = SpeechInput['lang'];

/** 몸통을 검사해 요청으로 바꾼다. 맞지 않으면 사람이 읽을 이유를 던진다 */
export const parseSpeechRequest = (body: unknown): SpeechRequest => demoInput(parse(SpeechInput, body));

/**
 * 시도할 차례: 막아 둔 공급자는 건너뛰고, 영어는 한국어 목소리만 고른 Fish를 건너뛰지 않는다
 * (Fish에도 영어 목소리가 있다). 막은 것도 결과에 남겨 화면이 차례를 그대로 그린다
 */
export function speechOrder(skip: SpeechProvider[]) {
	return SPEECH_PROVIDERS.map((provider) => ({ provider, skipped: skip.includes(provider) }));
}
