import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { newSlug, parsePostInput, type PostInput } from './rules.js';
import { isPostSlug, type PostSlug } from '@macfolio/desktop-core/memo';
import type { AdminPost, RevisionSummary, ServerPost } from '@macfolio/contracts';

/** 응답 모양은 화면과 같은 스키마(contracts). 방문자에게 보이는 글은 deleted면 저장소의 같은 주소 글도 가린다 */
export type PublicPost = ServerPost;
export type { AdminPost, RevisionSummary };

/** 글마다 남기는 버전 수 */
export const MAX_REVISIONS = 50;

/** 지운 글을 '최근 삭제된 항목'에 두는 날 수 (macOS 메모처럼). 지나면 영구히 지운다 */
export const RECENTLY_DELETED_DAYS = 30;

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
	// DB의 slug는 넣을 때 확인한 값이다
	slug: row.slug as PostSlug,
	published: publishedOf(row),
	publishedAt: row.publishedAt?.toISOString() ?? null,
	draft: draftOf(row),
	draftUpdatedAt: row.draftUpdatedAt?.toISOString() ?? null,
	deleted: row.deleted,
	deletedAt: row.deletedAt?.toISOString() ?? null,
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

const NO_PUBLISHED = { title: null, date: null, category: null, summary: null, body: null, publishedAt: null };

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

	/** 주소의 slug가 글 주소 모양인지. 아니면 404 (맞으면 그 뒤로는 PostSlug로 쓴다) */
	private checkSlug(slug: string): asserts slug is PostSlug {
		if (!isPostSlug(slug)) throw new NotFoundException('글이 없습니다.');
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
			if (hidden) return { slug: row.slug as PostSlug, ...EMPTY, deleted: true };
			return {
				slug: row.slug as PostSlug,
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
		await this.purgeExpired();
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
		const data = { ...draftFields(value), deleted: false, deletedAt: null, updatedBy: admin };
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
				update: { ...published, ...NO_DRAFT, deleted: false, deletedAt: null, updatedBy: admin },
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

	/**
	 * 글을 지운다: '최근 삭제된 항목'으로 옮긴다 (내용·임시 저장·버전은 그대로 두어 되살릴 수 있다).
	 * 저장소 글은 파일이 남아 있으므로 지운 표시로 가린다
	 */
	async remove(slug: string, admin: string) {
		this.checkSlug(slug);
		await this.checkUnlocked(slug);
		const data = { deleted: true, deletedAt: new Date(), updatedBy: admin };
		await this.prisma.post.upsert({ where: { slug }, create: { slug, ...data }, update: data });
	}

	/** '최근 삭제된 항목'의 글을 되살린다. 서버에 내용이 없던 저장소 글이면 표시를 지워 파일이 다시 보이게 한다 */
	async restore(slug: string): Promise<AdminPost | null> {
		this.checkSlug(slug);
		const row = await this.prisma.post.findUnique({ where: { slug } });
		if (!row?.deleted || !row.deletedAt) throw new NotFoundException('최근 삭제된 항목에 없는 글입니다.');
		if (row.title === null && row.draftTitle === null) {
			await this.prisma.post.delete({ where: { slug } });
			return null;
		}
		const restored = await this.prisma.post.update({
			where: { slug },
			data: { deleted: false, deletedAt: null },
			include: WITH_COUNT,
		});
		return toAdmin(restored);
	}

	/**
	 * '최근 삭제된 항목'에서 영구히 지운다. 내용·임시 저장·버전을 지우고,
	 * 저장소에 같은 주소의 파일이 있을 수 있으므로 가리는 표시(deleted)만 남긴다
	 */
	async purge(slug: string, admin: string) {
		this.checkSlug(slug);
		const row = await this.prisma.post.findUnique({ where: { slug } });
		if (!row?.deleted || !row.deletedAt) throw new NotFoundException('최근 삭제된 항목에 없는 글입니다.');
		await this.prisma.$transaction([
			this.prisma.postRevision.deleteMany({ where: { postSlug: slug } }),
			this.prisma.post.update({
				where: { slug },
				data: { ...NO_PUBLISHED, ...NO_DRAFT, deletedAt: null, updatedBy: admin },
			}),
		]);
	}

	/** 지운 지 RECENTLY_DELETED_DAYS일이 지난 글은 영구히 지운다 (관리자 목록을 읽을 때 같이 정리한다) */
	private async purgeExpired(now = new Date()) {
		const before = new Date(now.getTime() - RECENTLY_DELETED_DAYS * 24 * 60 * 60 * 1000);
		const expired = await this.prisma.post.findMany({
			where: { deleted: true, deletedAt: { lt: before } },
			select: { slug: true, updatedBy: true },
		});
		for (const { slug, updatedBy } of expired) await this.purge(slug, updatedBy);
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
