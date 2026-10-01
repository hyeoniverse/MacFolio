import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { newSlug, parsePostInput, SLUG, type PostInput } from './rules.js';

/** 방문자에게 보이는 글. deleted면 저장소의 같은 주소 글도 가린다 (지운 글, 아직 날짜가 안 된 예약 글) */
export interface PublicPost extends PostInput {
	slug: string;
	deleted: boolean;
}

/** 관리자가 보는 글: 게시한 내용과 임시 저장을 따로 */
export interface AdminPost {
	slug: string;
	published: PostInput | null;
	publishedAt: string | null;
	draft: PostInput | null;
	draftUpdatedAt: string | null;
	deleted: boolean;
	revisions: number;
}

export interface RevisionSummary {
	id: number;
	title: string;
	date: string;
	createdAt: string;
	createdBy: string;
}

/** 글마다 남기는 버전 수 */
export const MAX_REVISIONS = 50;

const EMPTY: PostInput = { title: '', date: '', category: '', summary: '', body: '' };

type Row = Prisma.PostGetPayload<{ include: { _count: { select: { revisions: true } } } }>;

const publishedOf = (row: Row): PostInput | null =>
	row.title === null
		? null
		: { title: row.title, date: row.date!, category: row.category!, summary: row.summary ?? '', body: row.body! };

const draftOf = (row: Row): PostInput | null =>
	row.draftTitle === null
		? null
		: {
				title: row.draftTitle,
				date: row.draftDate!,
				category: row.draftCategory!,
				summary: row.draftSummary ?? '',
				body: row.draftBody!,
			};

const toAdmin = (row: Row): AdminPost => ({
	slug: row.slug,
	published: publishedOf(row),
	publishedAt: row.publishedAt?.toISOString() ?? null,
	draft: draftOf(row),
	draftUpdatedAt: row.draftUpdatedAt?.toISOString() ?? null,
	deleted: row.deleted,
	revisions: row._count.revisions,
});

const draftFields = (input: PostInput) => ({
	draftTitle: input.title,
	draftDate: input.date,
	draftCategory: input.category,
	draftSummary: input.summary,
	draftBody: input.body,
	draftUpdatedAt: new Date(),
});

const NO_DRAFT = {
	draftTitle: null,
	draftDate: null,
	draftCategory: null,
	draftSummary: null,
	draftBody: null,
	draftUpdatedAt: null,
};

const WITH_COUNT = { _count: { select: { revisions: true } } } as const;

/** 서버 시간 기준 오늘 (서울) */
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

@Injectable()
export class PostsService {
	constructor(private readonly prisma: PrismaService) {}

	private parse(input: unknown) {
		const parsed = parsePostInput(input, today());
		if ('errors' in parsed) throw new BadRequestException(parsed.errors);
		return parsed.value;
	}

	private checkSlug(slug: string) {
		if (!SLUG.test(slug)) throw new NotFoundException('글이 없습니다.');
	}

	/**
	 * 방문자용: 게시한 글 중 날짜가 된 것, 그리고 저장소 글을 가릴 표시(지운 글, 예약 글).
	 * 임시 저장과 게시한 적 없는 글은 내보내지 않는다
	 */
	async listPublic(now = today()): Promise<PublicPost[]> {
		const rows = await this.prisma.post.findMany({
			where: { OR: [{ deleted: true }, { title: { not: null } }] },
			orderBy: { slug: 'asc' },
		});
		return rows.map((row) => {
			const hidden = row.deleted || row.date! > now;
			if (hidden) return { slug: row.slug, ...EMPTY, deleted: true };
			return {
				slug: row.slug,
				title: row.title!,
				date: row.date!,
				category: row.category!,
				summary: row.summary ?? '',
				body: row.body!,
				deleted: false,
			};
		});
	}

	async listAdmin(): Promise<AdminPost[]> {
		const rows = await this.prisma.post.findMany({ include: WITH_COUNT, orderBy: { slug: 'asc' } });
		return rows.map(toAdmin);
	}

	/** 새 글: 임시 저장으로 시작한다 (게시하기 전에는 아무에게도 보이지 않는다) */
	async create(input: unknown, admin: string): Promise<AdminPost> {
		const value = this.parse(input);
		const row = await this.prisma.post.create({
			data: { slug: newSlug(value.date), ...draftFields(value), updatedBy: admin },
			include: WITH_COUNT,
		});
		return toAdmin(row);
	}

