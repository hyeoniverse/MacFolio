// 대화 규칙. React와 DOM에 의존하지 않는 순수 함수만 둔다.
// 방문자마다 공개 대화방이 하나 생기고, 사이트 주인(김정현)이 각 방에 답장한다.

export const OWNER_NAME = '김정현';

export interface Thread {
	id: string;
	/** 방문자 닉네임 (고정 대화는 주인 이름) */
	title: string;
	createdAt: string;
	/** 사이드바 맨 위에 고정되는 주인 소개 대화 (읽기 전용) */
	pinned?: boolean;
	lastMessage?: { text: string; createdAt: string };
}

export interface Message {
	id: string;
	threadId: string;
	text: string;
	/** ISO 8601 */
	createdAt: string;
	/** 주인이 쓴 글 (왼쪽 회색 말풍선). 아니면 방문자 글 (오른쪽 파란 말풍선) */
	fromOwner: boolean;
}

export interface NewThreadInput {
	nickname: string;
	password: string;
	text: string;
}

export const LIMITS = {
	nickname: { min: 1, max: 20 },
	text: { min: 1, max: 500 },
	password: { min: 4, max: 20 },
} as const;

export type InputErrors = Partial<Record<keyof NewThreadInput, string>>;

function validateText(text: string): string | undefined {
	if (text.length < LIMITS.text.min) return '내용을 입력해주세요.';
	if (text.length > LIMITS.text.max) return `내용은 ${LIMITS.text.max}자까지 입력할 수 있습니다.`;
}

/** 메시지 하나를 다듬고 검증한다. 서버(#9)도 같은 규칙을 쓴다. */
export function validateMessage(text: string): { value: string; error?: string } {
	const value = text.trim();
	return { value, error: validateText(value) };
}

/** 새 대화 시작 입력을 다듬고 검증한다. */
export function validateNewThread(input: NewThreadInput): { value: NewThreadInput; errors: InputErrors } {
	const value = { nickname: input.nickname.trim(), password: input.password, text: input.text.trim() };
	const errors: InputErrors = {};

	if (value.nickname.length < LIMITS.nickname.min) errors.nickname = '이름을 입력해주세요.';
	else if (value.nickname.length > LIMITS.nickname.max)
		errors.nickname = `이름은 ${LIMITS.nickname.max}자까지 입력할 수 있습니다.`;
	else if (value.nickname === OWNER_NAME) errors.nickname = '다른 이름을 입력해주세요.';

	if (value.password.length < LIMITS.password.min || value.password.length > LIMITS.password.max)
		errors.password = `비밀번호는 ${LIMITS.password.min}~${LIMITS.password.max}자로 입력해주세요.`;

	const textError = validateText(value.text);
	if (textError) errors.text = textError;

	return { value, errors };
}

/** 오래된 글이 위, 최신 글이 아래 */
export function sortMessages(messages: Message[]): Message[] {
	return [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** 고정 대화가 맨 위, 나머지는 최근 메시지 순 */
export function sortThreads(threads: Thread[]): Thread[] {
	const latest = (thread: Thread) => thread.lastMessage?.createdAt ?? thread.createdAt;
	return [...threads].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || latest(b).localeCompare(latest(a)));
}

/** 이 시간보다 벌어지면 시간 구분선을 넣고 말풍선 묶음을 끊는다 (메시지 앱과 같은 방식) */
export const TIME_GAP_MS = 60 * 60 * 1000;

export type TimelineItem =
	| { type: 'time'; key: string; label: string; dateTime: string }
	| {
			type: 'message';
			key: string;
			message: Message;
			/** 주인 글은 왼쪽, 방문자 글은 오른쪽 */
			side: 'left' | 'right';
			/** 같은 사람이 연달아 보낸 묶음의 마지막 말풍선에 꼬리를 단다 */
			tail: boolean;
			/** 방문자가 마지막으로 보낸 메시지 아래 '전송됨' (내 대화에서만) */
			receipt: boolean;
	  };

/** 메시지 목록을 시간 구분선과 말풍선 묶음 정보가 붙은 목록으로 바꾼다. */
export function buildTimeline(
	messages: Message[],
	options: { showReceipt: boolean; now: Date; timeZone?: string }
): TimelineItem[] {
	const sorted = sortMessages(messages);
	const time = (message: Message) => Date.parse(message.createdAt);
	const lastVisitorId = options.showReceipt ? sorted.filter((m) => !m.fromOwner).at(-1)?.id : undefined;
	const items: TimelineItem[] = [];

	sorted.forEach((message, index) => {
		const prev = sorted[index - 1];
		const next = sorted[index + 1];
		if (!prev || time(message) - time(prev) > TIME_GAP_MS) {
			items.push({
				type: 'time',
				key: `time-${message.id}`,
				label: formatTimeLabel(new Date(message.createdAt), options.now, options.timeZone),
				dateTime: message.createdAt,
			});
		}
		const sameAsNext = !!next && next.fromOwner === message.fromOwner && time(next) - time(message) <= TIME_GAP_MS;
		items.push({
			type: 'message',
			key: message.id,
			message,
			side: message.fromOwner ? 'left' : 'right',
			tail: !sameAsNext,
			receipt: message.id === lastVisitorId,
		});
	});
	return items;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** 시간대 기준 날짜를 비교용 숫자로 (UTC 자정 기준 밀리초) */
function dayNumber(date: Date, timeZone?: string): number {
	const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	})
		.format(date)
		.split('-')
		.map(Number);
	return Date.UTC(year, month - 1, day);
}

