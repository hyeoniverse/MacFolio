import { readFile } from 'node:fs/promises';
import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { sendResendMail } from '../common/resend.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
	cpuPercent,
	DAY_MS,
	hourly,
	memoryPercent,
	networkBytes,
	networkMbps,
	parseCpuTimes,
	reclaimRisk,
	RECLAIM_WINDOW_DAYS,
	type CpuTimes,
	type ReclaimRisk,
	type Sample,
} from './rules.js';

/** /proc 파일 읽기 (시험에서 바꿔 끼운다) */
export const PROC_READER = Symbol('PROC_READER');
export type ProcReader = (name: 'stat' | 'meminfo' | 'net/dev') => Promise<string>;
export const readProc: ProcReader = (name) => readFile(`/proc/${name}`, 'utf8');

const SAMPLE_MS = 60_000;
const MAINTAIN_MS = 60 * 60_000;
const KEEP_DAYS = 14;
/** 위험이 이어지면 이만큼 지나서 다시 알린다 */
const REALERT_MS = 3 * DAY_MS;

export interface ResourceStatus {
	mode: AppConfig['resources']['mode'];
	shape?: string;
	networkMbps?: number;
	latest?: Sample | null;
	/** 최근 7일, 한 시간 평균 */
	series?: ReturnType<typeof hourly>;
	/** 유휴 회수 위험 (free) */
	risk?: ReclaimRisk;
	alert?: { mailReady: boolean; lastSentAt: string | null };
}

/**
 * 서버 자원 감시 (RESOURCE_MONITOR). 1분마다 CPU·메모리·네트워크를 재어 남기고, 한 시간마다 오래된 표본을 지운다.
 * Always Free(free)면 유휴 회수 위험을 계산해 위험하면 메일로 알린다 (3일에 한 번까지)
 */
@Injectable()
export class ResourcesService implements OnModuleInit, OnModuleDestroy {
	private sampleTimer?: NodeJS.Timeout;
	private maintainTimer?: NodeJS.Timeout;
	private previous: { at: number; cpu: CpuTimes; network: number } | null = null;

	constructor(
		private readonly prisma: PrismaService,
		@Inject(APP_CONFIG) private readonly config: AppConfig,
		@Inject(PROC_READER) private readonly read: ProcReader
	) {}

	onModuleInit() {
		if (this.config.resources.mode === 'off') return;
		void this.sample().catch(() => undefined);
		this.sampleTimer = setInterval(() => void this.sample().catch(() => undefined), SAMPLE_MS);
		this.maintainTimer = setInterval(() => void this.maintain().catch(() => undefined), MAINTAIN_MS);
		this.sampleTimer.unref();
		this.maintainTimer.unref();
	}

	onModuleDestroy() {
		clearInterval(this.sampleTimer);
		clearInterval(this.maintainTimer);
	}

	/** 한 번 잰다. 처음 부를 때는 기준만 잡고 남기지 않는다 (사용률은 두 번 읽은 차이라서) */
	async sample(now = new Date()): Promise<Sample | null> {
		const [stat, meminfo, netdev] = await Promise.all([this.read('stat'), this.read('meminfo'), this.read('net/dev')]);
		const cpu = parseCpuTimes(stat);
		const memory = memoryPercent(meminfo);
		const network = networkBytes(netdev);
		if (!cpu || memory === null || network === null) return null;
		const previous = this.previous;
		this.previous = { at: now.getTime(), cpu, network };
		if (!previous) return null;
		const cpuUse = cpuPercent(previous.cpu, cpu);
		const mbps = networkMbps(previous.network, network, (now.getTime() - previous.at) / 1000);
		if (cpuUse === null || mbps === null) return null;
		const sample = { at: now, cpu: cpuUse, memory, network: mbps };
		await this.prisma.resourceSample.create({ data: sample });
		return sample;
	}

	private recent(now: Date) {
		return this.prisma.resourceSample.findMany({
			where: { at: { gte: new Date(now.getTime() - RECLAIM_WINDOW_DAYS * DAY_MS) } },
			select: { at: true, cpu: true, memory: true, network: true },
			orderBy: { at: 'asc' },
		});
	}

	private riskOf(samples: Sample[], now: Date) {
		const { shape, networkMbps: bandwidth } = this.config.resources;
		return reclaimRisk(samples, { shape, networkMbps: bandwidth, now });
	}

	private get mailReady() {
		const { resendApiKey, from } = this.config.contact;
		return Boolean(resendApiKey && from && this.config.resources.alertTo);
	}

	/** 오래된 표본을 지우고, Always Free면 위험을 보고 알린다 */
	async maintain(now = new Date()) {
		await this.prisma.resourceSample.deleteMany({
			where: { at: { lt: new Date(now.getTime() - KEEP_DAYS * DAY_MS) } },
		});
		if (this.config.resources.mode !== 'free') return;
		const risk = this.riskOf(await this.recent(now), now);
		if (risk.level === 'danger') await this.alertReclaim(risk, now);
	}

	/** 위험하면 메일로 알린다. 같은 알림은 3일에 한 번까지 (보낸 때는 DB에 남긴다) */
	private async alertReclaim(risk: ReclaimRisk, now: Date) {
		if (!this.mailReady) return false;
		const last = await this.prisma.resourceAlert.findUnique({ where: { kind: 'reclaim' } });
		if (last && now.getTime() - last.sentAt.getTime() < REALERT_MS) return false;
		const lines = risk.conditions.map(
			(condition) =>
				`- ${{ cpu: 'CPU', network: '네트워크', memory: '메모리' }[condition.metric]} (${condition.measure}): ${condition.value}% (기준 ${condition.threshold}% 미만이면 회수 대상)`
		);
		const text = [
			`MacFolio API 서버(${this.config.resources.shape})가 Oracle Always Free 유휴 회수 기준에 걸려 있습니다.`,
			`최근 ${risk.days}일 사용률:`,
			...lines,
			'',
			'Oracle은 7일 동안 이 기준에 모두 걸리면 서버를 회수할 수 있습니다.',
			'계정을 Pay As You Go로 올리면 회수 대상에서 빠집니다 (Always Free 한도 안에서는 그대로 0원). 방법은 docs/deployment.md의 "유휴 회수".',
			'',
			'자세한 사용률은 사이트의 "활동 상태 보기" → 서버 탭에서 봅니다.',
		].join('\n');
		const sent = await sendResendMail(this.config.contact, {
			to: this.config.resources.alertTo!,
			subject: '[MacFolio] 서버가 유휴 회수 기준에 걸려 있습니다',
			text,
		});
		if (!sent) return false;
		await this.prisma.resourceAlert.upsert({
			where: { kind: 'reclaim' },
			create: { kind: 'reclaim', sentAt: now, detail: lines.join(' ') },
			update: { sentAt: now, detail: lines.join(' ') },
		});
		return true;
	}

	/** 관리자 화면에 보일 것 */
	async status(now = new Date()): Promise<ResourceStatus> {
		const { mode, shape, networkMbps: bandwidth } = this.config.resources;
		if (mode === 'off') return { mode };
		const samples = await this.recent(now);
		const last = await this.prisma.resourceAlert.findUnique({ where: { kind: 'reclaim' } });
		return {
			mode,
			shape,
			networkMbps: bandwidth,
			latest: samples.at(-1) ?? null,
			series: hourly(samples),
			...(mode === 'free' && { risk: this.riskOf(samples, now) }),
			alert: { mailReady: this.mailReady, lastSentAt: last?.sentAt.toISOString() ?? null },
		};
	}
}
