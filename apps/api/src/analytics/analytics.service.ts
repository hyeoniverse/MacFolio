import {
	BadRequestException,
	HttpException,
	HttpStatus,
	Inject,
	Injectable,
	type OnModuleDestroy,
	type OnModuleInit,
} from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
	aggregate,
	countryOf,
	dayHash,
	EVENT_RETENTION_DAYS,
	IP_RETENTION_DAYS,
	isBot,
	kstDay,
	maskIp,
	parseBatch,
	parseUserAgent,
	referrerGroup,
	shiftDay,
	type StatRow,
} from './rules.js';

/** 요약에 싣는 표 (지표 → 많은 순). referrerGroup은 referrer를 검색·소셜·직접·링크로 묶은 것 */
export const BREAKDOWNS = [
	'referrerGroup',
	'referrer',
	'source',
	'campaign',
	'app',
	'item',
	'link',
	'country',
	'device',
	'browser',
	'os',
	'language',
] as const;

export interface Totals {
	visits: number;
	/** 일별 순방문자의 합 (날을 넘겨 같은 사람을 알아보지 않는다) */
	visitors: number;
	appOpens: number;
	/** 머문 시간을 보낸 방문의 평균 (초). 없으면 null */
	avgDurationSec: number | null;
}

/** 방문자에게는 감추는 표: 들어온 곳의 호스트와 utm (지원한 곳 이름이 드러날 수 있다) */
export const ADMIN_ONLY_BREAKDOWNS = ['referrer', 'source', 'campaign'] as const;

export interface Summary {
	/** admin: 모든 표, public: 방문자에게 공개하는 표만 (ADMIN_ONLY_BREAKDOWNS는 빈 목록) */
	scope: 'admin' | 'public';
	from: string;
	to: string;
	days: { day: string; visits: number; visitors: number }[];
	totals: Totals;
	/** 바로 앞의 같은 길이 기간 (비교용) */
	previous: Totals;
	breakdown: Record<(typeof BREAKDOWNS)[number], { key: string; value: number }[]>;
}

export interface LiveVisit {
	visitId: string;
	startedAt: string;
	lastAt: string;
	/** 하루 해시의 앞 4자리 (같은 사람의 방문을 묶어 본다) */
	visitor: string;
	country: string | null;
	device: string | null;
	browser: string | null;
	os: string | null;
	referrer: string | null;
	path: string | null;
	/** 가린 IP (7일이 지나면 null) */
	ip: string | null;
	events: { type: string; app: string | null; item: string | null; at: string }[];
}

/** 받은 요청의 사정 (컨트롤러가 채운다) */
export interface Sender {
	ip: string;
	userAgent: string | undefined;
	country: string | string[] | undefined;
	/** 관리자 세션이 있다 (세지 않는다) */
	admin: boolean;
}

const HOUR = 60 * 60 * 1000;
/** IP마다 1분에 받는 묶음 수 (사이트는 5초마다 보낸다) */
const BATCHES_PER_MINUTE = 30;
/** "오늘 방문자"를 다시 세는 간격 */
const TODAY_CACHE_MS = 60_000;
/** 요약 기간의 상한 */
const MAX_RANGE_DAYS = 366;
/** 방문자용 요약과 조회수를 다시 계산하는 간격 (누구나 부르는 경로라 DB를 매번 읽지 않는다) */
const PUBLIC_CACHE_MS = 60_000;
/** 요약을 열 때 지난 날을 모으는 일을 다시 하는 간격 */
const MAINTAIN_GAP_MS = 5 * 60_000;

const sumOf = (rows: StatRow[], metric: string) =>
	rows.filter((row) => row.metric === metric).reduce((sum, row) => sum + row.value, 0);

function totalsOf(rows: StatRow[]): Totals {
	const durationVisits = sumOf(rows, 'durationVisits');
	return {
		visits: sumOf(rows, 'visits'),
		visitors: sumOf(rows, 'visitors'),
		appOpens: sumOf(rows, 'appOpens'),
		avgDurationSec: durationVisits ? Math.round(sumOf(rows, 'durationSec') / durationVisits) : null,
	};
}

