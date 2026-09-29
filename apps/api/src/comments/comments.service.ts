import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AdminIdentity } from '../auth/auth.service.js';
import {
	hashIp,
	hashPassword,
	maskIp,
	OWNER_NAME,
	parseAdminComment,
	parseVisitorComment,
	SLUG,
	verifyPassword,
} from './rules.js';

/** 밖으로 내보내는 댓글. 비밀번호 해시와 IP 해시는 절대 담지 않는다 */
export interface CommentView {
	id: string;
	name: string;
	/** IP 앞 두 자리 (관리자 댓글은 없음) */
	ipPrefix: string | null;
	isAdmin: boolean;
	body: string;
	createdAt: string;
}

const SELECT = { id: true, name: true, ipPrefix: true, isAdmin: true, body: true, createdAt: true } as const;
const toView = (row: { createdAt: Date } & Omit<CommentView, 'createdAt'>): CommentView => ({
	...row,
	createdAt: row.createdAt.toISOString(),
});

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
	async list(slug: string): Promise<CommentView[]> {
		this.checkSlug(slug);
		const rows = await this.prisma.postComment.findMany({
			where: { postSlug: slug },
			orderBy: { createdAt: 'asc' },
			select: SELECT,
		});
		return rows.map(toView);
	}

	/** 댓글을 쓴다. 관리자면 김정현으로(비밀번호 없이), 아니면 이름·비밀번호로 */
	async create(slug: string, input: unknown, ip: string, admin: AdminIdentity | null): Promise<CommentView> {
		this.checkSlug(slug);
		const ipHash = hashIp(ip, this.config.ipHashSecret);
		if (admin) {
			const parsed = parseAdminComment(input);
			if ('errors' in parsed) throw new BadRequestException(parsed.errors);
			const row = await this.prisma.postComment.create({
				data: { postSlug: slug, name: OWNER_NAME, body: parsed.value.body, isAdmin: true, ipHash },
				select: SELECT,
			});
			return toView(row);
		}
		const parsed = parseVisitorComment(input);
		if ('errors' in parsed) throw new BadRequestException(parsed.errors);
		const row = await this.prisma.postComment.create({
			data: {
				postSlug: slug,
				name: parsed.value.name,
				body: parsed.value.body,
				passwordHash: await hashPassword(parsed.value.password),
				ipPrefix: maskIp(ip),
				ipHash,
			},
			select: SELECT,
		});
		return toView(row);
	}

	/** 댓글을 지운다. 관리자는 무엇이든, 방문자는 비밀번호가 맞을 때만 */
	async remove(id: string, input: unknown, admin: AdminIdentity | null) {
		const row = await this.prisma.postComment.findUnique({ where: { id } });
		if (!row) throw new NotFoundException('댓글이 없습니다.');
		if (!admin) {
			const password = (input as { password?: unknown } | null)?.password;
			if (typeof password !== 'string' || !(await verifyPassword(password, row.passwordHash)))
				throw new ForbiddenException('비밀번호가 맞지 않습니다.');
		}
		await this.prisma.postComment.delete({ where: { id } });
	}
}
