// zod 스키마로 입력을 검사하고, 서버와 화면이 이미 쓰는 모양({ value } | { errors: string[] })으로 돌려준다.
// 메시지는 스키마에 한국어로 적어 둔 것(.min(1, '…'))을 그대로 쓴다. 같은 문구는 한 번만 담는다
import { z } from 'zod';

export type Parsed<T> = { value: T } | { errors: string[] };

/** 검사해서 다듬은 값, 아니면 사람이 읽을 이유 목록 */
export function parse<S extends z.ZodType>(schema: S, input: unknown): Parsed<z.output<S>> {
	const result = schema.safeParse(input);
	if (result.success) return { value: result.data };
	return { errors: [...new Set(result.error.issues.map((issue) => issue.message))] };
}

/**
 * 요청 몸통 스키마. 몸통이 객체가 아니면(null, 문자열, 없음) 빈 객체로 보고 각 필드의 문구를 알린다.
 * zod의 기본 문구("Invalid input: expected object")가 사용자에게 보이지 않게
 */
export const requestBody = <T extends z.ZodRawShape>(shape: T) =>
	z.preprocess((input) => (typeof input === 'object' && input !== null ? input : {}), z.object(shape));
