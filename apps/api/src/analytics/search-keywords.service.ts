import { BadRequestException, Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { SearchKeywords } from '@macfolio/contracts';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { kstDay, MAX_RANGE_DAYS, rangeOf, shiftDay } from './rules.js';
import { fetchSearchQueries, SearchConsoleError } from './search-console.js';

const HOUR = 60 * 60 * 1000;
/** 가져오는 간격. Search Console은 하루에 한두 번 새 자료를 낸다 */
const SYNC_EVERY_MS = 6 * HOUR;
/** 서버가 뜬 뒤 처음 가져오기까지 (배포 직후 몰리지 않게) */
const FIRST_SYNC_MS = 60_000;
/** 처음 가져올 때 거슬러 올라가는 날 (Search Console은 16개월을 둔다) */
const BACKFILL_DAYS = 480;
/** 다음부터는 마지막 날의 며칠 전부터 다시 받는다: 최근 자료는 확정되며 바뀐다 */
const REFRESH_DAYS = 7;
/** 한 번에 넣는 행 수 */
const INSERT_CHUNK = 5000;
/** 화면에 주는 (검색어, 페이지) 줄의 상한 */
const MAX_ROWS = 1000;

/**
 * 검색어 (관리자): Google Search Console에서 날짜·검색어·페이지별 클릭·노출·순위를 날마다 가져와 두고 기간으로 묶어 준다.
 * 구글·빙은 검색어를 사이트에 넘기지 않아 사이트의 수집(searchTerm)으로는 볼 수 없다. 서비스 계정이 없으면 꺼진다
 */
@Injectable()
export class SearchKeywordsService implements OnModuleInit, OnModuleDestroy {
	private timers: NodeJS.Timeout[] = [];
	private running: Promise<void> | null = null;
	private last: { at: Date; error: string | null } | null = null;

	constructor(
		private readonly prisma: PrismaService,
		@Inject(APP_CONFIG) private readonly config: AppConfig
	) {}

	onModuleInit() {
		if (!this.config.searchConsole) return;
		const sync = () => void this.sync().catch(() => undefined);
		this.timers = [setTimeout(sync, FIRST_SYNC_MS), setInterval(sync, SYNC_EVERY_MS)];
		for (const timer of this.timers) timer.unref();
	}

	onModuleDestroy() {
		for (const timer of this.timers) clearTimeout(timer);
	}

	/** 지금 가져온다. 이미 가져오는 중이면 그것을 기다린다 */
	sync(now = new Date()): Promise<void> {
		this.running ??= this.run(now).finally(() => {
			this.running = null;
		});
		return this.running;
	}

	/**
	 * 처음에는 16개월을, 다음부터는 가져 둔 마지막 날의 7일 전부터 어제까지를 받아 그 날들을 갈아 끼운다.
	 * 실패하면 이유를 남겨 화면에 보인다 (가져 둔 자료는 그대로)
	 */
	private async run(now: Date) {
		const credentials = this.config.searchConsole;
		if (!credentials) return;
		const to = shiftDay(kstDay(now), -1);
		const latest = await this.prisma.searchQueryStat.findFirst({ orderBy: { day: 'desc' }, select: { day: true } });
		const from = latest ? shiftDay(latest.day < to ? latest.day : to, -REFRESH_DAYS) : shiftDay(to, -BACKFILL_DAYS);
		try {
			const rows = await fetchSearchQueries(credentials, { from, to }, now);
			await this.prisma.$transaction(async (tx) => {
				await tx.searchQueryStat.deleteMany({ where: { day: { gte: from, lte: to } } });
				for (let start = 0; start < rows.length; start += INSERT_CHUNK)
					await tx.searchQueryStat.createMany({ data: rows.slice(start, start + INSERT_CHUNK), skipDuplicates: true });
			});
			this.last = { at: now, error: null };
		} catch (error) {
			this.last = {
				at: now,
				error: error instanceof SearchConsoleError ? error.message : 'Search Console 자료를 저장하지 못했습니다.',
			};
		}
	}

	/** 기간의 (검색어, 페이지)마다 클릭·노출 합과 노출로 가중한 평균 순위. 노출 많은 순으로 1000줄까지 */
	async keywords(fromInput: unknown, toInput: unknown, now = new Date()): Promise<SearchKeywords> {
		const range = rangeOf(fromInput, toInput, kstDay(now));
		if (!range) throw new BadRequestException(`기간은 1~${MAX_RANGE_DAYS}일입니다 (from ≤ to).`);
		const { from, to } = range;
		const configured = Boolean(this.config.searchConsole);
		const rows = configured
			? await this.prisma.$queryRaw<
					{ query: string; page: string; clicks: number; impressions: number; position: number }[]
				>`
					SELECT "query", "page",
						SUM("clicks")::int AS "clicks",
						SUM("impressions")::int AS "impressions",
						COALESCE(SUM("position" * "impressions") / NULLIF(SUM("impressions"), 0), AVG("position"))::float8 AS "position"
					FROM "SearchQueryStat"
					WHERE "day" >= ${from} AND "day" <= ${to}
					GROUP BY "query", "page"
					ORDER BY "impressions" DESC, "clicks" DESC, "query" ASC
					LIMIT ${MAX_ROWS}`
			: [];
		const latest = configured
			? await this.prisma.searchQueryStat.findFirst({ orderBy: { day: 'desc' }, select: { day: true } })
			: null;
		return {
			configured,
			from,
			to,
			syncedAt: this.last?.at.toISOString() ?? null,
			error: this.last?.error ?? null,
			latestDay: latest?.day ?? null,
			rows: rows.map((row) => ({ ...row, position: Math.round(row.position * 10) / 10 })),
		};
	}
}
