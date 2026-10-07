// 메일 발송 인터페이스. 서버(#25)가 보낼 수 있으면 서버가 보내고, 아니면 방문자의 메일 앱을 연다(mailto).
import type { ContactInput } from '../contact';

export type SendResult =
	/** 서버가 실제로 보냈다 */
	| { status: 'sent' }
	/** 방문자의 메일 앱에 넘겼다. 보내기는 방문자가 메일 앱에서 누른다 */
	| { status: 'handed-off' }
	| { status: 'failed'; message: string };

export interface SendOptions {
	/** Cloudflare Turnstile이 준 토큰 (서버가 사람 확인을 켰을 때) */
	turnstileToken?: string;
}

export interface MailSender {
	/** 입력은 이미 검증된 값이다 (mail.validateContact) */
	send(input: ContactInput, options?: SendOptions): Promise<SendResult>;
}
