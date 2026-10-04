import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { hashIp } from '../comments/rules.js';
import { ProviderFailure, SpeechClient } from './speech.client.js';
import { DailyQuota, parseSpeechRequest, SpeechInputError, speechOrder, type SpeechProvider } from './rules.js';

/** 공급자 하나를 시도한 결과 (화면이 차례대로 그린다) */
export interface SpeechAttempt {
	provider: SpeechProvider;
	state: 'ok' | 'fail' | 'skip';
	reason?: string;
}

/**
 * 음성 만들기 데모 (HYEONIVERSE 갤러리 음성의 대체 순서를 실제로). 누구나 쓰지만 하루 상한이 있다.
 * 막아 둔 공급자는 건너뛰고, 실패하면 다음 공급자로 넘어간다. 모두 실패하면 쓴 횟수를 돌려준다
 */
@Injectable()
export class SpeechService {
	private readonly logger = new Logger(SpeechService.name);
	private readonly quota: DailyQuota;

	constructor(
		@Inject(APP_CONFIG) private readonly config: AppConfig,
		private readonly client: SpeechClient
	) {
		this.quota = new DailyQuota(config.speech.perIpPerDay, config.speech.totalPerDay);
	}

	private ipHash(ip: string) {
		return hashIp(ip, this.config.ipHashSecret);
	}

	status(ip: string) {
		return { remaining: this.quota.remaining(this.ipHash(ip)), ...this.quota.limits };
	}

	async synthesize(body: unknown, ip: string) {
		let request;
		try {
			request = parseSpeechRequest(body);
		} catch (error) {
			if (error instanceof SpeechInputError) throw new BadRequestException(error.message);
			throw error;
		}
		const key = this.ipHash(ip);
		if (!this.quota.take(key)) {
			throw new HttpException(
				{ message: '오늘 만들 수 있는 횟수를 다 썼습니다. 내일 다시 들러 주세요.', ...this.status(ip) },
				HttpStatus.TOO_MANY_REQUESTS
			);
		}

		const attempts: SpeechAttempt[] = [];
		const keys = { fish: this.config.speech.fishAudioApiKey, google: this.config.speech.googleTtsApiKey };
		for (const { provider, skipped } of speechOrder(request.skip)) {
			if (skipped) {
				attempts.push({ provider, state: 'skip', reason: '막아 둠' });
				continue;
			}
			try {
				const audio = await this.client.synthesize(provider, keys, request.text, request.lang);
				if (!audio.length) throw new ProviderFailure('빈 음성');
				attempts.push({ provider, state: 'ok' });
				return {
					provider,
					attempts,
					audio: audio.toString('base64'),
					remaining: this.quota.remaining(key),
				};
			} catch (error) {
				const reason = error instanceof ProviderFailure ? error.message : '연결하지 못했습니다';
				if (!(error instanceof ProviderFailure)) this.logger.warn(`${provider}: ${String(error)}`);
				attempts.push({ provider, state: 'fail', reason });
			}
		}

		this.quota.refund(key);
		throw new HttpException(
			{ message: '세 곳 모두 만들지 못했습니다.', attempts, remaining: this.quota.remaining(key) },
			HttpStatus.BAD_GATEWAY
		);
	}
}
