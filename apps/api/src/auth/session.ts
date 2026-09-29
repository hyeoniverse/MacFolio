// 세션 토큰과 OAuth state. 순수 함수만 둔다.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'macfolio_session';
export const STATE_COOKIE = 'macfolio_oauth_state';

/** 세션 유지 시간 (짧게: 관리 작업을 할 때만 로그인한다) */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
/** GitHub에 다녀오는 동안만 state를 기억한다 */
export const STATE_TTL_MS = 10 * 60 * 1000;

/** 추측할 수 없는 무작위 값 (세션 토큰, OAuth state) */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

/** DB에는 토큰 대신 이 값을 둔다 */
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** 두 문자열이 같은지, 걸린 시간으로 내용을 알 수 없게 비교한다 */
export function safeEqual(a: string | undefined, b: string | undefined): boolean {
	if (!a || !b) return false;
	const left = Buffer.from(a);
	const right = Buffer.from(b);
	return left.length === right.length && timingSafeEqual(left, right);
}

/** GitHub 계정 이름은 대소문자를 가리지 않는다 */
export const sameGithubLogin = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
