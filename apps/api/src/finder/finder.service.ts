import { BadRequestException, Injectable } from '@nestjs/common';
import { EMPTY_FINDER_LAYOUT, FinderLayout, type FinderLayoutValue, parse } from '@macfolio/contracts';
import { PrismaService } from '../prisma/prisma.service.js';

const ROW_ID = 1;

/** Finder의 폴더 구조 (메모 정리 내용과 같은 한 행 JSON). 누구나 읽고 관리자만 바꾼다 */
@Injectable()
export class FinderService {
	constructor(private readonly prisma: PrismaService) {}

	/** 지금 구조 (아직 저장한 적 없으면 빈 구조: 기본 폴더와 기본 가상본만) */
	async getLayout(): Promise<FinderLayoutValue & { updatedAt: string | null }> {
		const row = await this.prisma.finderLayout.findUnique({ where: { id: ROW_ID } });
		if (!row) return { ...EMPTY_FINDER_LAYOUT, updatedAt: null };
		// 예전에 저장한 값에 없는 필드는 빈 값으로 채운다
		return {
			...EMPTY_FINDER_LAYOUT,
			...(row.data as unknown as FinderLayoutValue),
			updatedAt: row.updatedAt.toISOString(),
		};
	}

	/** 구조를 통째로 바꾼다. 규칙(상위 폴더, 고리, 이름)을 어기면 400 */
	async saveLayout(input: unknown, admin: string) {
		const parsed = parse(FinderLayout, input);
		if ('errors' in parsed) throw new BadRequestException(parsed.errors);
		const data = parsed.value as object;
		await this.prisma.finderLayout.upsert({
			where: { id: ROW_ID },
			create: { id: ROW_ID, data, updatedBy: admin },
			update: { data, updatedBy: admin },
		});
		return this.getLayout();
	}
}
