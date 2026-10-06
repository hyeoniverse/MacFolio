// CORS로 허용할 프론트엔드 주소. 순수 함수만 둔다.
// CORS_ORIGINS의 항목에 *를 쓰면 그 자리에 영문 소문자·숫자·-만 온다 (점은 안 된다: 다른 도메인으로 넓어지지 않게).
// 예: https://*-macfolio.hyeoniverse.workers.dev → PR 미리보기 주소 (https://feat-x-macfolio.hyeoniverse.workers.dev)

const escape = (text: string) => text.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

/** 허용 목록을 검사 함수로 바꾼다 */
export function originMatcher(allowed: string[]): (origin: string | undefined) => boolean {
	const exact = new Set(allowed.filter((entry) => !entry.includes('*')));
	const patterns = allowed
		.filter((entry) => entry.includes('*'))
		.map((entry) => new RegExp(`^${entry.split('*').map(escape).join('[a-z0-9-]+')}$`));
	return (origin) => !!origin && (exact.has(origin) || patterns.some((pattern) => pattern.test(origin)));
}
