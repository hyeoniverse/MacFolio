// 트래픽 분석 (apps/api의 /analytics). 사이트가 5초마다 모아 보내는 이벤트 묶음과, 활동 상태 보기·조회수가 읽는 응답.
// 서버가 요청에서 뽑는 것(User-Agent 줄이기, IP 가리기, 하루 해시)과 집계는 서버의 analytics/rules.ts
import { z } from 'zod';

export const EVENT_TYPES = ['visit', 'app', 'item', 'link', 'leave'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** 한 번에 받는 이벤트 수 (사이트는 이만큼 모이면 바로 보낸다) */
export const MAX_EVENTS = 30;
/** 머문 시간의 상한 (하루) */
export const MAX_DURATION_MS = 24 * 60 * 60 * 1000;

const VISIT_ID = /^[\w-]{8,64}$/;
/** 앱 이름 모양 (예: memo). 조회수 조회의 ?app= 에도 같은 규칙 */
export const APP_NAME = /^[a-z][a-z0-9-]{0,31}$/;
const HOST = /^[a-z0-9.-]{1,253}$/;
const LANGUAGE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

/** utm 값 하나의 상한 (글자 수) */
export const UTM_MAX = 100;

/**
 * utm 값을 다듬는다: 앞뒤 공백을 빼고 소문자로, 이어진 공백은 '-' 하나로, 100자까지. 비면 undefined.
 * 링크 생성기(분석 앱)와 받는 쪽(사이트의 utmOf, 서버의 EventInput)이 같은 규칙을 쓴다 (#211)
 */
export function cleanUtm(value: string | null | undefined): string | undefined {
	const cleaned = (value ?? '').trim().toLowerCase().replace(/\s+/g, '-').slice(0, UTM_MAX);
	return cleaned || undefined;
}

/**
 * 조합 표(utm)의 키: 출처·매체·캠페인을 ' / '로 묶는다. 빈 칸은 ''.
 * cleanUtm이 공백을 '-'로 바꾸므로 값에는 ' / '가 없다. PostgreSQL의 글자 열은 \u0000을 받지 않아 그것으로 묶지 않는다
 */
export const UTM_KEY_SEPARATOR = ' / ';
export const utmKey = (source?: string | null, medium?: string | null, campaign?: string | null) =>
	[source ?? '', medium ?? '', campaign ?? ''].join(UTM_KEY_SEPARATOR);
/** 조합 키를 [출처, 매체, 캠페인]으로 */
export const splitUtmKey = (key: string): [string, string, string] => {
	const [source = '', medium = '', campaign = ''] = key.split(UTM_KEY_SEPARATOR);
	return [source, medium, campaign];
};

/** 비었으면(undefined·null·'') 없는 것으로, 길이가 맞는 글자면 그대로 */
const text = (max: number, name: string) =>
	z.preprocess(
		(value) => (value === null || value === '' ? undefined : value),
		z
			.string({ error: `${name}은(는) ${max}자 이하의 글자입니다.` })
			.max(max, `${name}은(는) ${max}자 이하의 글자입니다.`)
			.optional()
	);

/** 브라우저가 보내는 이벤트 하나 (서버가 붙이는 나라·브라우저·하루 해시는 없다). 모르는 필드는 버린다 */
export const EventInput = z.object({
	type: z.enum(EVENT_TYPES, { error: 'type이 올바르지 않습니다.' }),
	app: text(32, 'app').refine((app) => !app || APP_NAME.test(app), 'app이 올바르지 않습니다.'),
	item: text(200, 'item'),
	path: text(300, 'path'),
	/** 들어온 곳의 호스트만 (경로·검색어는 받지 않는다). 소문자로 */
	referrer: text(253, 'referrer')
		.transform((referrer) => referrer?.toLowerCase())
		.refine((referrer) => !referrer || HOST.test(referrer), 'referrer는 호스트만 받습니다.'),
	/** utm 값은 cleanUtm으로 다듬어 저장한다 (소문자, 공백은 '-') */
	utmSource: text(UTM_MAX, 'utmSource').transform(cleanUtm),
	utmMedium: text(UTM_MAX, 'utmMedium').transform(cleanUtm),
	utmCampaign: text(UTM_MAX, 'utmCampaign').transform(cleanUtm),
	utmTerm: text(UTM_MAX, 'utmTerm').transform(cleanUtm),
	utmContent: text(UTM_MAX, 'utmContent').transform(cleanUtm),
	device: z.enum(['desktop', 'mobile'], { error: 'device는 desktop, mobile입니다.' }).optional(),
	language: text(35, 'language').refine(
		(language) => !language || LANGUAGE.test(language),
		'language가 올바르지 않습니다.'
	),
	duration: z
		.number({ error: `duration은 0~${MAX_DURATION_MS} 정수(ms)입니다.` })
		.int(`duration은 0~${MAX_DURATION_MS} 정수(ms)입니다.`)
		.min(0, `duration은 0~${MAX_DURATION_MS} 정수(ms)입니다.`)
		.max(MAX_DURATION_MS, `duration은 0~${MAX_DURATION_MS} 정수(ms)입니다.`)
		.optional(),
});
export type EventInput = z.infer<typeof EventInput>;

/**
 * 브라우저가 보낸 묶음 (POST /analytics/events). sendBeacon이 text/plain으로 보내므로 JSON 글자로 와도 받는다.
 * 하나라도 틀리면 전부 거절한다 (사이트의 버그를 숨기지 않는다)
 */
export const EventBatch = z.preprocess(
	(input) => {
		if (typeof input !== 'string') return input;
		try {
			return JSON.parse(input);
		} catch {
			return input;
		}
	},
	z.object(
		{
			visitId: z.string({ error: 'visitId가 올바르지 않습니다.' }).regex(VISIT_ID, 'visitId가 올바르지 않습니다.'),
			events: z
				.array(EventInput, { error: `events는 1~${MAX_EVENTS}개입니다.` })
				.min(1, `events는 1~${MAX_EVENTS}개입니다.`)
				.max(MAX_EVENTS, `events는 1~${MAX_EVENTS}개입니다.`),
		},
		{ error: '본문이 없습니다.' }
	)
);
export type EventBatch = z.infer<typeof EventBatch>;

/** 요약에 싣는 표 (지표 → 많은 순). referrerGroup은 referrer를 검색·소셜·직접·링크로 묶은 것 */
export const BREAKDOWNS = [
	'referrerGroup',
	'referrer',
	'source',
	'medium',
	'campaign',
	'utm',
	'term',
	'content',
	'app',
	'item',
	'link',
	'country',
	'device',
	'browser',
	'os',
	'language',
] as const;
export type Breakdown = (typeof BREAKDOWNS)[number];
/**
 * 방문자에게는 감추는 표: 들어온 곳의 호스트와 utm (지원한 곳 이름이 드러날 수 있다).
 * utm은 출처·매체·캠페인 조합 (키는 utmKey), term·content는 조합에 붙이지 않고 따로 센다
 */
export const ADMIN_ONLY_BREAKDOWNS = ['referrer', 'source', 'medium', 'campaign', 'utm', 'term', 'content'] as const;

/** 요약의 utm= 거르기의 상한 (출처·매체·캠페인 셋과 구분자 둘) */
export const UTM_FILTER_MAX = UTM_MAX * 3 + UTM_KEY_SEPARATOR.length * 2;

export const Totals = z.object({
	visits: z.number().int(),
	/** 일별 순방문자의 합 (날을 넘겨 같은 사람을 알아보지 않는다) */
	visitors: z.number().int(),
	appOpens: z.number().int(),
	/** 머문 시간을 보낸 방문의 평균 (초). 없으면 null */
	avgDurationSec: z.number().nullable(),
});
export type Totals = z.infer<typeof Totals>;

/** 표의 한 줄 */
export const StatRow = z.object({ key: z.string(), value: z.number() });
export type StatRow = z.infer<typeof StatRow>;

/** GET /analytics/summary */
export const Summary = z.object({
	/** admin: 모든 표, public: 방문자에게 공개하는 표만 (ADMIN_ONLY_BREAKDOWNS는 빈 목록) */
	scope: z.enum(['admin', 'public']),
	from: z.string(),
	to: z.string(),
	days: z.array(z.object({ day: z.string(), visits: z.number().int(), visitors: z.number().int() })),
	totals: Totals,
	/** 바로 앞의 같은 길이 기간 (비교용) */
	previous: Totals,
	/** 관리자가 utm=(조합 키)로 물었을 때만: 그 조합의 일별 방문 */
	utmTrend: z
		.object({ key: z.string(), days: z.array(z.object({ day: z.string(), visits: z.number().int() })) })
		.optional(),
	breakdown: z.object(
		Object.fromEntries(BREAKDOWNS.map((metric) => [metric, z.array(StatRow)])) as Record<
			Breakdown,
			z.ZodArray<typeof StatRow>
		>
	),
});
export type Summary = z.infer<typeof Summary>;

/** GET /analytics/live의 항목: 최근 방문 하나와 그 흐름 */
export const LiveVisit = z.object({
	visitId: z.string(),
	startedAt: z.string(),
	lastAt: z.string(),
	/** 하루 해시의 앞 4자리 (같은 사람의 방문을 묶어 본다) */
	visitor: z.string(),
	country: z.string().nullable(),
	device: z.string().nullable(),
	browser: z.string().nullable(),
	os: z.string().nullable(),
	referrer: z.string().nullable(),
	path: z.string().nullable(),
	/** 가린 IP (7일이 지나면 null) */
	ip: z.string().nullable(),
	events: z.array(
		z.object({ type: z.string(), app: z.string().nullable(), item: z.string().nullable(), at: z.string() })
	),
});
export type LiveVisit = z.infer<typeof LiveVisit>;

/** GET /analytics/today: 오늘(한국 시간) 순방문자 */
export const TodayVisitors = z.object({ day: z.string(), visitors: z.number().int() });
export type TodayVisitors = z.infer<typeof TodayVisitors>;

/** GET /analytics/views?app=: 앱의 항목마다 조회수 */
export const AppViews = z.object({ app: z.string(), views: z.record(z.string(), z.number().int()) });
export type AppViews = z.infer<typeof AppViews>;
