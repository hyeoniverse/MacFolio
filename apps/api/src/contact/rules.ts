// 연락 메일 규칙 (#25). 입력의 모양·규칙·문구는 @macfolio/contracts의 ContactInput·ReplyInput (사이트의 메일 앱과 같은 스키마).
// 여기는 보낼 메일 만들기만 둔다.

import { ContactInput, type ContactFields, parse, ReplyInput } from '@macfolio/contracts';

/** 몸통을 다듬고 검사한다. 사이트의 검사를 거치지 않고 바로 부를 수도 있으니 서버가 같은 스키마로 다시 본다 (규칙·문구는 contracts에) */
export const parseContact = (input: unknown) => parse(ContactInput, input);

/** 관리자 답장 검사: 비어 있지 않고, 제어 문자 없이 */
export const parseReply = (input: unknown) => parse(ReplyInput, input);

/** 보낼 메일: 제목 앞에 [MacFolio], 본문 끝에 보낸 사람 (답장은 Reply-To로 바로 간다) */
export function buildEmail(input: ContactFields): { subject: string; text: string } {
	return {
		subject: `[MacFolio] ${input.subject}`,
		text: `${input.body}\n\n---\n보낸 사람: ${input.name} <${input.email}>\n(MacFolio 메일 앱에서 보냄. 답장하면 보낸 사람에게 갑니다)`,
	};
}

/** 관리자 답장 메일: 원래 제목에 Re:, 본문 아래에 받은 메일을 인용한다 */
export function buildReply(mail: ContactFields & { createdAt: Date }, body: string): { subject: string; text: string } {
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
