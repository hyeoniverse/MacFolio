// 연락 메일 규칙 (#25). 사이트의 메일 앱(apps/react/src/apps/mail/contact.ts)과 같은 규칙으로 다시 검사한다.
// 순수 함수만 둔다: 받을 값 검사, 보낼 메일 만들기.

export const LIMITS = { name: 30, subject: 100, body: 2000 } as const;

export interface ContactInput {
	name: string;
	/** 답장받을 이메일 (메일의 Reply-To) */
	email: string;
	subject: string;
	body: string;
}

/** 흔한 오타를 거르는 정도의 이메일 형식 검사 (사이트와 같다) */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** 줄바꿈 말고 제어 문자는 받지 않는다 */
const CONTROL = /[^\P{Cc}\n\t]/u;

/** 몸통을 다듬고 검사한다. 사이트의 검사를 거치지 않고 바로 부를 수도 있으니 서버가 다시 본다 */
export function parseContact(input: unknown): { value: ContactInput; token?: string } | { errors: string[] } {
	const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
	const text = (key: string) =>
		(typeof raw[key] === 'string' ? (raw[key] as string) : '').replace(/\r\n?/g, '\n').trim();
	const value = { name: text('name'), email: text('email'), subject: text('subject'), body: text('body') };
	const errors: string[] = [];

	if (!value.name) errors.push('이름을 입력해주세요.');
	else if (value.name.length > LIMITS.name) errors.push(`이름은 ${LIMITS.name}자까지입니다.`);
	if (!EMAIL.test(value.email) || value.email.length > 254) errors.push('이메일 형식을 확인해주세요.');
	if (!value.subject) errors.push('제목을 입력해주세요.');
	else if (value.subject.length > LIMITS.subject) errors.push(`제목은 ${LIMITS.subject}자까지입니다.`);
	if (!value.body) errors.push('내용을 입력해주세요.');
	else if (value.body.length > LIMITS.body) errors.push(`내용은 ${LIMITS.body}자까지입니다.`);
	// 이름·제목은 한 줄 (메일 머리에 들어간다)
	if (/\n/.test(value.name) || /\n/.test(value.subject)) errors.push('이름과 제목은 한 줄로 써 주세요.');
	if (Object.values(value).some((field) => CONTROL.test(field))) errors.push('읽을 수 없는 글자가 있습니다.');

	const token =
		typeof raw.turnstileToken === 'string' && raw.turnstileToken.length <= 2048 ? raw.turnstileToken : undefined;
	return errors.length ? { errors } : { value, token };
}

/** 보낼 메일: 제목 앞에 [MacFolio], 본문 끝에 보낸 사람 (답장은 Reply-To로 바로 간다) */
export function buildEmail(input: ContactInput): { subject: string; text: string } {
	return {
		subject: `[MacFolio] ${input.subject}`,
		text: `${input.body}\n\n---\n보낸 사람: ${input.name} <${input.email}>\n(MacFolio 메일 앱에서 보냄. 답장하면 보낸 사람에게 갑니다)`,
	};
}

/** 관리자 답장의 길이 */
export const REPLY_LIMIT = 5000;

/** 관리자 답장 검사: 비어 있지 않고, 제어 문자 없이 */
export function parseReply(input: unknown): { body: string } | { errors: string[] } {
	const raw = input && typeof input === 'object' ? (input as Record<string, unknown>).body : undefined;
	const body = (typeof raw === 'string' ? raw : '').replace(/\r\n?/g, '\n').trim();
	if (!body) return { errors: ['답장 내용을 입력해주세요.'] };
	if (body.length > REPLY_LIMIT) return { errors: [`답장은 ${REPLY_LIMIT}자까지입니다.`] };
	if (CONTROL.test(body)) return { errors: ['읽을 수 없는 글자가 있습니다.'] };
	return { body };
}

/** 관리자 답장 메일: 원래 제목에 Re:, 본문 아래에 받은 메일을 인용한다 */
export function buildReply(mail: ContactInput & { createdAt: Date }, body: string): { subject: string; text: string } {
	const quoted = mail.body
		.split('\n')
		.map((line) => `> ${line}`)
		.join('\n');
	const date = mail.createdAt.toISOString().slice(0, 10);
	return {
		subject: `Re: [MacFolio] ${mail.subject}`,
		text: `${body}\n\n---\n${date}, ${mail.name} <${mail.email}> 님이 쓴 메일:\n${quoted}`,
	};
}
