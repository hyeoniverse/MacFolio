import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { verifyTurnstile } from '../common/turnstile.js';
import type { AdminIdentity } from '../auth/auth.service.js';
import { DEFAULT_SETTINGS, parseSecurityUpdate, type HumanCheck, type SecuritySettings } from './rules.js';

/** 사이트가 읽는 보안 설정 */
export interface SecurityView extends SecuritySettings {
	/** 서버에 Turnstile 키(사이트·비밀)가 둘 다 있는지. 없으면 켜도 확인하지 않는다 */
	available: boolean;
	/** 화면에 위젯을 그릴 사이트 키 (키가 없으면 null) */
	turnstileSiteKey: string | null;
	updatedAt: string | null;
}

/**
 * 사람 확인(Cloudflare Turnstile)을 어디에 걸지: 메일·댓글·메시지마다 관리자가 켜고 끈다 (시스템 설정의 '개인정보 보호 및 보안').
 * 설정은 한 줄짜리 표(SecuritySetting)에 두고, 쓰기마다 DB를 읽지 않게 메모리에 들고 있다 (바꾸면 새로 읽는다).
 * 관리자가 쓰는 글은 확인하지 않는다
 */
@Injectable()
export class SecurityService {
	private cache: Promise<{ settings: SecuritySettings; updatedAt: Date | null }> | null = null;

	constructor(
		private readonly prisma: PrismaService,
		@Inject(APP_CONFIG) private readonly config: AppConfig
	) {}

	/** 사이트·비밀 키가 둘 다 있어야 확인할 수 있다 */
	private get keys() {
		const { turnstileSiteKey, turnstileSecretKey } = this.config.contact;
		return turnstileSiteKey && turnstileSecretKey ? { site: turnstileSiteKey, secret: turnstileSecretKey } : null;
	}

	private load() {
		this.cache ??= this.prisma.securitySetting.findUnique({ where: { id: 1 } }).then((row) => ({
			settings: row
				? { contact: row.contactHuman, comment: row.commentHuman, message: row.messageHuman }
				: DEFAULT_SETTINGS,
			updatedAt: row?.updatedAt ?? null,
		}));
		// 읽지 못했으면 다음에 다시 읽는다
		this.cache.catch(() => (this.cache = null));
		return this.cache;
	}

	async view(): Promise<SecurityView> {
		const { settings, updatedAt } = await this.load();
		const keys = this.keys;
		return {
			...settings,
			available: keys !== null,
			turnstileSiteKey: keys?.site ?? null,
			updatedAt: updatedAt?.toISOString() ?? null,
		};
	}

	/** 관리자가 켜고 끈다. 보낸 것만 바꾼다 */
	async update(input: unknown, login: string): Promise<SecurityView> {
		const parsed = parseSecurityUpdate(input);
		if ('errors' in parsed) throw new BadRequestException(parsed.errors);
		const { contact, comment, message } = parsed.value;
		const data = { contactHuman: contact, commentHuman: comment, messageHuman: message, updatedBy: login };
		await this.prisma.securitySetting.upsert({
			where: { id: 1 },
			create: {
				id: 1,
				contactHuman: contact ?? DEFAULT_SETTINGS.contact,
				commentHuman: comment ?? DEFAULT_SETTINGS.comment,
				messageHuman: message ?? DEFAULT_SETTINGS.message,
				updatedBy: login,
			},
			update: data,
		});
		this.cache = null;
		return this.view();
	}

	/** 이곳에 사람 확인이 켜져 있고 키가 있으면, 화면이 그릴 사이트 키 (아니면 null) */
	async siteKeyFor(check: HumanCheck): Promise<string | null> {
		const { settings } = await this.load();
		return settings[check] ? (this.keys?.site ?? null) : null;
	}

	/**
	 * 쓰기 전에 부른다. 켜져 있고 키가 있으면 토큰을 Cloudflare에 확인해, 사람이 아니면 400.
	 * 관리자는 확인하지 않는다
	 */
	async requireHuman(check: HumanCheck, token: string | undefined, ip: string, admin: AdminIdentity | null = null) {
		if (admin) return;
		const keys = this.keys;
		if (!keys) return;
		const { settings } = await this.load();
		if (!settings[check]) return;
		if (!(await verifyTurnstile(keys.secret, token, ip)))
			throw new BadRequestException('사람인지 확인하지 못했습니다. 다시 시도해 주세요.');
	}
}
