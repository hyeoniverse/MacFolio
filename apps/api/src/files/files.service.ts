import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { stripImageMetadata } from './metadata.js';
import { cleanFileName, cleanFileType, IMAGE_TYPES, newUploadId, sniffImage, UPLOAD_ID, uploadIdsIn } from './rules.js';
import type { Upload, UploadUsage } from '@macfolio/contracts';

/** multer가 넘겨주는 파일 (메모리에 받는다) */
export interface IncomingFile {
	originalname: string;
	mimetype: string;
	size: number;
	buffer: Buffer;
}

/** 올린 파일 하나와, 관리자가 보는 쓰는 곳. 모양은 @macfolio/contracts (화면과 같은 스키마) */
export type UploadView = Upload;
export type UploadUsageView = UploadUsage;

@Injectable()
export class FilesService {
	constructor(private readonly prisma: PrismaService) {}

	async upload(file: IncomingFile | undefined, admin: string): Promise<UploadView> {
		if (!file || file.size === 0) throw new BadRequestException('올릴 파일이 없습니다.');
		// multer는 파일 이름을 latin1로 읽는다. 한글 이름이 깨지지 않게 UTF-8로 다시 읽는다
		const name = cleanFileName(Buffer.from(file.originalname, 'latin1').toString('utf8'));
		const image = sniffImage(file.buffer);
		// 사진의 EXIF(찍은 곳·기기)와 XMP는 지우고 저장한다. 저장한 크기가 곧 내려줄 크기
		const data = new Uint8Array(image ? stripImageMetadata(file.buffer, image) : file.buffer);
		const row = await this.prisma.upload.create({
			data: {
				id: newUploadId(),
				name,
				type: image ?? cleanFileType(file.mimetype),
				size: data.byteLength,
				data,
				createdBy: admin,
			},
			select: { id: true, name: true, type: true, size: true },
		});
		return { ...row, image: image !== null, path: `/files/${row.id}` };
	}

	/** 지금 글이 가리키는 파일 → 글 주소들, 예전 버전만 가리키는 파일 → 글 주소들 */
	private async references() {
		const [posts, revisions] = await Promise.all([
			this.prisma.post.findMany({
				select: { slug: true, summary: true, body: true, draftSummary: true, draftBody: true },
			}),
			this.prisma.postRevision.findMany({ select: { postSlug: true, summary: true, body: true } }),
		]);
		const add = (map: Map<string, Set<string>>, id: string, slug: string) =>
			map.set(id, (map.get(id) ?? new Set()).add(slug));
		const current = new Map<string, Set<string>>();
		const old = new Map<string, Set<string>>();
		for (const post of posts)
			for (const text of [post.summary, post.body, post.draftSummary, post.draftBody])
				for (const id of uploadIdsIn(text)) add(current, id, post.slug);
		for (const revision of revisions)
			for (const text of [revision.summary, revision.body])
				for (const id of uploadIdsIn(text)) add(old, id, revision.postSlug);
		return { current, old };
	}

	/** 올린 파일 모두 (최근 것이 위로). 파일 내용은 읽지 않는다 */
	async list(): Promise<UploadUsageView[]> {
		const [rows, { current, old }] = await Promise.all([
			this.prisma.upload.findMany({
				select: {
					id: true,
					name: true,
					type: true,
					size: true,
					createdAt: true,
					createdBy: true,
					wallpaperImage: { select: { id: true } },
					wallpaperThumb: { select: { id: true } },
				},
				orderBy: { createdAt: 'desc' },
			}),
			this.references(),
		]);
		return rows.map((row) => {
			const posts = [...(current.get(row.id) ?? [])].sort();
			return {
				id: row.id,
				name: row.name,
				type: row.type,
				size: row.size,
				image: IMAGE_TYPES.includes(row.type),
				path: `/files/${row.id}`,
				createdAt: row.createdAt.toISOString(),
				createdBy: row.createdBy,
				usedBy: {
					posts,
					revisions: [...(old.get(row.id) ?? [])].filter((slug) => !posts.includes(slug)).sort(),
					wallpaper: Boolean(row.wallpaperImage || row.wallpaperThumb),
				},
			};
		});
	}

	/**
	 * 파일을 지운다. 배경화면이나 지금 글이 쓰는 파일은 지우지 않는다 (배경화면은 배경화면 설정에서 지운다).
	 * 예전 버전에서만 쓰는 파일은 지운다: 그 버전으로 되돌리면 그 자리가 빈다
	 */
	async remove(id: string): Promise<void> {
		if (!UPLOAD_ID.test(id)) throw new NotFoundException('파일이 없습니다.');
		const row = await this.prisma.upload.findUnique({
			where: { id },
			select: { id: true, wallpaperImage: { select: { id: true } }, wallpaperThumb: { select: { id: true } } },
		});
		if (!row) throw new NotFoundException('파일이 없습니다.');
		if (row.wallpaperImage || row.wallpaperThumb) throw new ConflictException('배경화면에서 쓰는 파일입니다.');
		const posts = (await this.references()).current.get(id);
		if (posts?.size) throw new ConflictException(`글에서 쓰는 파일입니다: ${[...posts].sort().join(', ')}`);
		await this.prisma.upload.delete({ where: { id } });
	}

	async find(id: string) {
		if (!UPLOAD_ID.test(id)) throw new NotFoundException('파일이 없습니다.');
		const row = await this.prisma.upload.findUnique({ where: { id } });
		if (!row) throw new NotFoundException('파일이 없습니다.');
		return { ...row, image: sniffImage(row.data) !== null };
	}
}
