import {
	BadGatewayException,
	BadRequestException,
	HttpException,
	HttpStatus,
	Inject,
	Injectable,
	ServiceUnavailableException,
} from '@nestjs/common';
import { hashIp } from '../comments/rules.js';
import { DailyQuota } from '../common/demo.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { buildEmail, parseContact } from './rules.js';

const RESEND_URL = 'https://api.resend.com/emails';
const TURNSTILE_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 10_000;

/**
 * 메일 앱의 연락 메일 (#25). 받는 사람은 늘 사이트 주인 한 명이고, 보낸 사람의 주소는 Reply-To로 넣어 바로 답장한다.
 * Resend(HTTPS API)로 보낸다: 서버의 메일 포트가 막혀 있어도 된다
 */
@Injectable()
export class ContactService {
	private readonly quota: DailyQuota;

	constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
		this.quota = new DailyQuota(config.contact.perIpPerDay, config.contact.totalPerDay);
	}

	private get enabled() {
		const { resendApiKey, to, from } = this.config.contact;
		return Boolean(resendApiKey && to && from);
	}

	/** 사이트가 쓸 설정: 서버에서 보낼 수 있는지, 사람 확인(Turnstile)에 쓸 사이트 키 */
	status() {
		return {
			enabled: this.enabled,
			turnstileSiteKey: (this.enabled && this.config.contact.turnstileSiteKey) || null,
		};
	}

	/** Turnstile 토큰이 이 사이트에서 사람이 받은 것인지 Cloudflare에 묻는다 */
	private async human(token: string | undefined, ip: string) {
		const secret = this.config.contact.turnstileSecretKey;
		if (!secret) return true;
		if (!token) return false;
		try {
			const response = await fetch(TURNSTILE_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ secret, response: token, remoteip: ip || undefined }),
				signal: AbortSignal.timeout(TIMEOUT_MS),
			});
			const result = (await response.json()) as { success?: boolean };
			return result.success === true;
		} catch {
			return false;
		}
	}

	async send(input: unknown, ip: string): Promise<{ status: 'sent' }> {
		if (!this.enabled) throw new ServiceUnavailableException('메일 발송이 설정되지 않았습니다.');
		const parsed = parseContact(input);
		if ('errors' in parsed) throw new BadRequestException(parsed.errors);
		if (!(await this.human(parsed.token, ip)))
			throw new BadRequestException('사람인지 확인하지 못했습니다. 다시 시도해 주세요.');

		const key = hashIp(ip, this.config.ipHashSecret);
		if (!this.quota.take(key))
			throw new HttpException('오늘은 더 보낼 수 없습니다. 내일 다시 보내 주세요.', HttpStatus.TOO_MANY_REQUESTS);

		const { subject, text } = buildEmail(parsed.value);
		const { resendApiKey, to, from } = this.config.contact;
		try {
			const response = await fetch(RESEND_URL, {
				method: 'POST',
				headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ from, to: [to], reply_to: parsed.value.email, subject, text }),
				signal: AbortSignal.timeout(TIMEOUT_MS),
			});
			if (!response.ok) throw new Error(`Resend ${response.status}`);
		} catch {
			// 보내지 못했으면 쓴 횟수를 돌려준다
			this.quota.refund(key);
			throw new BadGatewayException('메일을 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
		}
		return { status: 'sent' };
	}
}
