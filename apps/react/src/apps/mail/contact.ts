// 메일 규칙. React와 DOM에 의존하지 않는 순수 함수만 둔다.
// 방문자가 사이트 주인에게 연락(contact) 메일을 보내는 앱이다. 받는 사람은 항상 주인 한 명이다.
import type { SiteProfile } from '@/shared/site/profileStore';
import { CONTACT_LIMITS, ContactInput as ContactSchema, contactText, type ContactFields } from '@macfolio/contracts';

export interface InboxMail {
	id: string;
	fromName: string;
	fromEmail: string;
	subject: string;
	/** ISO 8601 */
	date: string;
	body: string;
}

/** 서버에 저장된 메일의 받는 사람 자리: 사이트 주인 (보일 때 지금 프로필의 이름·주소로 바꾼다) */
export const TO_OWNER = '\u0000owner';

/** 받은 편지함: 사이트 주인의 환영 메일 */
export const inboxOf = (profile: SiteProfile): InboxMail[] => [
	{
		id: 'welcome',
		fromName: profile.name,
		fromEmail: profile.email,
		subject: '방문해 주셔서 감사합니다!',
		date: '2026-09-28T00:00:00.000Z',
		body: '제 사이트에 방문해 주셔서 감사합니다.\n저는 지금 일자리를 찾고 있어요! 편하게 연락 주세요.\n\n왼쪽 위 쓰기 버튼으로 바로 메일을 보낼 수 있어요.',
	},
];

/** 보낼 네 칸. 규칙·문구는 서버와 같은 스키마(@macfolio/contracts) */
export type ContactInput = ContactFields;
export const LIMITS = CONTACT_LIMITS;

export type ContactErrors = Partial<Record<keyof ContactInput, string>>;

/** 입력을 다듬고 검증한다. 칸마다 처음 어긋난 문구 하나 (서버도 같은 스키마로 다시 본다) */
export function validateContact(input: ContactInput): { value: ContactInput; errors: ContactErrors } {
	const value = {
		name: contactText(input.name),
		email: contactText(input.email),
		subject: contactText(input.subject),
		body: contactText(input.body),
	};
	const errors: ContactErrors = {};
	const result = ContactSchema.safeParse(value);
	if (!result.success)
		for (const issue of result.error.issues) {
			const key = issue.path[0] as keyof ContactInput;
			errors[key] ??= issue.message;
		}
	return { value, errors };
}

/**
 * 메일 앱을 여는 mailto 주소. 본문 끝에 보낸 사람 정보를 붙인다
 * (mailto는 보내는 사람을 정할 수 없어서, 답장받을 주소를 본문에 남긴다).
 * 줄바꿈은 RFC 6068에 따라 %0D%0A로 인코딩한다.
 */
export function buildMailto(to: string, input: ContactInput): string {
	const body = `${input.body}\n\n---\n보낸 사람: ${input.name} <${input.email}>\n(MacFolio 메일 앱에서 보냄)`;
	const encode = (text: string) => encodeURIComponent(text).replace(/%0A/g, '%0D%0A');
	return `mailto:${to}?subject=${encode(input.subject)}&body=${encode(body)}`;
}

/** 목록의 날짜: "2026. 9. 28." */
export function formatMailDate(iso: string): string {
	const date = new Date(iso);
	return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`;
}
