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

/** 로그인 결과 알림 문구 */
export const LOGIN_MESSAGES: Record<LoginResult, { title: string; body: string }> = {
	'signed-in': { title: '관리자로 로그인함', body: 'GitHub 계정으로 로그인했습니다.' },
	denied: { title: '로그인할 수 없음', body: '관리자 계정(GitHub)만 로그인할 수 있습니다.' },
	cancelled: { title: '로그인 취소됨', body: 'GitHub 로그인을 취소했습니다.' },
};

/** 계정 사진 (GitHub 공개 프로필 사진) */
export const avatarUrl = (login: string) => `https://github.com/${encodeURIComponent(login)}.png?size=120`;

/** /auth/me 응답으로 상태를 정한다 */
export async function checkAdmin(apiUrl: string, fetchImpl: typeof fetch = fetch): Promise<AdminState> {
	if (!apiUrl) return { status: 'disabled', login: null };
	try {
		const response = await fetchImpl(`${apiUrl}/auth/me`, { credentials: 'include' });
		if (response.status === 401) return { status: 'signed-out', login: null };
		if (!response.ok) return { status: 'offline', login: null };
		const { login } = (await response.json()) as { login: string };
		return { status: 'signed-in', login };
	} catch {
		return { status: 'offline', login: null };
	}
}
