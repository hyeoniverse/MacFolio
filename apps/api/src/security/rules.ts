// 보안 설정의 입력 규칙 (순수 함수, rules.test.ts)

/** 사람 확인을 켜고 끄는 곳 */
export const HUMAN_CHECKS = ['contact', 'comment', 'message'] as const;
export type HumanCheck = (typeof HUMAN_CHECKS)[number];

export type SecuritySettings = Record<HumanCheck, boolean>;

/** 줄이 없을 때: 메일만 확인한다 (메일은 밖으로 나가는 것이라 처음부터 켠다) */
export const DEFAULT_SETTINGS: SecuritySettings = { contact: true, comment: false, message: false };

/** 바꿀 값: 켜고 끌 곳만 true/false로. 다른 키나 다른 값이 있거나, 바꿀 것이 없으면 거절한다 */
export function parseSecurityUpdate(input: unknown): { value: Partial<SecuritySettings> } | { errors: string[] } {
	if (typeof input !== 'object' || input === null || Array.isArray(input)) return { errors: ['설정을 보내 주세요.'] };
	const errors: string[] = [];
	const value: Partial<SecuritySettings> = {};
	for (const [key, field] of Object.entries(input)) {
		if (!(HUMAN_CHECKS as readonly string[]).includes(key)) errors.push(`알 수 없는 설정입니다: ${key}`);
		else if (typeof field !== 'boolean') errors.push(`${key}는 켜기(true)나 끄기(false)여야 합니다.`);
		else value[key as HumanCheck] = field;
	}
	if (!errors.length && Object.keys(value).length === 0) errors.push('바꿀 설정이 없습니다.');
	return errors.length ? { errors } : { value };
}
