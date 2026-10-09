import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EMPTY_ORGANIZATION, parseOrganization, type Organization } from '@macfolio/desktop-core/memo';

const ROW_ID = 1;

@Injectable()
export class MemoService {
	constructor(private readonly prisma: PrismaService) {}

	/** 지금 정리 내용 (아직 저장한 적 없으면 빈 정리 내용) */
	async getOrganization(): Promise<Organization & { updatedAt: string | null }> {
		const row = await this.prisma.memoOrganization.findUnique({ where: { id: ROW_ID } });
		if (!row) return { ...EMPTY_ORGANIZATION, updatedAt: null };
		// 잠금(locks)처럼 나중에 생긴 필드는 예전에 저장한 값에 없으므로 빈 값으로 채운다
		return { ...EMPTY_ORGANIZATION, ...(row.data as unknown as Organization), updatedAt: row.updatedAt.toISOString() };
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
