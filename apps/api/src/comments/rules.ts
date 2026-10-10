// 댓글 주변 규칙: 글 주소, IP 가리기. 댓글 몸통의 모양은 @macfolio/contracts의 CommentInput (화면과 같은 스키마)
// 이름은 받지 않는다: 방문자는 쿠키로 정한 이름(visitors/visitor.ts), 관리자는 프로필 이름으로 쓴다.
import { createHmac } from 'node:crypto';
import { CommentInput, parse } from '@macfolio/contracts';

/** 관리자 이름 */
/** 관리자 이름의 기본값. 시스템 설정에서 프로필을 저장하면 그 이름을 쓴다 (site/site.service.ts) */
export const OWNER_NAME = '김정현';

/** 글 주소 (Markdown 파일 이름) */
export const SLUG = /^[\w-]{1,100}$/;

/** 내용을 다듬고 검사한다 (스키마는 contracts에, 문구도 거기에) */
export const parseBody = (input: unknown) => parse(CommentInput, input);

/** IPv4는 앞 두 자리("211.234"), IPv6는 앞 두 묶음("2001:db8") */
export function maskIp(ip: string): string {
	const v4 = ip.replace(/^::ffff:/, '');
	if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return v4.split('.').slice(0, 2).join('.');
	return ip.split(':').slice(0, 2).join(':');
}

/** IP 원문 대신 저장하는 값. 키를 모르면 IP를 되돌릴 수 없다 */
export const hashIp = (ip: string, secret: string) => createHmac('sha256', secret).update(ip).digest('hex');