/**
 * 트래픽 분석 (#102). 이벤트를 받아 두고, 지난 날은 DailyStat으로 모은 뒤 90일이 지나면 지운다.
 * 순방문자는 하루 해시로 센다. 원래 IP와 쿠키는 쓰지 않는다
 */
@Injectable()
export class AnalyticsService implements OnModuleInit, OnModuleDestroy {
	private timer?: NodeJS.Timeout;
	private readonly batches = new Map<string, { windowStart: number; count: number }>();
	private today?: { day: string; visitors: number; at: number };
	private readonly publicCache = new Map<string, { at: number; value: unknown }>();
	private maintainedAt = 0;

	/** 지난 날 모으기를 5분에 한 번만 (날이 바뀌었으면 바로). 요약·조회수를 열 때 부른다 */
	private async maintainIfStale(now: Date) {
		const sameDay = kstDay(new Date(this.maintainedAt)) === kstDay(now);
		if (!sameDay || now.getTime() - this.maintainedAt > MAINTAIN_GAP_MS) await this.maintain(now);
	}

	/** 방문자에게 주는 값: 같은 질문이면 1분 동안 같은 값 */
	private async cached<T>(key: string, now: Date, compute: () => Promise<T>): Promise<T> {
		const hit = this.publicCache.get(key);
		if (hit && now.getTime() - hit.at < PUBLIC_CACHE_MS) return hit.value as T;
		const value = await compute();
		if (this.publicCache.size > 500) this.publicCache.clear();
		this.publicCache.set(key, { at: now.getTime(), value });
		return value;
	}

	constructor(
		private readonly prisma: PrismaService,
		@Inject(APP_CONFIG) private readonly config: AppConfig
	) {}

	onModuleInit() {
		// 한 시간마다 지난 날을 모으고 오래된 것을 지운다 (서버 한 대라 따로 작업 도구를 두지 않는다)
		this.timer = setInterval(() => void this.maintain().catch(() => undefined), HOUR);
		this.timer.unref();
	}

	onModuleDestroy() {
		clearInterval(this.timer);
	}

	/** IP마다 1분에 BATCHES_PER_MINUTE번까지 */
	private checkRate(ip: string, now: number) {
		const entry = this.batches.get(ip);
		if (!entry || now - entry.windowStart >= 60_000) {
			if (this.batches.size > 10_000) this.batches.clear();
			this.batches.set(ip, { windowStart: now, count: 1 });
			return;
		}
		if (++entry.count > BATCHES_PER_MINUTE)
			throw new HttpException('짧은 시간에 너무 많이 보냈습니다.', HttpStatus.TOO_MANY_REQUESTS);
	}

	/** 이벤트 묶음을 저장한다. 로봇과 관리자는 세지 않는다 (저장한 수를 돌려준다) */
	async record(input: unknown, sender: Sender, now = new Date()): Promise<number> {
		const parsed = parseBatch(input);
		if ('errors' in parsed) throw new BadRequestException(parsed.errors);
		this.checkRate(sender.ip, now.getTime());
		if (sender.admin || isBot(sender.userAgent)) return 0;

		const day = kstDay(now);
		const userAgent = sender.userAgent ?? '';
		const { browser, os } = parseUserAgent(userAgent);
		const shared = {
			createdAt: now,
			day,
			dayHash: dayHash(day, sender.ip, userAgent, this.config.ipHashSecret),
			visitId: parsed.value.visitId,
			country: countryOf(sender.country),
			browser,
			os,
			maskedIp: maskIp(sender.ip),
		};
		const { count } = await this.prisma.analyticsEvent.createMany({
			data: parsed.value.events.map((event) => ({ ...event, ...shared })),
		});
		return count;
	}

	/** 오늘(한국 시간) 순방문자 수. 방문자에게 공개하는 숫자라 1분 동안 같은 값을 준다 */
	async todayVisitors(now = new Date()): Promise<{ day: string; visitors: number }> {
		const day = kstDay(now);
		if (this.today?.day === day && now.getTime() - this.today.at < TODAY_CACHE_MS)
			return { day, visitors: this.today.visitors };
		const rows = await this.prisma.analyticsEvent.findMany({
			where: { day },
			distinct: ['dayHash'],
			select: { dayHash: true },
		});
		this.today = { day, visitors: rows.length, at: now.getTime() };
		return { day, visitors: rows.length };
	}

