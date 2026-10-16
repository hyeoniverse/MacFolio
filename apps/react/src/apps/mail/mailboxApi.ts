// 메일 앱의 사서함 (#25): 이 브라우저의 보낸 편지함, 관리자의 받은 편지함과 답장. 서버(apps/api/src/contact)가 쿠키로 거른다.
import { env } from '@/shared/config/env';
import { api } from '@/shared/api/client';
import type { ContactMail } from '@macfolio/contracts';

/** 서버에 저장된 연락 메일과 관리자 답장. 모양은 서버와 같은 스키마(contracts) */
export type { ContactMail };

/** 이 브라우저가 보낸 메일 (서버가 없으면 빈 목록) */
export const fetchSentMail = () => (env.apiUrl ? api<ContactMail[]>('/contact/mine') : Promise.resolve([]));

/** 관리자의 받은 편지함: 받은 모든 메일 */
export const fetchReceivedMail = () => api<ContactMail[]>('/contact/inbox');

/** 관리자 답장: 방문자의 메일 주소로 보내고, 답장이 붙은 메일을 돌려준다 */
export const replyToMail = (id: string, body: string) =>
	api<ContactMail>(`/contact/${encodeURIComponent(id)}/reply`, { method: 'POST', json: { body } });
