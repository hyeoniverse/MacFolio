import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SecurityService } from '../security/security.service.js';
import { tokenOf } from '../common/turnstile.js';
import type { AdminIdentity } from '../auth/auth.service.js';
import type { Visitor } from '../visitors/visitors.service.js';
import { publicAuthorId } from '../visitors/visitor.js';
import { hashIp, maskIp } from '../comments/rules.js';
import { SiteService } from '../site/site.service.js';
import { type Message, MessageInput, parse, PINNED_THREAD_ID, type Thread } from '@macfolio/contracts';

/** 사이트 주인의 고정 안내 항목 (contracts와 화면이 같은 값) */
export { PINNED_THREAD_ID };

/** 말풍선 하나·목록의 항목 하나. 모양은 @macfolio/contracts (화면과 같은 스키마) */
export type MessageView = Message;
export type ThreadView = Thread;

interface MessageRow {
	id: string;
	threadId: string | null;
	name: string;
	body: string;
	isAdmin: boolean;
	visitorHash: string;
	ipPrefix: string | null;
	createdAt: Date;
}

const toMessage = (row: MessageRow, visitor: Visitor | null): MessageView => ({
	id: row.id,
	threadId: row.threadId ?? PINNED_THREAD_ID,
	text: row.body,
	createdAt: row.createdAt.toISOString(),
	authorId: row.isAdmin ? 'owner' : publicAuthorId(row.visitorHash),
	nickname: row.name,
	...(row.ipPrefix ? { ipPrefix: row.ipPrefix } : {}),
	fromOwner: row.isAdmin,
	mine: !!visitor && row.visitorHash === visitor.hash,
});

const last = (rows: MessageRow[]) =>
	rows.at(-1) && { text: rows.at(-1)!.body, createdAt: rows.at(-1)!.createdAt.toISOString() };

/**
 * 메시지 앱: 쓰기 단추로 남긴 피드백 하나가 목록의 항목 하나가 되고, 누구나 어느 피드백(과 주인 안내)에나 답글을 단다.
 * 방문자는 쿠키로 정한 이름으로 쓰고 같은 브라우저에서 쓴 글만 지운다. 관리자는 프로필의 이름(기본 김정현)으로 쓰고 무엇이든 지운다.
 */
@Injectable()
export class MessagesService {
	constructor(
		private readonly prisma: PrismaService,
		@Inject(APP_CONFIG) private readonly config: AppConfig,
		private readonly security: SecurityService,
		private readonly site: SiteService
	) {}

	/** 주인 안내(답글이 있으면 마지막 활동과 함께) + 방문자가 남긴 피드백 */
	async listThreads(visitor: Visitor | null): Promise<ThreadView[]> {
		const [threads, ownerReplies] = await Promise.all([
			this.prisma.messageThread.findMany({
				orderBy: { createdAt: 'asc' },
				include: { messages: { orderBy: { createdAt: 'asc' } } },
			}),
			this.prisma.guestMessage.findMany({ where: { threadId: null }, orderBy: { createdAt: 'asc' } }),
		]);
		const pinned: ThreadView = {
			id: PINNED_THREAD_ID,
			// 주인 안내의 이름은 시스템 설정에서 고친 프로필을 따른다
			title: await this.site.ownerName(),
			createdAt: '2026-09-28T00:00:00.000Z',
			pinned: true,
			mine: false,
			...(ownerReplies.length > 0 ? { lastMessage: last(ownerReplies) } : {}),
		};
		return [
			pinned,
			...threads.map((thread) => ({
				id: thread.id,
				title: thread.title,
				...(thread.messages[0]?.ipPrefix ? { ipPrefix: thread.messages[0].ipPrefix } : {}),
				createdAt: thread.createdAt.toISOString(),
				mine: !!visitor && thread.visitorHash === visitor.hash,
				...(thread.messages[0] ? { summary: thread.messages[0].body, lastMessage: last(thread.messages) } : {}),
			})),
		];
	}

	async listMessages(threadId: string, visitor: Visitor | null): Promise<MessageView[]> {
		if (threadId !== PINNED_THREAD_ID && !(await this.prisma.messageThread.findUnique({ where: { id: threadId } })))
			throw new NotFoundException('피드백이 없습니다.');
		const rows = await this.prisma.guestMessage.findMany({
			where: { threadId: threadId === PINNED_THREAD_ID ? null : threadId },
			orderBy: { createdAt: 'asc' },
		});
		return rows.map((row) => toMessage(row, visitor));
	}

	private async author(ip: string, visitor: Visitor, admin: AdminIdentity | null) {
		return {
			name: admin ? await this.site.ownerName() : visitor.name,
			isAdmin: !!admin,
			visitorHash: visitor.hash,
			ipPrefix: admin ? null : maskIp(ip),
			ipHash: hashIp(ip, this.config.ipHashSecret),
		};
	}

	/** 새 피드백 (쓰기 단추). 목록에 항목이 하나 생긴다 */
	async createThread(input: unknown, ip: string, visitor: Visitor, admin: AdminIdentity | null) {
		const parsed = parse(MessageInput, input);
		if ('errors' in parsed) throw new BadRequestException(parsed.errors);
		// 사람 확인: 관리자가 시스템 설정에서 켜면 (관리자 글은 확인하지 않는다)
		await this.security.requireHuman('message', tokenOf(input), ip, admin);
		const author = await this.author(ip, visitor, admin);
		const thread = await this.prisma.messageThread.create({
			data: {
				title: author.name,
				visitorHash: visitor.hash,
				messages: { create: { ...author, body: parsed.value.body } },
			},
			include: { messages: true },
		});
		const message = toMessage(thread.messages[0], visitor);
		return {
			thread: {
				id: thread.id,
				title: thread.title,
				...(message.ipPrefix ? { ipPrefix: message.ipPrefix } : {}),
				createdAt: thread.createdAt.toISOString(),
				mine: true,
				summary: message.text,
				lastMessage: { text: message.text, createdAt: message.createdAt },
			} satisfies ThreadView,
			message,
		};
	}

	/** 피드백(이나 주인 안내)에 답글을 단다. 항목은 생기지 않는다 */
	async post(threadId: string, input: unknown, ip: string, visitor: Visitor, admin: AdminIdentity | null) {
		const parsed = parse(MessageInput, input);
		if ('errors' in parsed) throw new BadRequestException(parsed.errors);
		await this.security.requireHuman('message', tokenOf(input), ip, admin);
		if (threadId !== PINNED_THREAD_ID && !(await this.prisma.messageThread.findUnique({ where: { id: threadId } })))
			throw new NotFoundException('삭제된 피드백입니다.');
		const row = await this.prisma.guestMessage.create({
			data: {
				...(await this.author(ip, visitor, admin)),
				threadId: threadId === PINNED_THREAD_ID ? null : threadId,
				body: parsed.value.body,
			},
		});
		return toMessage(row, visitor);
	}

	/** 말풍선을 지운다. 관리자는 무엇이든, 방문자는 같은 브라우저에서 쓴 것만 */
	async remove(id: string, visitor: Visitor | null, admin: AdminIdentity | null) {
		const row = await this.prisma.guestMessage.findUnique({ where: { id } });
		if (!row) throw new NotFoundException('메시지가 없습니다.');
		if (!admin && (!visitor || row.visitorHash !== visitor.hash))
			throw new ForbiddenException('이 브라우저에서 쓴 메시지만 지울 수 있습니다.');
		await this.prisma.guestMessage.delete({ where: { id } });
	}
}
