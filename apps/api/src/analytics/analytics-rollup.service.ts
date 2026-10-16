import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { aggregate, EVENT_RETENTION_DAYS, IP_RETENTION_DAYS, kstDay, shiftDay, type StatRow } from './rules.js';

const HOUR = 60 * 60 * 1000;
/** 요약을 열 때 지난 날을 모으는 일을 다시 하는 간격 */
const MAINTAIN_GAP_MS = 5 * 60_000;

/**
 * 집계: 지난 날의 이벤트를 DailyStat으로 모으고, 오래된 이벤트와 가린 IP를 지운다 (#102).
 * 조회(AnalyticsStats)는 여기서 기간의 행을 받아 쓴다
 */
@Injectable()
export class AnalyticsRollup implements OnModuleInit, OnModuleDestroy {
	private timer?: NodeJS.Timeout;
	private maintainedAt = 0;

	constructor(private readonly prisma: PrismaService) {}

	onModuleInit() {
		// 한 시간마다 지난 날을 모으고 오래된 것을 지운다 (서버 한 대라 따로 작업 도구를 두지 않는다)
		this.timer = setInterval(() => void this.maintain().catch(() => undefined), HOUR);
		this.timer.unref();
	}

	onModuleDestroy() {
		clearInterval(this.timer);
	}

	/** 지난 날 모으기를 5분에 한 번만 (날이 바뀌었으면 바로). 요약·조회수를 열 때 부른다 */
	async maintainIfStale(now: Date) {
		const sameDay = kstDay(new Date(this.maintainedAt)) === kstDay(now);
		if (!sameDay || now.getTime() - this.maintainedAt > MAINTAIN_GAP_MS) await this.maintain(now);
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
	async rowsBetween(from: string, to: string, today: string): Promise<(StatRow & { day: string })[]> {
		const stored = await this.prisma.dailyStat.findMany({
			where: { day: { gte: from, lte: to < today ? to : shiftDay(today, -1) } },
		});
		if (to < today || from > today) return stored;
		const events = await this.prisma.analyticsEvent.findMany({ where: { day: today } });
		return [...stored, ...aggregate(events).map((row) => ({ ...row, day: today }))];
	}
}
