// 메일 앱의 연락 메일 (apps/api의 /contact). 방문자가 사이트 주인에게 보내고, 관리자가 앱에서 답장한다.
// 입력 규칙과 문구는 여기 한 벌뿐이다: 화면은 칸마다 보여 주고, 서버는 같은 규칙으로 다시 검사해 400의 이유로 보낸다
import { z } from 'zod';
import { requestBody } from './parse.js';

export const CONTACT_LIMITS = { name: 30, subject: 100, body: 2000 } as const;
/** 관리자 답장의 길이 */
export const REPLY_LIMIT = 5000;

/** 흔한 오타를 거르는 정도의 이메일 형식 검사 (정확한 확인은 답장으로 한다) */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** 줄바꿈 말고 제어 문자는 받지 않는다 (메일 머리에 끼워 넣기 막기) */
const CONTROL = /[^\P{Cc}\n\t]/u;
const UNREADABLE = '읽을 수 없는 글자가 있습니다.';

/** 문자열이 아니면 빈 문자열로 보고, 줄바꿈을 \n으로 통일하고, 앞뒤 공백을 다듬는다 */
export const contactText = (value: unknown) => (typeof value === 'string' ? value : '').replace(/\r\n?/g, '\n').trim();

/** 칸 하나의 규칙: 처음 어긋난 것 하나만 알린다 (화면이 칸 아래에 한 줄로 보인다) */
const field = (rules: [test: (value: string) => boolean, message: string][]) =>
	z.preprocess(contactText, z.string()).superRefine((value, ctx) => {
		const failed = rules.find(([test]) => !test(value));
		if (failed) ctx.addIssue({ code: 'custom', message: failed[1] });
	});
const nonEmpty = (value: string) => value.length > 0;
const oneLine = (value: string) => !value.includes('\n');
const readable = (value: string) => !CONTROL.test(value);

/** 연락 메일 요청 몸통. 받는 사람은 늘 사이트 주인이라 없다 */
export const ContactInput = requestBody({
	name: field([
		[nonEmpty, '이름을 입력해주세요.'],
		[(v) => v.length <= CONTACT_LIMITS.name, `이름은 ${CONTACT_LIMITS.name}자까지 입력할 수 있습니다.`],
		[oneLine, '이름과 제목은 한 줄로 써 주세요.'],
		[readable, UNREADABLE],
	]),
	/** 답장받을 이메일 (메일의 Reply-To) */
	email: field([
		[nonEmpty, '답장받을 이메일을 입력해주세요.'],
		[(v) => EMAIL.test(v) && v.length <= 254, '이메일 형식을 확인해주세요.'],
	]),
	subject: field([
		[nonEmpty, '제목을 입력해주세요.'],
		[(v) => v.length <= CONTACT_LIMITS.subject, `제목은 ${CONTACT_LIMITS.subject}자까지 입력할 수 있습니다.`],
		[oneLine, '이름과 제목은 한 줄로 써 주세요.'],
		[readable, UNREADABLE],
	]),
	body: field([
		[nonEmpty, '내용을 입력해주세요.'],
		[(v) => v.length <= CONTACT_LIMITS.body, `내용은 ${CONTACT_LIMITS.body}자까지 입력할 수 있습니다.`],
		[readable, UNREADABLE],
	]),
	/** 사람 확인(Turnstile) 토큰. 너무 길면 없는 것으로 본다 */
	turnstileToken: z.preprocess(
		(value) => (typeof value === 'string' && value.length <= 2048 ? value : undefined),
		z.string().optional()
	),
});
export type ContactInput = z.infer<typeof ContactInput>;
/** 화면이 다루는 네 칸 (토큰은 보낼 때 따로 붙인다) */
export type ContactFields = Omit<ContactInput, 'turnstileToken'>;

/** 관리자 답장 요청 몸통 */
export const ReplyInput = requestBody({
	body: field([
		[nonEmpty, '답장 내용을 입력해주세요.'],
		[(v) => v.length <= REPLY_LIMIT, `답장은 ${REPLY_LIMIT}자까지입니다.`],
		[readable, UNREADABLE],
	]),
});
export type ReplyInput = z.infer<typeof ReplyInput>;

/** 서버에 남은 연락 메일과 관리자 답장. 방문자 해시는 담지 않는다 */
export const ContactMail = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string(),
	subject: z.string(),
	body: z.string(),
	/** ISO 8601 */
	createdAt: z.string(),
	replies: z.array(z.object({ id: z.string(), body: z.string(), createdAt: z.string() })),
});
export type ContactMail = z.infer<typeof ContactMail>;

/** POST /contact의 응답 */
export const ContactSent = z.object({ status: z.literal('sent'), mail: ContactMail });
export type ContactSent = z.infer<typeof ContactSent>;

/** GET /contact: 서버가 보낼 수 있는지, 사람 확인(Turnstile) 위젯의 공개 키 (없으면 null) */
export const ContactStatus = z.object({ enabled: z.boolean(), turnstileSiteKey: z.string().nullable() });
export type ContactStatus = z.infer<typeof ContactStatus>;
