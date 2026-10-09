import { useSyncExternalStore } from 'react';
import { createStore } from '@macfolio/desktop-core';
import { env } from '@/shared/config/env';
import { notify } from '@/desktop/notifications/notificationStore';
import { saveAppsBeforeLeaving } from '@/desktop/appsBeforeLeaving';
import { checkAdmin, readLoginResult, type AdminState, type LoginResult } from '@/shared/auth/admin';

/**
 * 관리자 로그인 상태. 세션은 API가 httpOnly 쿠키로 들고 있어서 브라우저 코드는 토큰을 보지 못한다.
 * 로그인했는지는 /auth/me로 묻는다. 권한은 서버가 요청마다 다시 확인하므로, 이 상태는 화면을 바꾸는 데만 쓴다.
 */
export const adminStore = createStore<AdminState>({ status: env.apiUrl ? 'checking' : 'disabled', login: null });

let expiryTimer: ReturnType<typeof setTimeout> | undefined;

export async function refreshAdmin() {
	const state = await checkAdmin(env.apiUrl);
	adminStore.setState(state);
	// 세션이 끝나면 다시 물어서 로그아웃된 화면으로 바꾼다 (켜 둔 채로 만료 시각이 지나도 로그인한 것처럼 보이지 않게)
	clearTimeout(expiryTimer);
	const left = state.expiresAt ? state.expiresAt.getTime() - Date.now() : null;
	// setTimeout은 약 24.8일(2^31 ms)을 넘기면 바로 불린다. 세션은 12시간이라 넘지 않지만 막아 둔다
	if (left !== null && left < 2 ** 31 - 1)
		expiryTimer = setTimeout(() => void refreshAdmin(), Math.max(0, left) + 1000);
}

/**
 * 로그인하러 다녀오는 흐름 (LoginFlow가 그린다).
 * - redirecting: GitHub로 가는 중 (페이지가 갑자기 바뀌지 않게 잠깐 안내를 보여 준다)
 * - result: GitHub에서 돌아온 결과. 확인을 누를 때까지 결과 창을 보여 준다
 */
export const loginFlowStore = createStore<{ redirecting: boolean; result: LoginResult | null }>({
	redirecting: false,
	result: null,
});

/** 안내를 보여 준 뒤 GitHub로 떠나기까지 */
const REDIRECT_DELAY_MS = 600;

/** GitHub 로그인으로 간다 (API가 GitHub에 보냈다가 이 사이트로 돌려보낸다) */
export function signIn() {
	if (!env.apiUrl) return;
	loginFlowStore.setState({ redirecting: true });
	setTimeout(() => {
		// 돌아왔을 때 켜 두었던 앱이 그대로 있게
		saveAppsBeforeLeaving();
		window.location.assign(`${env.apiUrl}/auth/github`);
	}, REDIRECT_DELAY_MS);
}

/** GitHub에서 막 돌아왔는지 (그러면 로딩 화면을 건너뛴다) */
export const returnedFromLogin = () => loginFlowStore.getState().result !== null;

export const dismissLoginResult = () => loginFlowStore.setState({ result: null });

export function useLoginFlow() {
	return useSyncExternalStore(loginFlowStore.subscribe, loginFlowStore.getState);
}

export async function signOut() {
	try {
		await fetch(`${env.apiUrl}/auth/logout`, { method: 'POST', credentials: 'include' });
	} finally {
		clearTimeout(expiryTimer);
		adminStore.setState({ status: 'signed-out', login: null });
		notify({ app: 'passwords', title: '로그아웃함', body: '관리자 로그인을 마쳤습니다.' });
	}
}

/**
 * 앱 시작 시 한 번 (화면을 그리기 전에): GitHub에서 돌아왔으면 결과를 기억하고 주소에서 지운 뒤, 로그인했는지 확인한다.
 * 결과를 읽는 부분은 첫 await 전이라 화면을 그리기 전에 끝난다.
 */
export async function initAdmin() {
	const { result, cleanHref } = readLoginResult(window.location.href);
	if (result) {
		window.history.replaceState(window.history.state, '', cleanHref);
		loginFlowStore.setState({ result });
	}
	await refreshAdmin();
}

export function useAdmin(): AdminState {
	return useSyncExternalStore(adminStore.subscribe, adminStore.getState);
}
