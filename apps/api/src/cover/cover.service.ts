import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { hashIp } from '../comments/rules.js';
import { DailyQuota, DemoInputError, failureLine, tryInOrder } from '../common/demo.js';
import { CoverClient } from './cover.client.js';
import { COVER_PROVIDERS, coverPrompt, parseCoverRequest } from './rules.js';

const NAMES = { huggingface: 'Hugging Face' };

/**
 * AI 커버 데모 (HYEONIVERSE 커버 선택창의 AI 생성을 실제로). 누구나 쓰지만 하루 상한이 있고, 그림은 비싸서 전체 상한이 낮다.
 * 그리지 못하면 쓴 횟수를 돌려준다. 그림은 저장하지 않는다
 */
@Injectable()
export class CoverService {
	private readonly logger = new Logger(CoverService.name);
	private readonly quota: DailyQuota;

	constructor(
		@Inject(APP_CONFIG) private readonly config: AppConfig,
		private readonly client: CoverClient
	) {
		this.quota = new DailyQuota(config.cover.perIpPerDay, config.cover.totalPerDay);
	}

	private ipHash(ip: string) {
		return hashIp(ip, this.config.ipHashSecret);
	}

	status(ip: string) {
		return { remaining: this.quota.remaining(this.ipHash(ip)), ...this.quota.limits };
	}

	async generate(body: unknown, ip: string) {
		let request;
		try {
			request = parseCoverRequest(body);
		} catch (error) {
			if (error instanceof DemoInputError) throw new BadRequestException(error.message);
			throw error;
		}
		const key = this.ipHash(ip);
		if (!this.quota.take(key)) {
			throw new HttpException(
				{ message: '오늘 그릴 수 있는 횟수를 다 썼습니다. 내일 다시 들러 주세요.', ...this.status(ip) },
				HttpStatus.TOO_MANY_REQUESTS
			);
		}

		const keys = { huggingface: this.config.cover.huggingfaceApiKey };
		const prompt = coverPrompt(request);
		const { attempts, provider, value } = await tryInOrder(
			COVER_PROVIDERS,
			request.skip,
			(name) => this.client.generate(name, keys, prompt),
			(message) => this.logger.warn(message)
		);
		if (provider && value) {
			return {
				provider,
				attempts,
				image: value.bytes.toString('base64'),
				mime: value.mime,
				remaining: this.quota.remaining(key),
			};
		}

		this.quota.refund(key);
		throw new HttpException(
			{
				message: `그리지 못했습니다 (${failureLine(attempts, NAMES)}).`,
				attempts,
				remaining: this.quota.remaining(key),
			},
			HttpStatus.BAD_GATEWAY
		);
	}
}
