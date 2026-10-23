import { BadRequestException, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { countryOf, dayHash, isBot, kstDay, maskIp, parseBatch, parseUserAgent } from './rules.js';

/** 받은 요청의 사정 (컨트롤러가 채운다) */
export interface Sender {
	ip: string;
	userAgent: string | undefined;
	country: string | string[] | undefined;
	/** 관리자 세션이 있거나 관리자가 쓰는 IP다 (세지 않는다) */
	admin: boolean;
}

/** IP마다 1분에 받는 묶음 수 (사이트는 5초마다 보낸다) */
const BATCHES_PER_MINUTE = 30;

/**
 * 저장: 사이트가 보낸 이벤트 묶음을 받아 둔다 (#102).
 * 순방문자는 하루 해시로 센다. 원래 IP와 쿠키는 쓰지 않는다
 */
@Injectable()
export class AnalyticsRecorder {
	private readonly batches = new Map<string, { windowStart: number; count: number }>();

	constructor(
		private readonly prisma: PrismaService,
		@Inject(APP_CONFIG) private readonly config: AppConfig
	) {}

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
}
