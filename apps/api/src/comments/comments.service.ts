import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SecurityService } from '../security/security.service.js';
import { tokenOf } from '../common/turnstile.js';
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
	/** 좋아요 수 */
	likes: number;
	/** 보고 있는 브라우저가 좋아요를 눌렀는지 */
	liked: boolean;
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

/** 좋아요 수와, 보고 있는 브라우저가 누른 좋아요 (없으면 빈 목록) */
const selectWithLikes = (visitor: Visitor | null) => ({
	...SELECT,
	_count: { select: { likes: true } },
	likes: { where: { visitorHash: visitor?.hash ?? '' }, select: { visitorHash: true } },
});

const toView = (
	{
		visitorHash,
		createdAt,
		_count,
		likes,
		...row
	}: {
		visitorHash: string | null;
		createdAt: Date;
		_count: { likes: number };
		likes: unknown[];
	} & Omit<CommentView, 'createdAt' | 'mine' | 'likes' | 'liked'>,
	visitor: Visitor | null
): CommentView => ({
	...row,
	createdAt: createdAt.toISOString(),
	mine: !!visitor && visitorHash === visitor.hash,
	likes: _count.likes,
	liked: !!visitor && likes.length > 0,
});

@Injectable()
export class CommentsService {
	constructor(
		private readonly prisma: PrismaService,
		@Inject(APP_CONFIG) private readonly config: AppConfig,
		private readonly security: SecurityService
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
			select: selectWithLikes(visitor),
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
		// 사람 확인: 관리자가 시스템 설정에서 켜면 (관리자 댓글은 확인하지 않는다)
		await this.security.requireHuman('comment', tokenOf(input), ip, admin);
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
			select: selectWithLikes(visitor),
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