const daysBetween = (date: Date, now: Date, timeZone?: string) =>
	Math.round((dayNumber(now, timeZone) - dayNumber(date, timeZone)) / DAY_MS);

/**
 * 대화 안의 시간 구분선 문구.
 * 오늘 → "오늘 오전 10:36", 어제 → "어제 오후 3:00", 일주일 이내 → "금요일 오후 3:00",
 * 올해 → "9월 26일 (금) 오후 3:00", 그 이전 → "2025년 9월 26일 오후 3:00"
 */
export function formatTimeLabel(date: Date, now: Date, timeZone?: string): string {
	const format = (options: Intl.DateTimeFormatOptions) =>
		new Intl.DateTimeFormat('ko-KR', { timeZone, ...options }).format(date);
	const time = format({ hour: 'numeric', minute: '2-digit' });
	const daysAgo = daysBetween(date, now, timeZone);

	if (daysAgo === 0) return `오늘 ${time}`;
	if (daysAgo === 1) return `어제 ${time}`;
	if (daysAgo > 1 && daysAgo < 7) return `${format({ weekday: 'long' })} ${time}`;
	if (format({ year: 'numeric' }) === new Intl.DateTimeFormat('ko-KR', { timeZone, year: 'numeric' }).format(now)) {
		return `${format({ month: 'long', day: 'numeric' })} (${format({ weekday: 'short' })}) ${time}`;
	}
	return `${format({ year: 'numeric', month: 'long', day: 'numeric' })} ${time}`;
}

/**
 * 사이드바 목록의 시각 문구 (메시지 앱과 같은 방식).
 * 오늘 → "오전 10:36", 어제 → "어제", 일주일 이내 → "금요일", 그 이전 → "2026. 9. 1."
 */
export function formatListTime(date: Date, now: Date, timeZone?: string): string {
	const daysAgo = daysBetween(date, now, timeZone);
	const format = (options: Intl.DateTimeFormatOptions) =>
		new Intl.DateTimeFormat('ko-KR', { timeZone, ...options }).format(date);
	if (daysAgo === 0) return format({ hour: 'numeric', minute: '2-digit' });
	if (daysAgo === 1) return '어제';
	if (daysAgo > 1 && daysAgo < 7) return format({ weekday: 'long' });
	return format({ year: 'numeric', month: 'numeric', day: 'numeric' });
}

/** macOS 연락처처럼 이름마다 정해진 아바타 색 (같은 이름은 항상 같은 색) */
const AVATAR_GRADIENTS = [
	['#a5acb8', '#848a95'],
	['#ff8a80', '#e8615a'],
	['#ffb870', '#f0913c'],
	['#6fd08c', '#40b366'],
	['#6ec6ff', '#3a9be8'],
	['#b39dff', '#8c6cf0'],
	['#ff8ec1', '#ec5f9d'],
] as const;

export function avatarGradient(name: string): readonly [string, string] {
	let hash = 0;
	for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
	return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}
