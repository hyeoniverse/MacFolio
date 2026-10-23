import { createHmac } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** 관리자가 쓰는 IP를 기억하는 기간: 마지막으로 관리자 요청이 온 뒤로 */
export const ADMIN_IP_DAYS = 30;
/** 같은 IP를 다시 적는 간격 (관리자 요청마다 DB에 쓰지 않게) */
const TOUCH_MS = 10 * 60_000;
/** 방문을 받을 때 쓰는 목록을 DB에서 다시 읽는 간격 */
const CACHE_MS = 60_000;
const DAY_MS = 24 * 60 * 60_000;

/**
 * 관리자가 쓰는 IP. 관리자로 인증된 요청(AdminGuard, 로그인)의 IP를 HMAC으로만 적어 두고,
 * 방문 기록(활동 상태 보기)은 그 IP에서 온 것을 세지 않는다. 휴대폰처럼 로그인하지 않은 기기로 둘러봐도 빠진다
 */
@Injectable()
export class AdminIpService {
	private readonly touched = new Map<string, number>();
	private cache: { at: number; hashes: Set<string> } | null = null;

	constructor(
		private readonly prisma: PrismaService,
		@Inject(APP_CONFIG) private readonly config: AppConfig
	) {}

	private hash(ip: string) {
		return createHmac('sha256', this.config.ipHashSecret).update(`admin-ip:${ip}`).digest('hex');
	}

	/** 관리자가 이 IP를 쓴다고 적는다 (같은 IP는 TOUCH_MS마다 한 번) */
	async remember(ip: string, now = new Date()) {
		if (!ip) return;
		const ipHash = this.hash(ip);
		const last = this.touched.get(ipHash);
		if (last !== undefined && now.getTime() - last < TOUCH_MS) return;
		this.touched.set(ipHash, now.getTime());
		await this.prisma.adminIp.upsert({
			where: { ipHash },
			create: { ipHash, lastSeenAt: now },
			update: { lastSeenAt: now },
		});
		this.cache?.hashes.add(ipHash);
	}

	/** 최근 ADMIN_IP_DAYS일 안에 관리자가 쓴 IP인가. 오래된 것은 읽을 때 지운다 */
	async isAdminIp(ip: string, now = new Date()): Promise<boolean> {
		if (!ip) return false;
		if (!this.cache || now.getTime() - this.cache.at > CACHE_MS) {
			const since = new Date(now.getTime() - ADMIN_IP_DAYS * DAY_MS);
			await this.prisma.adminIp.deleteMany({ where: { lastSeenAt: { lt: since } } });
			const rows = await this.prisma.adminIp.findMany({ select: { ipHash: true } });
			this.cache = { at: now.getTime(), hashes: new Set(rows.map((row) => row.ipHash)) };
		}
		return this.cache.hashes.has(this.hash(ip));
	}

	/** 메모리에 둔 것을 비운다 (다음에 DB에서 다시 읽는다) */
	reset() {
		this.touched.clear();
		this.cache = null;
	}
}
