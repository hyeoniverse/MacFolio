import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { IncomingFile } from '../files/files.service.js';
import { stripImageMetadata } from '../files/metadata.js';
import { cleanFileName, newUploadId, sniffImage, UPLOAD_ID } from '../files/rules.js';
import { cleanWallpaperName } from './rules.js';

export interface WallpaperView {
	id: string;
	name: string;
	/** API 주소 기준 경로 (/files/:id) */
	image: string;
	thumbnail: string;
	createdAt: string;
}

export interface WallpaperInput {
	name?: unknown;
	image?: IncomingFile;
	thumbnail?: IncomingFile;
}

type Row = { id: string; name: string; imageId: string; thumbId: string; createdAt: Date };

const view = (row: Row): WallpaperView => ({
	id: row.id,
	name: row.name,
	image: `/files/${row.imageId}`,
	thumbnail: `/files/${row.thumbId}`,
	createdAt: row.createdAt.toISOString(),
});

@Injectable()
export class WallpapersService {
	constructor(private readonly prisma: PrismaService) {}

	/** 올린 순서대로 (기본 배경화면 뒤에 이어 붙는다) */
	async list(): Promise<WallpaperView[]> {
		const rows = await this.prisma.wallpaper.findMany({ orderBy: { createdAt: 'asc' } });
		return rows.map(view);
	}

	async create(input: WallpaperInput, admin: string): Promise<WallpaperView> {
		const { image, thumbnail } = input;
		if (!image || !thumbnail) throw new BadRequestException('배경화면과 썸네일 이미지가 모두 필요합니다.');
		const imageType = sniffImage(image.buffer);
		const thumbType = sniffImage(thumbnail.buffer);
		if (!imageType || !thumbType) throw new BadRequestException('PNG·JPEG·GIF·WebP 이미지만 올릴 수 있습니다.');
		const fileName = cleanFileName(Buffer.from(image.originalname, 'latin1').toString('utf8'));
		const name = cleanWallpaperName(input.name) ?? cleanWallpaperName(fileName) ?? '배경화면';

		const imageId = newUploadId();
		const thumbId = newUploadId();
		const upload = (id: string, file: IncomingFile, type: string, fileNameForDownload: string) => {
			// 브라우저에서 줄인 그림이라 보통 메타데이터가 없지만, 원본을 그대로 올려도 EXIF는 남기지 않는다
			const data = new Uint8Array(stripImageMetadata(file.buffer, type));
			return this.prisma.upload.create({
				data: { id, name: fileNameForDownload, type, size: data.byteLength, data, createdBy: admin },
			});
		};
		const [, , row] = await this.prisma.$transaction([
			upload(imageId, image, imageType, fileName),
			upload(thumbId, thumbnail, thumbType, `thumb-${fileName}`),
			this.prisma.wallpaper.create({
				data: { id: newUploadId(), name, imageId, thumbId, createdBy: admin },
			}),
		]);
		return view(row);
	}

	/** 이름을 바꾼다 (다듬은 이름이 비면 400) */
	async rename(id: string, name: unknown): Promise<WallpaperView> {
		if (!UPLOAD_ID.test(id)) throw new NotFoundException('배경화면이 없습니다.');
		const cleaned = cleanWallpaperName(name);
		if (!cleaned) throw new BadRequestException('이름을 입력해 주세요.');
		const found = await this.prisma.wallpaper.findUnique({ where: { id }, select: { id: true } });
		if (!found) throw new NotFoundException('배경화면이 없습니다.');
		return view(await this.prisma.wallpaper.update({ where: { id }, data: { name: cleaned } }));
	}

	/** 배경화면과 그 이미지 두 장을 함께 지운다 */
	async remove(id: string): Promise<void> {
		if (!UPLOAD_ID.test(id)) throw new NotFoundException('배경화면이 없습니다.');
		const row = await this.prisma.wallpaper.findUnique({ where: { id } });
		if (!row) throw new NotFoundException('배경화면이 없습니다.');
		await this.prisma.$transaction([
			this.prisma.wallpaper.delete({ where: { id } }),
			this.prisma.upload.deleteMany({ where: { id: { in: [row.imageId, row.thumbId] } } }),
		]);
	}
}
