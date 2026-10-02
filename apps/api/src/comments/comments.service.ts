import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AdminIdentity } from '../auth/auth.service.js';
import type { Visitor } from '../visitors/visitors.service.js';
import { hashIp, maskIp, OWNER_NAME, parseBody, SLUG } from './rules.js';

/** 밖으로 내보내는 댓글. 방문자 해시와 IP 해시는 절대 담지 않는다 */
export interface CommentView {
	id: string;
	name: string;
	/** IP 앞 두 자리 (관리자 댓글은 없음) */
	ipPrefix: string | null;
	isAdmin: boolean;
	body: string;
	createdAt: string;
	/** 보고 있는 브라우저가 쓴 댓글 (지우기 단추를 보인다) */
	mine: boolean;
}

const SELECT = {
	id: true,
	name: true,
	ipPrefix: true,
	isAdmin: true,
	body: true,
	createdAt: true,
	visitorHash: true,
} as const;

const toView = (
	{
		visitorHash,
		createdAt,
		...row
	}: { visitorHash: string | null; createdAt: Date } & Omit<CommentView, 'createdAt' | 'mine'>,
	visitor: Visitor | null
): CommentView => ({ ...row, createdAt: createdAt.toISOString(), mine: !!visitor && visitorHash === visitor.hash });

@Injectable()
export class CommentsService {
	constructor(
		private readonly prisma: PrismaService,
		@Inject(APP_CONFIG) private readonly config: AppConfig
	) {}

	private checkSlug(slug: string) {
		if (!SLUG.test(slug)) throw new BadRequestException('글 주소가 올바르지 않습니다.');
	}

	/** 글의 댓글 (오래된 것부터) */
	async list(slug: string, visitor: Visitor | null): Promise<CommentView[]> {
		this.checkSlug(slug);
		const rows = await this.prisma.postComment.findMany({
			where: { postSlug: slug },
			orderBy: { createdAt: 'asc' },
			select: SELECT,
		});
		return rows.map((row) => toView(row, visitor));
	}

	/** 댓글을 쓴다. 관리자면 김정현으로, 아니면 방문자 쿠키로 정한 이름으로 */
	async create(
		slug: string,
		input: unknown,
		ip: string,
		visitor: Visitor,
		admin: AdminIdentity | null
	): Promise<CommentView> {
		this.checkSlug(slug);
		const parsed = parseBody(input);
		if ('errors' in parsed) throw new BadRequestException(parsed.errors);
		const row = await this.prisma.postComment.create({
			data: {
				postSlug: slug,
				name: admin ? OWNER_NAME : visitor.name,
				body: parsed.value.body,
				isAdmin: !!admin,
				visitorHash: visitor.hash,
				ipPrefix: admin ? null : maskIp(ip),
				ipHash: hashIp(ip, this.config.ipHashSecret),
			},
			select: SELECT,
		});
		return toView(row, visitor);
	}

	/** 댓글을 지운다. 관리자는 무엇이든, 방문자는 같은 브라우저에서 쓴 것만 */
	async remove(id: string, visitor: Visitor | null, admin: AdminIdentity | null) {
		const row = await this.prisma.postComment.findUnique({ where: { id } });
		if (!row) throw new NotFoundException('댓글이 없습니다.');
		if (!admin && (!visitor || row.visitorHash !== visitor.hash))
			throw new ForbiddenException('이 브라우저에서 쓴 댓글만 지울 수 있습니다.');
		await this.prisma.postComment.delete({ where: { id } });
	}
}
