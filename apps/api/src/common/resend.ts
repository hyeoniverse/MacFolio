// Resend(HTTPS API)로 메일을 보낸다: 서버의 메일 포트가 막혀 있어도 된다. 연락 메일과 서버 알림이 함께 쓴다
const RESEND_URL = 'https://api.resend.com/emails';
const TIMEOUT_MS = 10_000;

export interface OutgoingMail {
	to: string;
	subject: string;
	text: string;
	replyTo?: string;
}

/** 보냈으면 true. 키나 보내는 주소가 없거나 실패하면 false */
export async function sendResendMail(
	settings: { resendApiKey?: string; from?: string },
	mail: OutgoingMail,
	fetchImpl: typeof fetch = fetch
): Promise<boolean> {
	if (!settings.resendApiKey || !settings.from) return false;
	try {
		const response = await fetchImpl(RESEND_URL, {
			method: 'POST',
			headers: { Authorization: `Bearer ${settings.resendApiKey}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				from: settings.from,
				to: [mail.to],
				...(mail.replyTo && { reply_to: mail.replyTo }),
				subject: mail.subject,
				text: mail.text,
			}),
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		return response.ok;
	} catch {
		return false;
	}
}
