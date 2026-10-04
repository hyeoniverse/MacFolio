import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { hashIp } from '../comments/rules.js';
import { DailyQuota, DemoInputError, failureLine, tryInOrder } from '../common/demo.js';
import { TranslateClient } from './translate.client.js';
import { parseTranslateRequest, TRANSLATE_PROVIDERS } from './rules.js';

const NAMES = { deepl: 'DeepL', google: 'Google' };

/**
 * 번역 데모 (HYEONIVERSE 편집기의 자동 번역을 실제로). 누구나 쓰지만 하루 상한이 있다.
 * 막아 둔 공급자는 건너뛰고, 실패하면 다음 공급자로 넘어간다. 모두 실패하면 쓴 횟수를 돌려준다
 */
@Injectable()
export class TranslateService {
	private readonly logger = new Logger(TranslateService.name);
	private readonly quota: DailyQuota;

	constructor(
		@Inject(APP_CONFIG) private readonly config: AppConfig,
		private readonly client: TranslateClient
	) {
		this.quota = new DailyQuota(config.translate.perIpPerDay, config.translate.totalPerDay);
	}

	private ipHash(ip: string) {
		return hashIp(ip, this.config.ipHashSecret);
	}

	status(ip: string) {
		return { remaining: this.quota.remaining(this.ipHash(ip)), ...this.quota.limits };
	}

	async translate(body: unknown, ip: string) {
		let request;
		try {
			request = parseTranslateRequest(body);
		} catch (error) {
			if (error instanceof DemoInputError) throw new BadRequestException(error.message);
			throw error;
		}
		const key = this.ipHash(ip);
		if (!this.quota.take(key)) {
			throw new HttpException(
				{ message: '오늘 번역할 수 있는 횟수를 다 썼습니다. 내일 다시 들러 주세요.', ...this.status(ip) },
				HttpStatus.TOO_MANY_REQUESTS
			);
		}

		const keys = { deepl: this.config.translate.deeplApiKey, google: this.config.translate.googleTranslateApiKey };
		const { attempts, provider, value } = await tryInOrder(
			TRANSLATE_PROVIDERS,
			request.skip,
			(name) => this.client.translate(name, keys, request.texts, request.from, request.to),
			(message) => this.logger.warn(message)
		);
		if (provider && value) return { provider, attempts, texts: value, remaining: this.quota.remaining(key) };

		this.quota.refund(key);
		throw new HttpException(
			{
				message: `두 곳 모두 번역하지 못했습니다 (${failureLine(attempts, NAMES)}).`,
				attempts,
				remaining: this.quota.remaining(key),
			},
			HttpStatus.BAD_GATEWAY
		);
	}
}
