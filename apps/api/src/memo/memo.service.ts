import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SecretPosts, withoutSecret } from '../posts/secret-posts.service.js';
import { EMPTY_ORGANIZATION, parseOrganization, type Organization } from '@macfolio/desktop-core/memo';

const ROW_ID = 1;

@Injectable()
export class MemoService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly secret: SecretPosts
	) {}

	/** 지금 정리 내용 (아직 저장한 적 없으면 빈 정리 내용) */
	async getOrganization(): Promise<Organization & { updatedAt: string | null }> {
		const row = await this.prisma.memoOrganization.findUnique({ where: { id: ROW_ID } });
		if (!row) return { ...EMPTY_ORGANIZATION, updatedAt: null };
		// 잠금(locks)처럼 나중에 생긴 필드는 예전에 저장한 값에 없으므로 빈 값으로 채운다
		return { ...EMPTY_ORGANIZATION, ...(row.data as unknown as Organization), updatedAt: row.updatedAt.toISOString() };
	}

	/**
	 * 방문자에게 주는 정리 내용: 옮긴 글·고정·잠금에서 비밀 글의 주소를 뺀다 (주소가 있다는 것도 알리지 않는다).
	 * 관리자는 getOrganization을 그대로 받아 고친 뒤 통째로 저장하므로 빼지 않는다
	 */
	async getPublicOrganization(): Promise<Organization & { updatedAt: string | null }> {
		const organization = await this.getOrganization();
		const secret = await this.secret.slugs();
		if (secret.size === 0) return organization;
		return {
			...organization,
			posts: withoutSecret(organization.posts, secret),
			pins: withoutSecret(organization.pins, secret),
			locks: withoutSecret(organization.locks, secret),
		};
	}

	/** 정리 내용을 통째로 바꾼다. 규칙을 어기면 400 */
	async saveOrganization(input: unknown, admin: string) {
		const parsed = parseOrganization(input);
		if ('errors' in parsed) throw new BadRequestException(parsed.errors);
		const data = parsed.value as object;
		await this.prisma.memoOrganization.upsert({
			where: { id: ROW_ID },
			create: { id: ROW_ID, data, updatedBy: admin },
			update: { data, updatedBy: admin },
		});
		return this.getOrganization();
	}
}
