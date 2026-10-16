// 번역 데모의 규칙: 받을 글과 언어, 공급자 차례. 바깥 호출 없이 시험할 수 있게 여기에 모은다.
import { parse, TranslateInput } from '@macfolio/contracts';
import { demoInput } from '../common/demo.js';

export {
	MAX_TRANSLATE_CHARS,
	MAX_TRANSLATE_FIELDS,
	TRANSLATE_PROVIDERS,
	type TranslateProvider,
} from '@macfolio/contracts';
export type TranslateRequest = TranslateInput;
export type TranslateLang = TranslateInput['from'];

/** 몸통을 검사해 요청으로 바꾼다. 칸 하나는 text로, 여러 칸은 texts로. 맞지 않으면 사람이 읽을 이유를 던진다 */
export const parseTranslateRequest = (body: unknown): TranslateRequest => demoInput(parse(TranslateInput, body));
