import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AnalyticsRollup } from './analytics-rollup.service.js';
import { aggregate, kstDay, MAX_RANGE_DAYS, rangeOf, referrerGroup, shiftDay, type StatRow } from './rules.js';
import {
	ADMIN_ONLY_BREAKDOWNS,
	APP_NAME,
	BREAKDOWNS,
	type AppViews,
	type LiveVisit as ContractLiveVisit,
	type Summary as ContractSummary,
	type TodayVisitors,
	type Totals as ContractTotals,
	UTM_FILTER_MAX,
} from '@macfolio/contracts';

/** 요약에 싣는 표와 응답 모양은 @macfolio/contracts (활동 상태 보기 화면과 같은 스키마) */
export { ADMIN_ONLY_BREAKDOWNS, BREAKDOWNS };
export type Totals = ContractTotals;
export type Summary = ContractSummary;
export type LiveVisit = ContractLiveVisit;

/** "오늘 방문자"를 다시 세는 간격 */
const TODAY_CACHE_MS = 60_000;
/** 방문자용 요약과 조회수를 다시 계산하는 간격 (누구나 부르는 경로라 DB를 매번 읽지 않는다) */
const PUBLIC_CACHE_MS = 60_000;

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
 * 조회: 오늘 방문자·요약·조회수(누구나)와 최근 방문(관리자) (#102).
 * 누구나 부르는 값은 1분 동안 같은 값을 준다
 */
@Injectable()
export class AnalyticsStats {
	private today?: { day: string; visitors: number; at: number };
	private readonly publicCache = new Map<string, { at: number; value: unknown }>();

	constructor(
		private readonly prisma: PrismaService,
		private readonly rollup: AnalyticsRollup
	) {}

	/** 방문자에게 주는 값: 같은 질문이면 1분 동안 같은 값 */
	private async cached<T>(key: string, now: Date, compute: () => Promise<T>): Promise<T> {
		const hit = this.publicCache.get(key);
		if (hit && now.getTime() - hit.at < PUBLIC_CACHE_MS) return hit.value as T;
		const value = await compute();
		if (this.publicCache.size > 500) this.publicCache.clear();
		this.publicCache.set(key, { at: now.getTime(), value });
		return value;
	}

	/** 오늘(한국 시간) 순방문자 수. 방문자에게 공개하는 숫자라 1분 동안 같은 값을 준다 */
	async todayVisitors(now = new Date()): Promise<TodayVisitors> {
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
	 * 요약: 일별 방문, 합계(앞 기간과 비교), 지표별 표. 관리자가 아니면 들어온 곳의 호스트와 utm을 빼고,
	 * 같은 기간이면 1분 동안 같은 값을 준다.
	 * utm(출처·매체·캠페인 조합 키)을 주면 관리자에게만 그 조합의 일별 방문(utmTrend)을 더한다. 방문자에게는 무시한다
	 */
	async summary(
		fromInput: unknown,
		toInput: unknown,
		admin: boolean,
		now = new Date(),
		utmInput?: unknown
	): Promise<Summary> {
		if (utmInput !== undefined && (typeof utmInput !== 'string' || !utmInput || utmInput.length > UTM_FILTER_MAX))
			throw new BadRequestException(`utm은 ${UTM_FILTER_MAX}자 이하의 조합 키입니다.`);
		const today = kstDay(now);
		const range = rangeOf(fromInput, toInput, today);
		if (!range) throw new BadRequestException(`기간은 1~${MAX_RANGE_DAYS}일입니다 (from ≤ to).`);
		const { from, to, length } = range;
		if (admin) return this.computeSummary(from, to, length, today, 'admin', now, utmInput);
		return this.cached(`summary:${from}:${to}`, now, () => this.computeSummary(from, to, length, today, 'public', now));
	}

	private async computeSummary(
		from: string,
		to: string,
		length: number,
		today: string,
		scope: Summary['scope'],
		now: Date,
		utm?: string
	): Promise<Summary> {
		// 관리자는 열 때마다 모은다 (드물게 연다). 방문자는 5분에 한 번
		if (scope === 'admin') await this.rollup.maintain(now);
		else await this.rollup.maintainIfStale(now);
		const rows = await this.rollup.rowsBetween(from, to, today);
		const previousRows = await this.rollup.rowsBetween(shiftDay(from, -length), shiftDay(from, -1), today);

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
		const summary: Summary = {
			scope,
			from,
			to,
			days,
			totals: totalsOf(rows),
			previous: totalsOf(previousRows),
			breakdown,
		};
		// 조합 하나의 일별 방문: utm 지표의 그 키를 날마다 (관리자만)
		if (scope === 'admin' && utm)
			summary.utmTrend = {
				key: utm,
				days: days.map(({ day }) => ({
					day,
					visits: rows
						.filter((row) => row.day === day && row.metric === 'utm' && row.key === utm)
						.reduce((sum, row) => sum + row.value, 0),
				})),
			};
		return summary;
	}

	/**
	 * 앱의 항목(메모의 글, Safari의 프로젝트)마다 전체 기간 조회수. 한 방문에서 같은 글을 여러 번 열어도 1.
	 * 누구나 본다 (블로그 글의 조회수). 1분 동안 같은 값을 준다
	 */
	async views(appInput: unknown, now = new Date()): Promise<AppViews> {
		const app = typeof appInput === 'string' && APP_NAME.test(appInput) ? appInput : null;
		if (!app) throw new BadRequestException('app이 올바르지 않습니다 (예: memo).');
		return this.cached(`views:${app}`, now, async () => {
			await this.rollup.maintainIfStale(now);
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
