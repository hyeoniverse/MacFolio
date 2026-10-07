// 트래픽 분석의 규칙 (#102). 순수 함수만 둔다: 받은 값 검사, User-Agent 줄이기, IP 가리기, 하루 해시, 하루치 집계.
import { createHmac } from 'node:crypto';

export const EVENT_TYPES = ['visit', 'app', 'item', 'link', 'leave'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** 한 번에 받는 이벤트 수 (사이트는 5초마다 모아 보낸다) */
export const MAX_EVENTS = 30;
/** 머문 시간의 상한 (하루) */
const MAX_DURATION_MS = 24 * 60 * 60 * 1000;
/** 원래 이벤트를 두는 기간과, 가린 IP를 두는 기간 */
export const EVENT_RETENTION_DAYS = 90;
export const IP_RETENTION_DAYS = 7;

/** 브라우저가 보내는 이벤트 하나 (서버가 붙이는 나라·브라우저·하루 해시는 없다) */
export interface EventInput {
	type: EventType;
	app?: string;
	item?: string;
	path?: string;
	referrer?: string;
	utmSource?: string;
	utmMedium?: string;
	utmCampaign?: string;
	device?: 'desktop' | 'mobile';
	language?: string;
	duration?: number;
}

export interface EventBatch {
	visitId: string;
	events: EventInput[];
}

const VISIT_ID = /^[\w-]{8,64}$/;
const APP = /^[a-z][a-z0-9-]{0,31}$/;
const HOST = /^[a-z0-9.-]{1,253}$/;
const LANGUAGE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

/** 길이가 맞는 글자면 그대로, 비었으면 undefined, 아니면 오류 */
function text(value: unknown, max: number, name: string, errors: string[]): string | undefined {
	if (value === undefined || value === null || value === '') return undefined;
	if (typeof value !== 'string' || value.length > max) {
		errors.push(`${name}은(는) ${max}자 이하의 글자입니다.`);
		return undefined;
	}
	return value;
}

/**
 * 브라우저가 보낸 묶음을 검사한다. sendBeacon이 text/plain으로 보내므로 JSON 글자로 와도 받는다.
 * 하나라도 틀리면 전부 거절한다 (사이트의 버그를 숨기지 않는다)
 */
export function parseBatch(input: unknown): { value: EventBatch } | { errors: string[] } {
	let raw = input;
	if (typeof raw === 'string') {
		try {
			raw = JSON.parse(raw);
		} catch {
			return { errors: ['JSON이 아닙니다.'] };
		}
	}
	if (!raw || typeof raw !== 'object') return { errors: ['본문이 없습니다.'] };
	const { visitId, events } = raw as Record<string, unknown>;
	const errors: string[] = [];
	if (typeof visitId !== 'string' || !VISIT_ID.test(visitId)) errors.push('visitId가 올바르지 않습니다.');
	if (!Array.isArray(events) || events.length === 0 || events.length > MAX_EVENTS)
		return { errors: [...errors, `events는 1~${MAX_EVENTS}개입니다.`] };

	const parsed = events.map((event, index): EventInput => {
		const at = `events[${index}]`;
		if (!event || typeof event !== 'object') {
			errors.push(`${at}가 올바르지 않습니다.`);
			return { type: 'visit' };
		}
		const e = event as Record<string, unknown>;
		if (!EVENT_TYPES.includes(e.type as EventType)) errors.push(`${at}.type이 올바르지 않습니다.`);
		const app = text(e.app, 32, `${at}.app`, errors);
		if (app && !APP.test(app)) errors.push(`${at}.app이 올바르지 않습니다.`);
		const referrer = text(e.referrer, 253, `${at}.referrer`, errors)?.toLowerCase();
		if (referrer && !HOST.test(referrer)) errors.push(`${at}.referrer는 호스트만 받습니다.`);
		const language = text(e.language, 35, `${at}.language`, errors);
		if (language && !LANGUAGE.test(language)) errors.push(`${at}.language가 올바르지 않습니다.`);
		if (e.device !== undefined && e.device !== 'desktop' && e.device !== 'mobile')
			errors.push(`${at}.device는 desktop, mobile입니다.`);
		if (
			e.duration !== undefined &&
			(!Number.isInteger(e.duration) || (e.duration as number) < 0 || (e.duration as number) > MAX_DURATION_MS)
		)
			errors.push(`${at}.duration은 0~${MAX_DURATION_MS} 정수(ms)입니다.`);
		return {
			type: e.type as EventType,
			app,
			item: text(e.item, 200, `${at}.item`, errors),
			path: text(e.path, 300, `${at}.path`, errors),
			referrer,
			utmSource: text(e.utmSource, 100, `${at}.utmSource`, errors),
			utmMedium: text(e.utmMedium, 100, `${at}.utmMedium`, errors),
			utmCampaign: text(e.utmCampaign, 100, `${at}.utmCampaign`, errors),
			device: e.device as EventInput['device'],
			language,
			duration: e.duration as number | undefined,
		};
	});
	return errors.length ? { errors } : { value: { visitId: visitId as string, events: parsed } };
}

/** 세지 않는 요청: 검색 로봇, 미리보기, 자동 도구 */
const BOT =
	/bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|curl|wget|python|axios|node-fetch|go-http/i;
export const isBot = (userAgent: string | undefined) => !userAgent || BOT.test(userAgent);

/** User-Agent를 브라우저·OS 종류로 줄인다. 원문은 저장하지 않는다 */
export function parseUserAgent(userAgent: string): { browser: string; os: string } {
	const browser = /Edg(e|A|iOS)?\//.test(userAgent)
		? 'Edge'
		: /SamsungBrowser/.test(userAgent)
			? 'Samsung Internet'
			: /OPR\/|Opera/.test(userAgent)
				? 'Opera'
				: /Firefox\/|FxiOS/.test(userAgent)
					? 'Firefox'
					: /Chrome\/|CriOS/.test(userAgent)
						? 'Chrome'
						: /Safari\//.test(userAgent)
							? 'Safari'
							: '기타';
	const os = /iPhone|iPad|iPod/.test(userAgent)
		? 'iOS'
		: /Android/.test(userAgent)
			? 'Android'
			: /Mac OS X|Macintosh/.test(userAgent)
				? 'macOS'
				: /Windows/.test(userAgent)
					? 'Windows'
					: /CrOS/.test(userAgent)
						? 'ChromeOS'
						: /Linux/.test(userAgent)
							? 'Linux'
							: '기타';
	return { browser, os };
}

/** 마지막 자리를 가린 IP. IPv4는 203.0.113.x, IPv6는 앞 세 묶음(2001:db8:1::) */
export function maskIp(ip: string): string | null {
	const v4 = ip.replace(/^::ffff:/, '');
	if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return `${v4.split('.').slice(0, 3).join('.')}.x`;
	if (ip.includes(':')) return `${ip.split(':').slice(0, 3).join(':')}::`;
	return null;
}

/** Cloudflare가 붙인 나라 (두 글자). 모르는 값(XX)과 Tor(T1)는 버린다 */
export function countryOf(header: string | string[] | undefined): string | null {
	const value = Array.isArray(header) ? header[0] : header;
	return value && /^[A-Z]{2}$/.test(value) && value !== 'XX' && value !== 'T1' ? value : null;
}

/** 한국 시간의 날짜 (YYYY-MM-DD) */
export const kstDay = (date: Date) => new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** 날짜를 n일 옮긴다 (YYYY-MM-DD) */
export const shiftDay = (day: string, days: number) =>
	new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** 같은 날 같은 사람(IP + 브라우저)이면 같은 값. 날이 바뀌면 달라진다 */
export const dayHash = (day: string, ip: string, userAgent: string, secret: string) =>
	createHmac('sha256', secret).update(`analytics:${day}:${ip}:${userAgent}`).digest('hex');

/** 집계에 쓰는 저장된 이벤트 (DB 행과 같은 모양) */
export interface StoredEvent {
	type: string;
	visitId: string;
	dayHash: string;
	app?: string | null;
	item?: string | null;
	referrer?: string | null;
	utmSource?: string | null;
	utmCampaign?: string | null;
	country?: string | null;
	device?: string | null;
	browser?: string | null;
	os?: string | null;
	language?: string | null;
	duration?: number | null;
}

export interface StatRow {
	metric: string;
	key: string;
	value: number;
}

/** 방문(visit)마다 세는 지표: 들어온 곳, 나라, 기기 … */
const PER_VISIT = ['referrer', 'source', 'campaign', 'country', 'device', 'browser', 'os', 'language'] as const;

/**
 * 하루치 이벤트를 (지표, 키, 값) 행으로 모은다. 날마다 DailyStat에 저장하고, 오늘 것은 화면을 열 때 바로 계산한다.
 * visits는 방문이 없어도 0으로 둔다 (그날을 모았다는 표시)
 */
export function aggregate(events: StoredEvent[]): StatRow[] {
	const counts = new Map<string, number>();
	const add = (metric: string, key: string, value = 1) =>
		counts.set(`${metric}\u0000${key}`, (counts.get(`${metric}\u0000${key}`) ?? 0) + value);

	add('visits', '', 0);
	const visitors = new Set<string>();
	const durations = new Map<string, number>();
	// 글·프로젝트 보기는 방문마다 한 번: 한 방문에서 같은 글을 여러 번 열어도 조회수 1
	const viewed = new Set<string>();
	for (const event of events) {
		visitors.add(event.dayHash);
		if (event.type === 'visit') {
			add('visits', '');
			const values: Record<(typeof PER_VISIT)[number], string | null | undefined> = {
				referrer: event.referrer ?? '',
				source: event.utmSource,
				campaign: event.utmCampaign,
				country: event.country ?? '',
				device: event.device ?? '',
				browser: event.browser ?? '',
				os: event.os ?? '',
				language: event.language ?? '',
			};
			for (const metric of PER_VISIT) {
				const key = values[metric];
				if (key !== undefined && key !== null) add(metric, key);
			}
		} else if (event.type === 'app' && event.app) {
			add('appOpens', '');
			add('app', event.app);
		} else if (event.type === 'item' && event.app && event.item) {
			const key = `${event.app}/${event.item}`;
			if (!viewed.has(`${event.visitId}\u0000${key}`)) add('item', key);
			viewed.add(`${event.visitId}\u0000${key}`);
		} else if (event.type === 'link' && event.item) {
			add('link', event.item);
		} else if (event.type === 'leave' && typeof event.duration === 'number') {
			// 탭을 숨길 때마다 그때까지 머문 시간을 보낸다: 방문마다 가장 긴 값
			durations.set(event.visitId, Math.max(durations.get(event.visitId) ?? 0, event.duration));
		}
	}
	if (visitors.size) add('visitors', '', visitors.size);
	if (durations.size) {
		add('durationSec', '', Math.round([...durations.values()].reduce((sum, ms) => sum + ms, 0) / 1000));
		add('durationVisits', '', durations.size);
	}
	return [...counts].map(([id, value]) => {
		const [metric, key] = id.split('\u0000');
		return { metric, key, value };
	});
}

const SEARCH = /(^|\.)(google|bing|naver|daum|yahoo|duckduckgo|baidu|yandex|ecosia)\./;
const SOCIAL =
	/(^|\.)(linkedin\.com|lnkd\.in|facebook\.com|instagram\.com|x\.com|t\.co|twitter\.com|threads\.net|kakao\.com|reddit\.com|youtube\.com|velog\.io|tistory\.com|discord\.com)$/;

/** 들어온 곳의 묶음: 검색, 소셜, 직접, 링크. 방문자에게는 호스트 대신 이 묶음만 보인다 */
export function referrerGroup(host: string): '검색' | '소셜' | '직접' | '링크' {
	if (!host) return '직접';
	if (SEARCH.test(host)) return '검색';
	if (SOCIAL.test(host)) return '소셜';
	return '링크';
}
