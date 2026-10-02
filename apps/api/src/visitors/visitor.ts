// 방문자 구분. 순수 함수만 둔다.
// 처음 온 브라우저에 무작위 토큰을 쿠키(httpOnly, 1년)로 주고, 그 토큰으로 이름(예: 🦊 날쌘 여우)을 정한다.
// 같은 브라우저면 언제 와도 같은 이름이고, 이름·비밀번호를 따로 받지 않는다.
// IP는 사람을 가리는 데 쓰지 않는다 (휴대폰은 자주 바뀌고, 카페·회사는 여러 사람이 같은 IP를 쓴다). 도배 막기에만 쓴다.
import { createHash, createHmac } from 'node:crypto';

export const VISITOR_COOKIE = 'macfolio_visitor';
/** 쿠키 유지 시간. 올 때마다 다시 늘린다 */
export const VISITOR_TTL_MS = 365 * 24 * 60 * 60 * 1000;
/** randomToken(24)의 모양. 다른 값이면 새로 준다 */
export const VISITOR_TOKEN = /^[\w-]{32}$/;

/** DB에는 토큰 대신 이 값을 둔다. 키를 모르면 토큰을 되돌릴 수도, 흉내 낼 수도 없다 */
export const hashVisitor = (token: string, secret: string) =>
	createHmac('sha256', secret).update(`visitor:${token}`).digest('hex');

/** 화면에 내보내는 글쓴이 구분값 (같은 사람의 말풍선을 묶는 데만). 저장한 해시를 그대로 내보내지 않는다 */
export const publicAuthorId = (visitorHash: string) =>
	createHash('sha256').update(visitorHash).digest('hex').slice(0, 16);

// 이름 재료. 프론트엔드(apps/react/src/apps/messages/conversations.ts)에 같은 목록이 있다 (서버 없이 쓸 때)
export const ADJECTIVES = [
	'날쌘',
	'느긋한',
	'반짝이는',
	'수줍은',
	'용감한',
	'졸린',
	'다정한',
	'엉뚱한',
	'씩씩한',
	'조용한',
	'명랑한',
	'차분한',
	'호기심 많은',
	'꼼꼼한',
	'부지런한',
	'상냥한',
	'당당한',
	'산뜻한',
	'포근한',
	'재빠른',
	'느릿한',
	'똑똑한',
	'수다스러운',
	'신난',
	'늠름한',
	'귀여운',
	'든든한',
	'말랑한',
	'새침한',
	'배고픈',
] as const;

export const ANIMALS = [
	['🦊', '여우'],
	['🐻', '곰'],
	['🐰', '토끼'],
	['🐼', '판다'],
	['🐱', '고양이'],
	['🐶', '강아지'],
	['🦉', '부엉이'],
	['🐧', '펭귄'],
	['🐢', '거북이'],
	['🦔', '고슴도치'],
	['🐨', '코알라'],
	['🐳', '고래'],
	['🐬', '돌고래'],
	['🦦', '수달'],
	['🐹', '햄스터'],
	['🐿️', '다람쥐'],
	['🦁', '사자'],
	['🐯', '호랑이'],
	['🐸', '개구리'],
	['🦄', '유니콘'],
	['🐙', '문어'],
	['🦥', '나무늘보'],
	['🐥', '병아리'],
	['🦒', '기린'],
] as const;

/** 16진수 해시에서 이름을 정한다: "🦊 날쌘 여우". 같은 해시면 늘 같은 이름 */
export function visitorName(hexHash: string): string {
	const adjective = ADJECTIVES[parseInt(hexHash.slice(0, 8), 16) % ADJECTIVES.length];
	const [emoji, animal] = ANIMALS[parseInt(hexHash.slice(8, 16), 16) % ANIMALS.length];
	return `${emoji} ${adjective} ${animal}`;
}
