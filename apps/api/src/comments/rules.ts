// 댓글·메시지 입력 규칙. 메시지 앱(apps/react/src/apps/messages/conversations.ts)과 같은 규칙을 서버에서 검사한다.
// 이름은 받지 않는다: 방문자는 쿠키로 정한 이름(visitors/visitor.ts), 관리자는 김정현으로 쓴다.
import { createHmac } from 'node:crypto';

/** 관리자 이름 */
export const OWNER_NAME = '김정현';

export const LIMITS = {
	body: { min: 1, max: 500 },
} as const;

/** 글 주소 (Markdown 파일 이름) */
export const SLUG = /^[\w-]{1,100}$/;

/** 내용을 다듬고 검사한다 */
export function parseBody(input: unknown): { value: { body: string } } | { errors: string[] } {
	const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
	const body = typeof raw.body === 'string' ? raw.body.trim() : '';
	if (body.length < LIMITS.body.min) return { errors: ['내용을 입력해주세요.'] };
	if (body.length > LIMITS.body.max) return { errors: [`내용은 ${LIMITS.body.max}자까지 입력할 수 있습니다.`] };
	return { value: { body } };
}

/** IPv4는 앞 두 자리("211.234"), IPv6는 앞 두 묶음("2001:db8") */
export function maskIp(ip: string): string {
	const v4 = ip.replace(/^::ffff:/, '');
	if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return v4.split('.').slice(0, 2).join('.');
	return ip.split(':').slice(0, 2).join(':');
}

/** IP 원문 대신 저장하는 값. 키를 모르면 IP를 되돌릴 수 없다 */
export const hashIp = (ip: string, secret: string) => createHmac('sha256', secret).update(ip).digest('hex');