	/**
	 * 지난 날(오늘 전)의 이벤트를 DailyStat으로 모으고, 90일이 지난 이벤트와 7일이 지난 가린 IP를 지운다.
	 * 이벤트의 날짜는 받은 시각으로 정하므로 오늘 전의 날은 더 바뀌지 않는다
	 */
	async maintain(now = new Date()) {
		this.maintainedAt = now.getTime();
		const today = kstDay(now);
		const pending = await this.prisma.analyticsEvent.findMany({
			where: { day: { lt: today } },
			distinct: ['day'],
			select: { day: true },
		});
		// 모은 날에는 visits 행이 꼭 있다 (aggregate)
		const done = await this.prisma.dailyStat.findMany({
			where: { metric: 'visits', key: '', day: { in: pending.map(({ day }) => day) } },
			select: { day: true },
		});
		const doneDays = new Set(done.map(({ day }) => day));
		for (const { day } of pending) {
			if (doneDays.has(day)) continue;
			const events = await this.prisma.analyticsEvent.findMany({ where: { day } });
			await this.prisma.dailyStat.createMany({
				data: aggregate(events).map((row) => ({ ...row, day })),
				skipDuplicates: true,
			});
		}
		await this.prisma.analyticsEvent.deleteMany({
			where: { createdAt: { lt: new Date(now.getTime() - EVENT_RETENTION_DAYS * 24 * HOUR) } },
		});
		await this.prisma.analyticsEvent.updateMany({
			where: { createdAt: { lt: new Date(now.getTime() - IP_RETENTION_DAYS * 24 * HOUR) }, maskedIp: { not: null } },
			data: { maskedIp: null },
		});
	}

	/** 기간의 (날짜, 지표, 키, 값). 지난 날은 DailyStat, 오늘은 이벤트에서 바로 */
	private async rowsBetween(from: string, to: string, today: string): Promise<(StatRow & { day: string })[]> {
		const stored = await this.prisma.dailyStat.findMany({
			where: { day: { gte: from, lte: to < today ? to : shiftDay(today, -1) } },
		});
		if (to < today || from > today) return stored;
		const events = await this.prisma.analyticsEvent.findMany({ where: { day: today } });
		return [...stored, ...aggregate(events).map((row) => ({ ...row, day: today }))];
	}

	/**
	 * 요약: 일별 방문, 합계(앞 기간과 비교), 지표별 표. 관리자가 아니면 들어온 곳의 호스트와 utm을 빼고,
	 * 같은 기간이면 1분 동안 같은 값을 준다
	 */
	async summary(fromInput: unknown, toInput: unknown, admin: boolean, now = new Date()): Promise<Summary> {
		const today = kstDay(now);
		const day = /^\d{4}-\d{2}-\d{2}$/;
		const to = typeof toInput === 'string' && day.test(toInput) ? toInput : today;
		const from = typeof fromInput === 'string' && day.test(fromInput) ? fromInput : shiftDay(to, -6);
		const length = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
		if (!(length >= 1 && length <= MAX_RANGE_DAYS))
			throw new BadRequestException(`기간은 1~${MAX_RANGE_DAYS}일입니다 (from ≤ to).`);
		if (admin) return this.computeSummary(from, to, length, today, 'admin', now);
		return this.cached(`summary:${from}:${to}`, now, () => this.computeSummary(from, to, length, today, 'public', now));
	}

