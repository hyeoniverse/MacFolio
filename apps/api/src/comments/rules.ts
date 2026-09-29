// 댓글 입력 규칙. 메시지 앱(apps/react/src/apps/messages/conversations.ts)과 같은 규칙을 서버에서 검사한다.
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

/** 관리자 이름. 방문자는 이 이름을 쓸 수 없다 */
export const OWNER_NAME = '김정현';

export const LIMITS = {
	name: { min: 1, max: 20 },
	body: { min: 1, max: 500 },
	password: { min: 4, max: 20 },
} as const;

/** 글 주소 (Markdown 파일 이름) */
export const SLUG = /^[\w-]{1,100}$/;

export interface CommentInput {
	name: string;
	password: string;
	body: string;
}

/** 방문자 댓글을 다듬고 검사한다. 문제가 있으면 이유를 모두 모은다 */
export function parseVisitorComment(input: unknown): { value: CommentInput } | { errors: string[] } {
	const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
	const name = typeof raw.name === 'string' ? raw.name.trim() : '';
	const password = typeof raw.password === 'string' ? raw.password : '';
	const body = typeof raw.body === 'string' ? raw.body.trim() : '';
	const errors: string[] = [];

	if (name.length < LIMITS.name.min) errors.push('이름을 입력해주세요.');
	else if (name.length > LIMITS.name.max) errors.push(`이름은 ${LIMITS.name.max}자까지 입력할 수 있습니다.`);
	else if (name === OWNER_NAME) errors.push('다른 이름을 입력해주세요.');

	if (password.length < LIMITS.password.min || password.length > LIMITS.password.max)
		errors.push(`비밀번호는 ${LIMITS.password.min}~${LIMITS.password.max}자로 입력해주세요.`);

	errors.push(...bodyErrors(body));
	return errors.length > 0 ? { errors } : { value: { name, password, body } };
}

/** 관리자 댓글은 내용만 */
export function parseAdminComment(input: unknown): { value: { body: string } } | { errors: string[] } {
	const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
	const body = typeof raw.body === 'string' ? raw.body.trim() : '';
	const errors = bodyErrors(body);
	return errors.length > 0 ? { errors } : { value: { body } };
}

function bodyErrors(body: string): string[] {
	if (body.length < LIMITS.body.min) return ['내용을 입력해주세요.'];
	if (body.length > LIMITS.body.max) return [`내용은 ${LIMITS.body.max}자까지 입력할 수 있습니다.`];
	return [];
}

/** IPv4는 앞 두 자리("211.234"), IPv6는 앞 두 묶음("2001:db8") */
export function maskIp(ip: string): string {
	const v4 = ip.replace(/^::ffff:/, '');
	if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return v4.split('.').slice(0, 2).join('.');
	return ip.split(':').slice(0, 2).join(':');
}

/** IP 원문 대신 저장하는 값. 키를 모르면 IP를 되돌릴 수 없다 */
export const hashIp = (ip: string, secret: string) => createHmac('sha256', secret).update(ip).digest('hex');

/** 비밀번호 해시: scrypt$<salt>$<hash> (salt는 댓글마다 새로) */
export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const hash = await scrypt(password, salt, 32);
	return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
	const [kind, salt, hash] = stored?.split('$') ?? [];
	if (kind !== 'scrypt' || !salt || !hash) return false;
	const expected = Buffer.from(hash, 'base64');
	const actual = await scrypt(password, Buffer.from(salt, 'base64'), expected.length);
	return timingSafeEqual(actual, expected);
}
