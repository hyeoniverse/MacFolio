// Cloudflare Turnstile(사람 확인)의 토큰 확인. 메일·댓글·메시지가 함께 쓴다 (security/security.service.ts)

const TURNSTILE_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 10_000;

/** 토큰이 이 사이트에서 사람이 받은 것인지 Cloudflare에 묻는다. 토큰이 없거나 닿지 못하면 false */
export async function verifyTurnstile(secret: string, token: string | undefined, ip: string): Promise<boolean> {
	if (!token) return false;
	try {
		const response = await fetch(TURNSTILE_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ secret, response: token, remoteip: ip || undefined }),
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		const result = (await response.json()) as { success?: boolean };
		return result.success === true;
	} catch {
		return false;
	}
}

/** 몸통의 turnstileToken (문자열, 2048자까지). 없으면 undefined */
export function tokenOf(input: unknown): string | undefined {
	const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
	return typeof raw.turnstileToken === 'string' && raw.turnstileToken.length <= 2048 ? raw.turnstileToken : undefined;
}
