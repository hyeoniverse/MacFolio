// 방명록 규칙. React와 DOM에 의존하지 않는 순수 함수만 둔다.

export interface GuestbookEntry {
	id: string;
	nickname: string;
	message: string;
	/** ISO 8601 */
	createdAt: string;
	/** 사이트 주인이 남긴 글 (오른쪽 파란 말풍선) */
	isOwner?: boolean;
}

export interface GuestbookInput {
	nickname: string;
	message: string;
	password: string;
}

export const LIMITS = {
	nickname: { min: 1, max: 20 },
	message: { min: 1, max: 500 },
	password: { min: 4, max: 20 },
} as const;

export type GuestbookInputErrors = Partial<Record<keyof GuestbookInput, string>>;

/** 입력을 다듬고 검증한다. 서버(#9)도 같은 규칙을 쓴다. */
export function validateInput(input: GuestbookInput): { value: GuestbookInput; errors: GuestbookInputErrors } {
	const value = { nickname: input.nickname.trim(), message: input.message.trim(), password: input.password };
	const errors: GuestbookInputErrors = {};

	if (value.nickname.length < LIMITS.nickname.min) errors.nickname = '닉네임을 입력해주세요.';
	else if (value.nickname.length > LIMITS.nickname.max)
		errors.nickname = `닉네임은 ${LIMITS.nickname.max}자까지 입력할 수 있습니다.`;

	if (value.message.length < LIMITS.message.min) errors.message = '내용을 입력해주세요.';
	else if (value.message.length > LIMITS.message.max)
		errors.message = `내용은 ${LIMITS.message.max}자까지 입력할 수 있습니다.`;

	if (value.password.length < LIMITS.password.min || value.password.length > LIMITS.password.max)
		errors.password = `비밀번호는 ${LIMITS.password.min}~${LIMITS.password.max}자로 입력해주세요.`;

	return { value, errors };
}

/** 오래된 글이 위, 최신 글이 아래 (메시지 앱처럼) */
export function sortEntries(entries: GuestbookEntry[]): GuestbookEntry[] {
	return [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** 같은 날 쓴 글끼리 묶는다. 날짜 구분선에 쓴다. */
export function groupByDay(entries: GuestbookEntry[], timeZone?: string): { day: string; entries: GuestbookEntry[] }[] {
	const format = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', timeZone });
	const groups: { day: string; entries: GuestbookEntry[] }[] = [];
	for (const entry of sortEntries(entries)) {
		const day = format.format(new Date(entry.createdAt));
		const last = groups.at(-1);
		if (last?.day === day) last.entries.push(entry);
		else groups.push({ day, entries: [entry] });
	}
	return groups;
}
