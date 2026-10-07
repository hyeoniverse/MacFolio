import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseCaptionInput } from './rules.js';

@Injectable()
export class PhotosService {
	constructor(private readonly prisma: PrismaService) {}

	/** 관리자가 고친 캡션: { 사진 주소: 캡션 } */
	async captions(): Promise<Record<string, string>> {
		const rows = await this.prisma.photoCaption.findMany({ orderBy: { src: 'asc' } });
		return Object.fromEntries(rows.map((row) => [row.src, row.caption]));
	}

	/** 캡션 하나를 고친다. 비우면 고친 것을 지워 원래 캡션으로 돌아간다. 고친 뒤의 전체를 돌려준다 */
	async save(body: unknown, admin: string): Promise<Record<string, string>> {
		const input = parseCaptionInput(body);
		if (typeof input === 'string') throw new BadRequestException(input);
		if (input.caption === null) await this.prisma.photoCaption.deleteMany({ where: { src: input.src } });
		else
			await this.prisma.photoCaption.upsert({
				where: { src: input.src },
				create: { src: input.src, caption: input.caption, updatedBy: admin },
				update: { caption: input.caption, updatedBy: admin },
			});
		return this.captions();
	}
}
