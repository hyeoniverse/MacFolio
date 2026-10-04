import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { hashIp } from '../comments/rules.js';
import { DailyQuota, DemoInputError, failureLine, tryInOrder } from '../common/demo.js';
import { SummaryClient } from './summary.client.js';
import { parseSummaryRequest } from './rules.js';

/**
 * AI 요약 데모 (HYEONIVERSE가 발행할 때 붙이는 두 언어 요약을 실제로). 누구나 쓰지만 하루 상한이 있다.
 * 만들지 못하면 쓴 횟수를 돌려준다
 */
@Injectable()
export class SummaryService {
	private readonly logger = new Logger(SummaryService.name);
	private readonly quota: DailyQuota;

	constructor(
		@Inject(APP_CONFIG) private readonly config: AppConfig,
		private readonly client: SummaryClient
	) {
		this.quota = new DailyQuota(config.summary.perIpPerDay, config.summary.totalPerDay);
	}

	private ipHash(ip: string) {
		return hashIp(ip, this.config.ipHashSecret);
	}

	status(ip: string) {
		return { remaining: this.quota.remaining(this.ipHash(ip)), ...this.quota.limits };
	}

	async summarize(body: unknown, ip: string) {
		let request;
		try {
			request = parseSummaryRequest(body);
		} catch (error) {
			if (error instanceof DemoInputError) throw new BadRequestException(error.message);
			throw error;
		}
		const key = this.ipHash(ip);
		if (!this.quota.take(key)) {
			throw new HttpException(
				{ message: '오늘 요약할 수 있는 횟수를 다 썼습니다. 내일 다시 들러 주세요.', ...this.status(ip) },
				HttpStatus.TOO_MANY_REQUESTS
			);
		}

		const { geminiApiKey, geminiModel } = this.config.summary;
		const { attempts, provider, value } = await tryInOrder(
			['gemini'] as const,
			[],
			() => this.client.gemini(geminiApiKey, geminiModel, request.text),
			(message) => this.logger.warn(message)
		);
		if (provider && value) return { provider, ...value, remaining: this.quota.remaining(key) };

		this.quota.refund(key);
		throw new HttpException(
			{
				message: `요약을 만들지 못했습니다 (${failureLine(attempts, { gemini: 'Gemini' })}).`,
				attempts,
				remaining: this.quota.remaining(key),
			},
			HttpStatus.BAD_GATEWAY
		);
	}
}
