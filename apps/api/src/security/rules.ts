// 보안 설정의 입력 규칙 (순수 함수, rules.test.ts)

import { HUMAN_CHECKS, type HumanCheck, parse, SecurityUpdate } from '@macfolio/contracts';

/** 사람 확인을 켜고 끄는 곳 */
export { HUMAN_CHECKS, type HumanCheck };

export type SecuritySettings = Record<HumanCheck, boolean>;

/** 줄이 없을 때: 메일만 확인한다 (메일은 밖으로 나가는 것이라 처음부터 켠다) */
export const DEFAULT_SETTINGS: SecuritySettings = { contact: true, comment: false, message: false };

/** 바꿀 값: 켜고 끌 곳만 true/false로. 다른 키가 있거나 바꿀 것이 없으면 거절한다 (스키마는 @macfolio/contracts) */
export function parseSecurityUpdate(input: unknown): { value: Partial<SecuritySettings> } | { errors: string[] } {
	return parse(SecurityUpdate, input);
}