	private async computeSummary(
		from: string,
		to: string,
		length: number,
		today: string,
		scope: Summary['scope'],
		now: Date
	): Promise<Summary> {
		// 관리자는 열 때마다 모은다 (드물게 연다). 방문자는 5분에 한 번
		if (scope === 'admin') await this.maintain(now);
		else await this.maintainIfStale(now);
		const rows = await this.rowsBetween(from, to, today);
		const previousRows = await this.rowsBetween(shiftDay(from, -length), shiftDay(from, -1), today);

		const days = Array.from({ length }, (_, index) => {
			const date = shiftDay(from, index);
			const ofDay = rows.filter((row) => row.day === date);
			return { day: date, visits: sumOf(ofDay, 'visits'), visitors: sumOf(ofDay, 'visitors') };
		});
		const hidden = new Set<string>(scope === 'admin' ? [] : ADMIN_ONLY_BREAKDOWNS);
		const breakdown = Object.fromEntries(
			BREAKDOWNS.map((metric) => {
				const sums = new Map<string, number>();
				for (const row of rows) {
					if (hidden.has(metric)) continue;
					if (metric === 'referrerGroup' && row.metric === 'referrer') {
						const group = referrerGroup(row.key);
						sums.set(group, (sums.get(group) ?? 0) + row.value);
					} else if (row.metric === metric) sums.set(row.key, (sums.get(row.key) ?? 0) + row.value);
				}
				const list = [...sums]
					.map(([key, value]) => ({ key, value }))
					.sort((a, b) => b.value - a.value || a.key.localeCompare(b.key))
					.slice(0, 100);
				return [metric, list];
			})
		) as Summary['breakdown'];
		return { scope, from, to, days, totals: totalsOf(rows), previous: totalsOf(previousRows), breakdown };
	}

	/**
	 * 앱의 항목(메모의 글, Safari의 프로젝트)마다 전체 기간 조회수. 한 방문에서 같은 글을 여러 번 열어도 1.
	 * 누구나 본다 (블로그 글의 조회수). 1분 동안 같은 값을 준다
	 */
	async views(appInput: unknown, now = new Date()): Promise<{ app: string; views: Record<string, number> }> {
		const app = typeof appInput === 'string' && /^[a-z][a-z0-9-]{0,31}$/.test(appInput) ? appInput : null;
		if (!app) throw new BadRequestException('app이 올바르지 않습니다 (예: memo).');
		return this.cached(`views:${app}`, now, async () => {
			await this.maintainIfStale(now);
			const today = kstDay(now);
			const prefix = `${app}/`;
			const stored = await this.prisma.dailyStat.groupBy({
				by: ['key'],
				where: { metric: 'item', key: { startsWith: prefix }, day: { lt: today } },
				_sum: { value: true },
			});
			const views: Record<string, number> = {};
			for (const { key, _sum } of stored) views[key.slice(prefix.length)] = _sum.value ?? 0;
			const events = await this.prisma.analyticsEvent.findMany({ where: { day: today, type: 'item', app } });
			for (const row of aggregate(events)) {
				if (row.metric !== 'item' || !row.key.startsWith(prefix)) continue;
				const item = row.key.slice(prefix.length);
				views[item] = (views[item] ?? 0) + row.value;
			}
			return { app, views };
		});
	}

	/** 최근 방문 (실시간): 방문마다 나라·기기·들어온 곳과, 연 앱·본 글의 흐름 */
	async live(minutesInput: unknown, now = new Date()): Promise<LiveVisit[]> {
		const minutes = Math.min(Math.max(Number(minutesInput) || 30, 1), 24 * 60);
		const events = await this.prisma.analyticsEvent.findMany({
			where: { createdAt: { gte: new Date(now.getTime() - minutes * 60_000) } },
			orderBy: { createdAt: 'asc' },
			take: 5000,
		});
		const visits = new Map<string, LiveVisit>();
		for (const event of events) {
			const at = event.createdAt.toISOString();
			let visit = visits.get(event.visitId);
			if (!visit) {
				visit = {
					visitId: event.visitId,
					startedAt: at,
					lastAt: at,
					visitor: event.dayHash.slice(0, 4),
					country: event.country,
					device: event.device,
					browser: event.browser,
					os: event.os,
					referrer: event.referrer,
					path: event.path,
					ip: event.maskedIp,
					events: [],
				};
				visits.set(event.visitId, visit);
			}
			visit.lastAt = at;
			if (event.type === 'visit') {
				visit.device ??= event.device;
				visit.referrer ??= event.referrer;
				visit.path ??= event.path;
			}
			if (event.type !== 'leave') visit.events.push({ type: event.type, app: event.app, item: event.item, at });
		}
		return [...visits.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
	}
}
