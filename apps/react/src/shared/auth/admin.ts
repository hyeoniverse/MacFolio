// 관리자 로그인 상태의 규칙. React와 DOM에 의존하지 않는다.

/**
 * - disabled: API 주소가 없다 (배포된 API가 아직 없다)
 * - checking: 로그인했는지 확인하는 중
 * - offline: API에 연결할 수 없다
 * - signed-out / signed-in
 */
export type AdminStatus = 'disabled' | 'checking' | 'offline' | 'signed-out' | 'signed-in';

export interface AdminState {
	status: AdminStatus;
	/** 로그인한 GitHub 계정 */
	login: string | null;
	/** 이 세션으로 로그인한 때. 알려 주지 않는 예전 서버면 없다 */
	signedInAt?: Date;
	/** 이 세션이 끝나는 때. 알려 주지 않는 예전 서버면 없다 */
	expiresAt?: Date;
}

/** GitHub에서 돌아올 때 주소에 붙는 결과 (?admin=…) */
export type LoginResult = 'signed-in' | 'denied' | 'cancelled';

const RESULTS: LoginResult[] = ['signed-in', 'denied', 'cancelled'];

/** 주소에서 로그인 결과를 읽고, 결과를 뺀 주소를 돌려준다 (새로 고쳐도 알림이 다시 뜨지 않게) */
export function readLoginResult(href: string): { result: LoginResult | null; cleanHref: string } {
	const url = new URL(href);
	const value = url.searchParams.get('admin');
	if (value === null) return { result: null, cleanHref: href };
	url.searchParams.delete('admin');
	return { result: RESULTS.includes(value as LoginResult) ? (value as LoginResult) : null, cleanHref: url.toString() };
}

/**
 * GitHub에서 돌아온 뒤 보여 줄 결과. 주소의 결과(result)보다 서버에 물어본 실제 상태를 믿는다
 * (signed-in으로 돌아왔어도 쿠키가 막혔으면 로그인되지 않은 것이다).
 */
export function loginOutcome(
	result: LoginResult,
	state: AdminState
): { tone: 'success' | 'fail'; title: string; body: string } {
	if (state.status === 'signed-in' && state.login)
		return {
			tone: 'success',
			title: '로그인했습니다',
			body: `${state.login}(으)로 로그인했습니다. 관리자 기능을 쓸 수 있습니다.`,
		};
	if (result === 'denied')
		return { tone: 'fail', title: '로그인할 수 없습니다', body: '관리자 GitHub 계정만 로그인할 수 있습니다.' };
	if (result === 'cancelled')
		return { tone: 'fail', title: '로그인을 취소했습니다', body: 'GitHub 로그인을 마치지 않았습니다.' };
	return {
		tone: 'fail',
		title: '로그인을 확인하지 못했습니다',
		body: '관리자 서버에 연결할 수 없거나 브라우저가 로그인 쿠키를 막았습니다. 잠시 뒤 다시 시도해 주세요.',
	};
}

/** 계정 사진 (GitHub 공개 프로필 사진) */
export const avatarUrl = (login: string) => `https://github.com/${encodeURIComponent(login)}.png?size=120`;

/**
 * 로그인·세션 만료 시각 (예: 2026년 10월 2일 오후 7:03), 보는 사람의 시간대로.
 * Intl의 한국어 출력('오후'와 'PM')은 ICU 버전마다 달라서 직접 조립한다 (메시지 앱과 같다).
 */
export function formatSessionTime(date: Date): string {
	const hour = date.getHours();
	const minute = String(date.getMinutes()).padStart(2, '0');
	return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${hour < 12 ? '오전' : '오후'} ${hour % 12 || 12}:${minute}`;
}

/** ISO 8601 문자열 → Date. 없거나 잘못된 값이면 null */
function toDate(value: string | undefined): Date | null {
	const date = value ? new Date(value) : null;
	return date && !Number.isNaN(date.getTime()) ? date : null;
}

/** /auth/me 응답으로 상태를 정한다 */
export async function checkAdmin(apiUrl: string, fetchImpl: typeof fetch = fetch): Promise<AdminState> {
	if (!apiUrl) return { status: 'disabled', login: null };
	try {
		const response = await fetchImpl(`${apiUrl}/auth/me`, { credentials: 'include' });
		if (response.status === 401) return { status: 'signed-out', login: null };
		if (!response.ok) return { status: 'offline', login: null };
		const body = (await response.json()) as { login: string; signedInAt?: string; expiresAt?: string };
		const state: AdminState = { status: 'signed-in', login: body.login };
		const signedInAt = toDate(body.signedInAt);
		const expiresAt = toDate(body.expiresAt);
		if (signedInAt) state.signedInAt = signedInAt;
		if (expiresAt) state.expiresAt = expiresAt;
		return state;
	} catch {
		return { status: 'offline', login: null };
	}
}
