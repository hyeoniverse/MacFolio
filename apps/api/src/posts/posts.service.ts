import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { newSlug, parsePostInput, SLUG } from './rules.js';

/** 밖으로 내보내는 글 */
export interface PostView {
	slug: string;
	title: string;
	date: string;
	category: string;
	summary: string;
	body: string;
	/** 저장소의 Markdown 글을 지운 표시 */
	deleted: boolean;
	updatedAt: string;
}

const SELECT = {
	slug: true,
	title: true,
	date: true,
	category: true,
	summary: true,
	body: true,
	deleted: true,
	updatedAt: true,
} as const;
const toView = (row: { updatedAt: Date } & Omit<PostView, 'updatedAt'>): PostView => ({
	...row,
	updatedAt: row.updatedAt.toISOString(),
});

/** 서버 시간 기준 오늘 (서울) */
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

@Injectable()
export class PostsService {
	constructor(private readonly prisma: PrismaService) {}

	/** 서버에 있는 글 (지운 표시 포함). 화면은 저장소의 Markdown 글 위에 겹친다 */
	async list(): Promise<PostView[]> {
		const rows = await this.prisma.post.findMany({ orderBy: { date: 'desc' }, select: SELECT });
		return rows.map(toView);
	}

	async create(input: unknown, admin: string): Promise<PostView> {
		const parsed = parsePostInput(input, today());
		if ('errors' in parsed) throw new BadRequestException(parsed.errors);
		const row = await this.prisma.post.create({
			data: { ...parsed.value, slug: newSlug(parsed.value.date), updatedBy: admin },
			select: SELECT,
		});
		return toView(row);
	}

	/** 글을 고친다. 서버에 없으면 새로 만든다 (저장소의 Markdown 글을 처음 고칠 때) */
	async update(slug: string, input: unknown, admin: string): Promise<PostView> {
		if (!SLUG.test(slug)) throw new BadRequestException('글 주소가 올바르지 않습니다.');
		const parsed = parsePostInput(input, today());
		if ('errors' in parsed) throw new BadRequestException(parsed.errors);
		const data = { ...parsed.value, deleted: false, updatedBy: admin };
		const row = await this.prisma.post.upsert({
			where: { slug },
			create: { ...data, slug },
			update: data,
			select: SELECT,
		});
		return toView(row);
	}

	/** 글을 지운다. Markdown 글은 파일이 남아 있으므로 지운 표시로 남긴다 */
	async remove(slug: string, admin: string) {
		if (!SLUG.test(slug)) throw new NotFoundException('글이 없습니다.');
		await this.prisma.post.upsert({
			where: { slug },
			create: { slug, title: '', date: today(), category: '기타', body: '', deleted: true, updatedBy: admin },
			update: { deleted: true, updatedBy: admin },
		});
	}
}
