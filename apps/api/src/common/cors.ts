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

/** 로컬 프론트엔드(Vite 개발 서버) 주소 */
export const LOCAL_FRONTEND = 'http://localhost:5173';

/**
 * 개발 모드인데 로컬 프론트엔드를 허용하지 않으면 경고 문장. 로컬 .env에 배포용 CORS_ORIGINS가 들어가면
 * 로컬 사이트가 "서버에 연결할 수 없음"만 보여 주고 이유를 알 수 없어서, API가 뜰 때 알린다.
 */
export function localFrontendWarning(origins: string[], nodeEnv: string | undefined): string | null {
	if (nodeEnv === 'production' || originMatcher(origins)(LOCAL_FRONTEND)) return null;
	return `CORS_ORIGINS가 로컬 프론트엔드(${LOCAL_FRONTEND})를 허용하지 않습니다: ${origins.join(', ')}. 로컬 .env에는 개발용 값을, 배포용 값은 .env.production에 두세요 (.env.example).`;
}
