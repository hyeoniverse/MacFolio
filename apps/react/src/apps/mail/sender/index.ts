import { PROFILE } from '@/shared/profile';
import { createMailtoSender } from './mailtoSender';
import type { MailSender } from './types';

export type { MailSender, SendResult } from './types';

let sender: MailSender | null = null;

/** 지금은 방문자의 메일 앱을 연다. 백엔드(#9)가 생기면 여기서 API 구현체를 고른다. */
export function getMailSender(): MailSender {
	sender ??= createMailtoSender(PROFILE.email);
	return sender;
}
