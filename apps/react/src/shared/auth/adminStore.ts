import { useSyncExternalStore } from 'react';
import { createStore } from '@/shared/lib/createStore';
import { env } from '@/shared/config/env';
import { notify } from '@/desktop/notifications/notificationStore';
import { checkAdmin, LOGIN_MESSAGES, readLoginResult, type AdminState } from '@/shared/auth/admin';

/**
 * 관리자 로그인 상태. 세션은 API가 httpOnly 쿠키로 들고 있어서 브라우저 코드는 토큰을 보지 못한다.
 * 로그인했는지는 /auth/me로 묻는다. 권한은 서버가 요청마다 다시 확인하므로, 이 상태는 화면을 바꾸는 데만 쓴다.
 */
export const adminStore = createStore<AdminState>({ status: env.apiUrl ? 'checking' : 'disabled', login: null });

export async function refreshAdmin() {
	adminStore.setState(await checkAdmin(env.apiUrl));
}

/** GitHub 로그인으로 간다 (API가 GitHub에 보냈다가 이 사이트로 돌려보낸다) */
export function signIn() {
	if (env.apiUrl) window.location.assign(`${env.apiUrl}/auth/github`);
}

export async function signOut() {
	try {
		await fetch(`${env.apiUrl}/auth/logout`, { method: 'POST', credentials: 'include' });
	} finally {
		adminStore.setState({ status: 'signed-out', login: null });
		notify({ app: 'passwords', title: '로그아웃함', body: '관리자 로그인을 마쳤습니다.' });
	}
}

/** 앱 시작 시 한 번: GitHub에서 돌아왔으면 결과를 알리고, 로그인했는지 확인한다 */
export async function initAdmin() {
	const { result, cleanHref } = readLoginResult(window.location.href);
	if (result) window.history.replaceState(window.history.state, '', cleanHref);
	await refreshAdmin();
	if (result) notify({ app: 'passwords', ...LOGIN_MESSAGES[result] });
}

export function useAdmin(): AdminState {
	return useSyncExternalStore(adminStore.subscribe, adminStore.getState);
}
