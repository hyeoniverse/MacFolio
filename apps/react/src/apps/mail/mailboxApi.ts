// 메일 앱의 사서함 (#25): 이 브라우저의 보낸 편지함, 관리자의 받은 편지함과 답장. 서버(apps/api/src/contact)가 쿠키로 거른다.
import { env } from '@/shared/config/env';

/** 서버에 저장된 연락 메일과 관리자 답장 */
export interface ContactMail {
	id: string;
	name: string;
	email: string;
	subject: string;
	body: string;
	createdAt: string;
	replies: { id: string; body: string; createdAt: string }[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`${env.apiUrl}${path}`, {
		credentials: 'include',
		signal: AbortSignal.timeout(15_000),
		...init,
	});
	if (!response.ok) {
		const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };
		const message = Array.isArray(body.message) ? body.message.join(' ') : body.message;
		throw new Error(message || '서버에 연결하지 못했습니다.');
	}
	return (await response.json()) as T;
}

/** 이 브라우저가 보낸 메일 (서버가 없으면 빈 목록) */
export const fetchSentMail = () => (env.apiUrl ? request<ContactMail[]>('/contact/mine') : Promise.resolve([]));

/** 관리자의 받은 편지함: 받은 모든 메일 */
export const fetchReceivedMail = () => request<ContactMail[]>('/contact/inbox');

/** 관리자 답장: 방문자의 메일 주소로 보내고, 답장이 붙은 메일을 돌려준다 */
export const replyToMail = (id: string, body: string) =>
	request<ContactMail>(`/contact/${encodeURIComponent(id)}/reply`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ body }),
	});
