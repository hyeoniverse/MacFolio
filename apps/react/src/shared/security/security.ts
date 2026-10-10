// 보안 설정 (apps/api의 /security): 메일·댓글·메시지를 쓸 때 사람 확인(Cloudflare Turnstile)을 할지.
// 누구나 읽고(화면이 위젯을 그릴지 정한다), 관리자만 바꾼다 (시스템 설정의 '개인정보 보호 및 보안')
import { useEffect, useState, useSyncExternalStore } from 'react';
import { createStore } from '@macfolio/desktop-core';
import { env } from '@/shared/config/env';
import { useAdmin } from '@/shared/auth/adminStore';

export const HUMAN_CHECKS = ['contact', 'comment', 'message'] as const;
export type HumanCheck = (typeof HUMAN_CHECKS)[number];

export interface SecuritySettings extends Record<HumanCheck, boolean> {
	/** 서버에 Turnstile 키가 둘 다 있는지. 없으면 켜도 확인하지 않는다 */
	available: boolean;
	turnstileSiteKey: string | null;
	updatedAt: string | null;
}

/** 읽은 설정 (서버가 없거나 아직 읽지 않았으면 null) */
const store = createStore<{ settings: SecuritySettings | null; failed: boolean }>({ settings: null, failed: false });
let loading: Promise<void> | null = null;

/** 한 번만 읽는다 (앱 여러 곳이 함께 쓴다). force면 다시 읽는다 */
export function loadSecurity(force = false): Promise<void> {
	if (!env.apiUrl) return Promise.resolve();
	if (loading && !force) return loading;
	loading = fetch(`${env.apiUrl}/security`, { credentials: 'include' })
		.then(async (response) => {
			if (!response.ok) throw new Error(String(response.status));
			store.setState({ settings: (await response.json()) as SecuritySettings, failed: false });
		})
		.catch(() => {
			loading = null;
			store.setState({ failed: true });
		});
	return loading;
}

/** 관리자가 켜고 끈다. 실패하면 이유 */
export async function saveSecurity(patch: Partial<Record<HumanCheck, boolean>>): Promise<string | null> {
	try {
		const response = await fetch(`${env.apiUrl}/security`, {
			method: 'PUT',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(patch),
		});
		if (!response.ok) {
			const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };
			if (response.status === 401) return '관리자 로그인이 필요합니다.';
			return [body.message].flat().filter(Boolean).join(' ') || '저장하지 못했습니다.';
		}
		store.setState({ settings: (await response.json()) as SecuritySettings, failed: false });
		return null;
	} catch {
		return '서버에 연결할 수 없습니다.';
	}
}

/** 보안 설정. 처음 쓰는 곳에서 읽는다 */
export function useSecurity() {
	const state = useSyncExternalStore(store.subscribe, store.getState);
	useEffect(() => {
		void loadSecurity();
	}, []);
	return state;
}

/**
 * 쓰기 화면의 사람 확인: 이곳에 켜져 있고 서버에 키가 있으면 위젯에 쓸 사이트 키, 아니면 null.
 * 관리자는 확인하지 않는다 (서버도 건너뛴다). 토큰은 한 번만 쓸 수 있어서 보내기에 실패하면 reset()으로 새로 받는다
 */
export function useHumanCheck(check: HumanCheck) {
	const { settings } = useSecurity();
	const admin = useAdmin().status === 'signed-in';
	const [token, setToken] = useState<string | null>(null);
	const [resetKey, setResetKey] = useState(0);
	const siteKey = !admin && settings?.[check] && settings.available ? settings.turnstileSiteKey : null;
	return {
		siteKey,
		token,
		setToken,
		resetKey,
		/** 보내기에 실패했을 때: 새 토큰을 받는다 */
		reset: () => setResetKey((count) => count + 1),
		/** 보낼 수 있는지: 확인이 필요 없거나 토큰이 있다 */
		ready: !siteKey || token !== null,
	};
}
