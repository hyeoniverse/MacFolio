import { env } from '@/shared/config/env';
import { getProfile } from '@/shared/site/profileStore';
import { createApiSender } from './apiSender';
import { createMailtoSender } from './mailtoSender';
import type { MailSender } from './types';

export type { MailSender, SendOptions, SendResult } from './types';
export { fetchContactStatus, type ContactStatus } from './apiSender';

let sender: MailSender | null = null;

/** 서버가 있으면 서버가 보낸다 (메일 설정이 없으면 메일 앱으로). 서버가 없는 빌드는 방문자의 메일 앱을 연다 */
export function getMailSender(): MailSender {
	// 받는 주소는 보낼 때의 프로필 (관리자가 시스템 설정에서 바꿀 수 있다)
	const mailto: MailSender = { send: (input, options) => createMailtoSender(getProfile().email).send(input, options) };
	sender ??= env.apiUrl ? createApiSender(env.apiUrl, mailto) : mailto;
	return sender;
}
