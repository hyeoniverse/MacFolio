// 메시지 규칙. React와 DOM에 의존하지 않는 순수 함수만 둔다.
// 감상·의견·피드백을 남기는 공간이다. 쓰기 버튼으로 남긴 피드백 하나가 목록의 항목 하나가 되고,
// 누구나 어느 피드백에나 답글을 달 수 있다. 맨 위에는 사이트 주인(김정현)의 안내가 고정된다.
// 사람은 서버에서는 IP(해시), 로컬에서는 브라우저 id로 구분한다.

export const OWNER_NAME = '김정현';

/** 목록의 항목 하나: 피드백 하나와 그 답글들 (고정 항목은 사이트 주인의 안내) */
export interface Thread {
	id: string;
	/** 피드백을 남긴 사람의 이름 (고정 항목은 사이트 주인) */
	title: string;
	/** 남긴 사람 IP의 앞 두 자리 (서버에서만. 예: "211.234") */
	ipPrefix?: string;
	createdAt: string;
	/** 사이드바 맨 위에 고정되는 사이트 주인의 안내 */
	pinned?: boolean;
	/** 보고 있는 사람이 남긴 피드백인지 */
	mine?: boolean;
	/** 피드백 본문 (첫 메시지). 목록 미리보기에 쓴다 */
	summary?: string;
	/** 마지막 활동 (목록 정렬과 시각 표시) */
	lastMessage?: { text: string; createdAt: string };
}

export interface Message {
	id: string;
	threadId: string;
	text: string;
	/** ISO 8601 */
	createdAt: string;
	/** 같은 사람이 쓴 글을 묶는 데 쓰는 불투명한 id (IP나 브라우저 id의 해시) */
	authorId: string;
	nickname: string;
	ipPrefix?: string;
	/** 사이트 주인이 쓴 글 */
	fromOwner: boolean;
	/** 보고 있는 사람이 쓴 글 (오른쪽 말풍선) */
	mine: boolean;
}

export interface MessageInput {
	nickname: string;
	password: string;
	text: string;
}

export const LIMITS = {
	nickname: { min: 1, max: 20 },
	text: { min: 1, max: 500 },
	password: { min: 4, max: 20 },
} as const;

export type InputErrors = Partial<Record<keyof MessageInput, string>>;

/** 입력을 다듬고 검증한다. 서버(#9)도 같은 규칙을 쓴다. */
export function validateMessageInput(input: MessageInput): { value: MessageInput; errors: InputErrors } {
	const value = { nickname: input.nickname.trim(), password: input.password, text: input.text.trim() };
	const errors: InputErrors = {};

	if (value.nickname.length < LIMITS.nickname.min) errors.nickname = '이름을 입력해주세요.';
	else if (value.nickname.length > LIMITS.nickname.max)
		errors.nickname = `이름은 ${LIMITS.nickname.max}자까지 입력할 수 있습니다.`;
	else if (value.nickname === OWNER_NAME) errors.nickname = '다른 이름을 입력해주세요.';

	if (value.password.length < LIMITS.password.min || value.password.length > LIMITS.password.max)
		errors.password = `비밀번호는 ${LIMITS.password.min}~${LIMITS.password.max}자로 입력해주세요.`;

	if (value.text.length < LIMITS.text.min) errors.text = '내용을 입력해주세요.';
	else if (value.text.length > LIMITS.text.max) errors.text = `내용은 ${LIMITS.text.max}자까지 입력할 수 있습니다.`;

	return { value, errors };
}

/** 화면에 보여줄 이름. IP 앞 두 자리가 있으면 붙인다: "민수(211.234)" */
export function displayName(name: string, ipPrefix?: string): string {
	return ipPrefix ? `${name}(${ipPrefix})` : name;
}

/** IPv4는 앞 두 자리("211.234"), IPv6는 앞 두 묶음("2001:db8"). 서버에서 쓴다. */
export function maskIp(ip: string): string {
	const v4 = ip.replace(/^::ffff:/, '');
	if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return v4.split('.').slice(0, 2).join('.');
	return ip.split(':').slice(0, 2).join(':');
}

