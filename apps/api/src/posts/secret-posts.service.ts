import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * 비밀 글(Post.secret): 관리자에게만 보이는 글.
 * 글 주소를 받는 다른 모듈(댓글, 좋아요, 트래픽 분석, 메모 정리 내용)이 방문자에게 답하기 전에 여기서 확인한다.
 * 방문자에게는 없는 글과 같게 답한다 (빈 목록, 0, 404). 그래야 응답의 차이로 비밀 글이 있는지 알아낼 수 없다
 */
@Injectable()
export class SecretPosts {
	constructor(private readonly prisma: PrismaService) {}

	/** 비밀 글 주소 모두 */
	async slugs(): Promise<Set<string>> {
		const rows = await this.prisma.post.findMany({ where: { secret: true }, select: { slug: true } });
		return new Set(rows.map(({ slug }) => slug));
	}

	/** 이 주소의 글이 비밀 글인지 */
	async isSecret(slug: string): Promise<boolean> {
		return (await this.prisma.post.count({ where: { slug, secret: true } })) > 0;
	}
}

/** 주소를 키로 쓰는 객체에서 비밀 글을 뺀다 (원본은 그대로 두고 새 객체로) */
export function withoutSecret<K extends string, T>(record: Record<K, T>, secret: Set<string>): Record<K, T> {
	if (secret.size === 0) return record;
	return Object.fromEntries(Object.entries<T>(record).filter(([key]) => !secret.has(key))) as Record<K, T>;
}
