import type { MailSender } from './types';
import { api, apiFetch, reasonsOf, UNREACHABLE } from '@/shared/api/client';

/** 서버의 연락 메일 설정 (GET /contact) */
export interface ContactStatus {
	/** 서버가 보낼 수 있다 */
	enabled: boolean;
	/** 사람 확인(Turnstile) 위젯의 공개 키. 없으면 확인하지 않는다 */
	turnstileSiteKey: string | null;
}

/** 서버의 연락 메일 설정. 서버에 닿지 않으면 꺼진 것으로 본다 */
export async function fetchContactStatus(apiUrl: string, fetchImpl: typeof fetch = fetch): Promise<ContactStatus> {
	try {
		const body = await api<Partial<ContactStatus>>('/contact', { apiUrl, fetchImpl, timeout: 5000 });
		return { enabled: body.enabled === true, turnstileSiteKey: body.turnstileSiteKey || null };
	} catch {
		return { enabled: false, turnstileSiteKey: null };
	}
}

/**
 * 서버(POST /contact)가 보낸다. 서버에 메일 설정이 없으면(503) 방문자의 메일 앱으로 넘긴다(fallback).
 * 그 밖의 실패는 서버가 준 이유를 그대로 보여 준다
 */
export function createApiSender(apiUrl: string, fallback: MailSender, fetchImpl: typeof fetch = fetch): MailSender {
	return {
		async send(input, options) {
			let response: Response;
			try {
				// 방문자 쿠키(credentials)는 클라이언트가 보낸다: 서버가 이 브라우저의 보낸 편지함에 넣는다
				response = await apiFetch('/contact', {
					method: 'POST',
					json: { ...input, turnstileToken: options?.turnstileToken },
					timeout: 20_000,
					apiUrl,
					fetchImpl,
				});
			} catch {
				return { status: 'failed', message: UNREACHABLE };
			}
			if (response.ok) return { status: 'sent' };
			if (response.status === 503) return fallback.send(input, options);
			return { status: 'failed', message: (await reasonsOf(response, '메일을 보내지 못했습니다.')).join(' ') };
		},
	};
}