	/**
	 * 잠근 글이면 409. 잠금은 메모 정리 내용(MemoOrganization.locks)에 있다.
	 * 화면에서도 막지만, 요청은 직접 보낼 수 있으므로 고치고 지우기 전에 여기서 한 번 더 막는다.
	 */
	private async checkUnlocked(slug: string) {
		const row = await this.prisma.memoOrganization.findUnique({ where: { id: 1 } });
		const locks = (row?.data as { locks?: Record<string, boolean> } | undefined)?.locks;
		if (locks?.[slug]) throw new ConflictException('잠긴 메모입니다. 잠금을 풀고 고치세요.');
	}

	/** 임시 저장 (자동 저장). 서버에 없던 저장소 글이면 임시 저장만 가진 행을 만든다 */
	async saveDraft(slug: string, input: unknown, admin: string): Promise<AdminPost> {
		this.checkSlug(slug);
		await this.checkUnlocked(slug);
		const value = this.parse(input);
		const data = { ...draftFields(value), deleted: false, updatedBy: admin };
		const row = await this.prisma.post.upsert({
			where: { slug },
			create: { slug, ...data },
			update: data,
			include: WITH_COUNT,
		});
		return toAdmin(row);
	}

	/**
	 * 게시: 받은 내용(화면의 지금 내용)을 게시한 내용으로 두고, 임시 저장을 비우고, 버전을 남긴다.
	 * 날짜가 오늘보다 뒤면 그날부터 방문자에게 보인다 (예약 발행)
	 */
	async publish(slug: string, input: unknown, admin: string): Promise<AdminPost> {
		this.checkSlug(slug);
		await this.checkUnlocked(slug);
		const value = this.parse(input);
		const published = { ...value, publishedAt: new Date() };
		const row = await this.prisma.$transaction(async (tx) => {
			await tx.post.upsert({
				where: { slug },
				create: { slug, ...published, updatedBy: admin },
				update: { ...published, ...NO_DRAFT, deleted: false, updatedBy: admin },
			});
			await tx.postRevision.create({ data: { postSlug: slug, ...value, createdBy: admin } });
			// 오래된 버전은 지운다
			const old = await tx.postRevision.findMany({
				where: { postSlug: slug },
				orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
				skip: MAX_REVISIONS,
				select: { id: true },
			});
			if (old.length) await tx.postRevision.deleteMany({ where: { id: { in: old.map(({ id }) => id) } } });
			return tx.post.findUniqueOrThrow({ where: { slug }, include: WITH_COUNT });
		});
		return toAdmin(row);
	}

	/**
	 * 임시 저장 버리기. 게시한 내용이 있으면 그것으로 돌아가고,
	 * 없으면 행을 지운다 (저장소 글은 원래대로 보이고, 새 글은 사라진다)
	 */
	async discardDraft(slug: string): Promise<AdminPost | null> {
		this.checkSlug(slug);
		await this.checkUnlocked(slug);
		const row = await this.prisma.post.findUnique({ where: { slug } });
		if (!row) throw new NotFoundException('글이 없습니다.');
		if (row.title === null && !row.deleted) {
			await this.prisma.post.delete({ where: { slug } });
			return null;
		}
		return toAdmin(await this.prisma.post.update({ where: { slug }, data: NO_DRAFT, include: WITH_COUNT }));
	}

	/** 글을 지운다. 저장소 글은 파일이 남아 있으므로 지운 표시로 남긴다 (버전은 남겨 둔다) */
	async remove(slug: string, admin: string) {
		this.checkSlug(slug);
		await this.checkUnlocked(slug);
		const data = { deleted: true, ...NO_DRAFT, updatedBy: admin };
		await this.prisma.post.upsert({ where: { slug }, create: { slug, ...data }, update: data });
	}

	async revisions(slug: string): Promise<RevisionSummary[]> {
		this.checkSlug(slug);
		const rows = await this.prisma.postRevision.findMany({
			where: { postSlug: slug },
			orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
			select: { id: true, title: true, date: true, createdAt: true, createdBy: true },
		});
		return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
	}

	async revision(slug: string, id: number) {
		this.checkSlug(slug);
		const row = Number.isInteger(id)
			? await this.prisma.postRevision.findFirst({ where: { id, postSlug: slug } })
			: null;
		if (!row) throw new NotFoundException('버전이 없습니다.');
		const { title, date, category, summary, body, createdAt, createdBy } = row;
		return { id, title, date, category, summary, body, createdAt: createdAt.toISOString(), createdBy };
	}
}