/** 오래된 글이 위, 최신 글이 아래 */
export function sortMessages(messages: Message[]): Message[] {
	return [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** 고정 항목이 맨 위, 나머지는 최근 활동 순 */
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
			/** 내 글은 오른쪽, 다른 사람 글은 왼쪽 */
			side: 'left' | 'right';
			/** 다른 사람이 연달아 쓴 묶음의 첫 말풍선 위에 이름을 보여준다 */
			showName: boolean;
			/** 같은 사람이 연달아 쓴 묶음의 마지막 말풍선에 꼬리를 단다 */
			tail: boolean;
			/** 내가 마지막으로 쓴 메시지 아래 '전송됨' */
			receipt: boolean;
	  };

/** 메시지 목록을 시간 구분선과 말풍선 묶음 정보가 붙은 목록으로 바꾼다. */
export function buildTimeline(messages: Message[], options: { now: Date; timeZone?: string }): TimelineItem[] {
	const sorted = sortMessages(messages);
	const time = (message: Message) => Date.parse(message.createdAt);
	const lastMineId = sorted.filter((m) => m.mine).at(-1)?.id;
	const items: TimelineItem[] = [];

	sorted.forEach((message, index) => {
		const prev = sorted[index - 1];
		const next = sorted[index + 1];
		const startsNewTime = !prev || time(message) - time(prev) > TIME_GAP_MS;
		if (startsNewTime) {
			items.push({
				type: 'time',
				key: `time-${message.id}`,
				label: formatTimeLabel(new Date(message.createdAt), options.now, options.timeZone),
				dateTime: message.createdAt,
			});
		}
		const sameAsPrev = !!prev && !startsNewTime && prev.authorId === message.authorId;
		const sameAsNext = !!next && next.authorId === message.authorId && time(next) - time(message) <= TIME_GAP_MS;
		items.push({
			type: 'message',
			key: message.id,
			message,
			side: message.mine ? 'right' : 'left',
			showName: !message.mine && !sameAsPrev,
			tail: !sameAsNext,
			receipt: message.id === lastMineId,
		});
	});
	return items;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

interface DateParts {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	weekday: number;
}

/**
 * 시간대 기준 날짜·시각 숫자. 문구는 직접 조립한다.
 * Intl의 한국어 출력(예: '오전'과 'AM')은 브라우저·Node의 ICU 버전마다 달라서 숫자만 받는다.
 */
function partsOf(date: Date, timeZone?: string): DateParts {
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat('en-US', {
			timeZone,
			year: 'numeric',
			month: 'numeric',
			day: 'numeric',
			hour: 'numeric',
			minute: 'numeric',
			hourCycle: 'h23',
		})
			.formatToParts(date)
			.map((part) => [part.type, Number(part.value)])
	) as Record<string, number>;
	const { year, month, day, hour, minute } = parts;
	return { year, month, day, hour, minute, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() };
}

const dayNumber = ({ year, month, day }: DateParts) => Date.UTC(year, month - 1, day);

/** "오전 10:36" */
function clock({ hour, minute }: DateParts): string {
	return `${hour < 12 ? '오전' : '오후'} ${hour % 12 || 12}:${String(minute).padStart(2, '0')}`;
}

/**
 * 대화 안의 시간 구분선 문구.
 * 오늘 → "오늘 오전 10:36", 어제 → "어제 오후 3:00", 일주일 이내 → "금요일 오후 3:00",
 * 올해 → "3월 2일 (월) 오후 3:00", 그 이전 → "2025년 9월 26일 오후 3:00"
 */
export function formatTimeLabel(date: Date, now: Date, timeZone?: string): string {
	const target = partsOf(date, timeZone);
	const today = partsOf(now, timeZone);
	const daysAgo = Math.round((dayNumber(today) - dayNumber(target)) / DAY_MS);
	const time = clock(target);

	if (daysAgo === 0) return `오늘 ${time}`;
	if (daysAgo === 1) return `어제 ${time}`;
	if (daysAgo > 1 && daysAgo < 7) return `${WEEKDAYS[target.weekday]}요일 ${time}`;
	if (target.year === today.year) return `${target.month}월 ${target.day}일 (${WEEKDAYS[target.weekday]}) ${time}`;
	return `${target.year}년 ${target.month}월 ${target.day}일 ${time}`;
}

/**
 * 사이드바 목록의 시각 문구 (메시지 앱과 같은 방식).
 * 오늘 → "오전 10:36", 어제 → "어제", 일주일 이내 → "금요일", 그 이전 → "2026. 9. 1."
 */
export function formatListTime(date: Date, now: Date, timeZone?: string): string {
	const target = partsOf(date, timeZone);
	const daysAgo = Math.round((dayNumber(partsOf(now, timeZone)) - dayNumber(target)) / DAY_MS);
	if (daysAgo === 0) return clock(target);
	if (daysAgo === 1) return '어제';
	if (daysAgo > 1 && daysAgo < 7) return `${WEEKDAYS[target.weekday]}요일`;
	return `${target.year}. ${target.month}. ${target.day}.`;
}

/**
 * 아바타에 보여줄 글자 (macOS 연락처와 같은 방식).
 * 두 글자 이하는 통째로("엄마"), 그보다 길면 첫 글자("김정현" → "김")
 */
export function monogram(name: string): string {
	const chars = Array.from(name.trim());
	return chars.length <= 2 ? chars.join('') : chars[0];
}
