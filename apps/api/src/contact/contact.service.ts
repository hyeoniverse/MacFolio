import {
	BadGatewayException,
	BadRequestException,
	HttpException,
	HttpStatus,
	Inject,
	Injectable,
	NotFoundException,
	ServiceUnavailableException,
} from '@nestjs/common';
import { hashIp } from '../comments/rules.js';
import { DailyQuota } from '../common/demo.js';
import { sendResendMail } from '../common/resend.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Visitor } from '../visitors/visitors.service.js';
import { buildEmail, buildReply, parseContact, parseReply } from './rules.js';

const TURNSTILE_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 10_000;
/** 받은 메일을 두는 기간 */
const RETENTION_MS = 365 * 24 * 60 * 60 * 1000;

/** 밖으로 내보내는 메일. 방문자 HMAC은 담지 않는다 */
export interface ContactMailView {
	id: string;
	name: string;
	email: string;
	subject: string;
	body: string;
	createdAt: string;
	replies: { id: string; body: string; createdAt: string }[];
}

const INCLUDE = { replies: { orderBy: { createdAt: 'asc' as const } } };

const toView = (mail: {
	id: string;
	name: string;
	email: string;
	subject: string;
	body: string;
	createdAt: Date;
	replies: { id: string; body: string; createdAt: Date }[];
}): ContactMailView => ({
	id: mail.id,
	name: mail.name,
	email: mail.email,
	subject: mail.subject,
	body: mail.body,
	createdAt: mail.createdAt.toISOString(),
	replies: mail.replies.map((reply) => ({ id: reply.id, body: reply.body, createdAt: reply.createdAt.toISOString() })),
});

/**
 * 메일 앱의 연락 메일 (#25). 받는 사람은 늘 사이트 주인 한 명이고, 보낸 사람의 주소는 Reply-To로 넣어 바로 답장한다.
 * 보낸 메일은 보낸 브라우저(방문자 쿠키)와 묶어 두어, 그 브라우저의 보낸 편지함에만 보인다. 관리자는 모두 보고 앱에서 답장한다.
 * Resend(HTTPS API)로 보낸다: 서버의 메일 포트가 막혀 있어도 된다
 */
@Injectable()
export class ContactService {
	private readonly quota: DailyQuota;

	constructor(
		private readonly prisma: PrismaService,
		@Inject(APP_CONFIG) private readonly config: AppConfig
	) {
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

	/** Resend로 한 통 보낸다. 받지 않으면 false */
	private deliver(message: { to: string; replyTo: string; subject: string; text: string }) {
		return sendResendMail(this.config.contact, message);
	}

	/** 1년이 지난 메일(과 답장)을 지운다. 보낼 때와 관리자가 받은 편지함을 열 때 */
	private async purge(now = new Date()) {
		await this.prisma.contactMail.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - RETENTION_MS) } } });
	}

	async send(input: unknown, ip: string, visitor: Visitor): Promise<{ status: 'sent'; mail: ContactMailView }> {
		if (!this.enabled) throw new ServiceUnavailableException('메일 발송이 설정되지 않았습니다.');
		const parsed = parseContact(input);
		if ('errors' in parsed) throw new BadRequestException(parsed.errors);
		if (!(await this.human(parsed.token, ip)))
			throw new BadRequestException('사람인지 확인하지 못했습니다. 다시 시도해 주세요.');

		const key = hashIp(ip, this.config.ipHashSecret);
		if (!this.quota.take(key))
			throw new HttpException('오늘은 더 보낼 수 없습니다. 내일 다시 보내 주세요.', HttpStatus.TOO_MANY_REQUESTS);

		const { subject, text } = buildEmail(parsed.value);
		const sent = await this.deliver({ to: this.config.contact.to!, replyTo: parsed.value.email, subject, text });
		if (!sent) {
			// 보내지 못했으면 쓴 횟수를 돌려준다
			this.quota.refund(key);
			throw new BadGatewayException('메일을 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
		}
		await this.purge();
		const mail = await this.prisma.contactMail.create({
			data: { ...parsed.value, visitorHash: visitor.hash },
			include: INCLUDE,
		});
		return { status: 'sent', mail: toView(mail) };
	}

	/** 이 브라우저가 보낸 메일 (보낸 편지함). 방문자 쿠키가 없으면 없다 */
	async mine(visitor: Visitor | null): Promise<ContactMailView[]> {
		if (!visitor) return [];
		const mails = await this.prisma.contactMail.findMany({
			where: { visitorHash: visitor.hash },
			orderBy: { createdAt: 'desc' },
			include: INCLUDE,
		});
		return mails.map(toView);
	}

	/** 관리자의 받은 편지함: 모든 메일 (새 것부터) */
	async inbox(): Promise<ContactMailView[]> {
		await this.purge();
		const mails = await this.prisma.contactMail.findMany({
			orderBy: { createdAt: 'desc' },
			take: 500,
			include: INCLUDE,
		});
		return mails.map(toView);
	}

	/** 관리자 답장: 방문자의 주소로 보내고(Reply-To는 사이트 주인), 그 메일 아래에 남긴다 */
	async reply(id: string, input: unknown): Promise<ContactMailView> {
		if (!this.enabled) throw new ServiceUnavailableException('메일 발송이 설정되지 않았습니다.');
		const parsed = parseReply(input);
		if ('errors' in parsed) throw new BadRequestException(parsed.errors);
		const mail = await this.prisma.contactMail.findUnique({ where: { id } });
		if (!mail) throw new NotFoundException('메일이 없습니다.');

		const { subject, text } = buildReply(mail, parsed.body);
		const sent = await this.deliver({ to: mail.email, replyTo: this.config.contact.to!, subject, text });
		if (!sent) throw new BadGatewayException('답장을 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
		await this.prisma.contactReply.create({ data: { mailId: id, body: parsed.body } });
		const updated = await this.prisma.contactMail.findUniqueOrThrow({ where: { id }, include: INCLUDE });
		return toView(updated);
	}
}
