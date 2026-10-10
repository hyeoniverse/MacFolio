import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SLUG } from '../comments/rules.js';
import type { Visitor } from '../visitors/visitors.service.js';
import type { Likes, PostStats } from '@macfolio/contracts';

/** 응답 모양은 화면과 같은 스키마(contracts). 조회수는 /analytics/views */
export type LikeView = Likes;
export type { PostStats };

@Injectable()
export class LikesService {
	constructor(private readonly prisma: PrismaService) {}

	private checkSlug(slug: string) {
		if (!SLUG.test(slug)) throw new BadRequestException('글 주소가 올바르지 않습니다.');
	}

	private async postView(slug: string, visitor: Visitor | null): Promise<LikeView> {
		const [count, mine] = await Promise.all([
			this.prisma.postLike.count({ where: { postSlug: slug } }),
			visitor
				? this.prisma.postLike.count({ where: { postSlug: slug, visitorHash: visitor.hash } })
				: Promise.resolve(0),
		]);
		return { count, liked: mine > 0 };
	}

	/** 글의 좋아요 */
	post(slug: string, visitor: Visitor | null): Promise<LikeView> {
		this.checkSlug(slug);
		return this.postView(slug, visitor);
	}

	/** 글에 좋아요를 누르거나(liked) 취소한다. 이미 그 상태면 그대로 (두 번 눌러도 한 번) */
	async setPost(slug: string, visitor: Visitor, liked: boolean): Promise<LikeView> {
		this.checkSlug(slug);
		if (liked)
			await this.prisma.postLike.createMany({
				data: [{ postSlug: slug, visitorHash: visitor.hash }],
				skipDuplicates: true,
			});
		else await this.prisma.postLike.deleteMany({ where: { postSlug: slug, visitorHash: visitor.hash } });
		return this.postView(slug, visitor);
	}

	/** 댓글에 좋아요를 누르거나 취소한다. 댓글이 없으면 404 */
	async setComment(id: string, visitor: Visitor, liked: boolean): Promise<LikeView> {
		const comment = await this.prisma.postComment.findUnique({ where: { id }, select: { id: true } });
		if (!comment) throw new NotFoundException('댓글이 없습니다.');
		if (liked)
			await this.prisma.commentLike.createMany({
				data: [{ commentId: id, visitorHash: visitor.hash }],
				skipDuplicates: true,
			});
		else await this.prisma.commentLike.deleteMany({ where: { commentId: id, visitorHash: visitor.hash } });
		const [count, mine] = await Promise.all([
			this.prisma.commentLike.count({ where: { commentId: id } }),
			this.prisma.commentLike.count({ where: { commentId: id, visitorHash: visitor.hash } }),
		]);
		return { count, liked: mine > 0 };
	}

	/** 글마다 댓글 수와 좋아요 수. 하나라도 있는 글만 */
	async stats(): Promise<PostStats> {
		const [comments, likes] = await Promise.all([
			this.prisma.postComment.groupBy({ by: ['postSlug'], _count: { _all: true } }),
			this.prisma.postLike.groupBy({ by: ['postSlug'], _count: { _all: true } }),
		]);
		const stats: PostStats = {};
		for (const row of comments) stats[row.postSlug] = { comments: row._count._all, likes: 0 };
		for (const row of likes)
			stats[row.postSlug] = { comments: stats[row.postSlug]?.comments ?? 0, likes: row._count._all };
		return stats;
	}
}
