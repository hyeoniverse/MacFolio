import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { cleanFileName, cleanFileType, newUploadId, sniffImage, UPLOAD_ID } from './rules.js';

/** multer가 넘겨주는 파일 (메모리에 받는다) */
export interface IncomingFile {
	originalname: string;
	mimetype: string;
	size: number;
	buffer: Buffer;
}

export interface UploadView {
	id: string;
	name: string;
	type: string;
	size: number;
	/** 브라우저가 바로 보여 줄 수 있는 이미지인지 */
	image: boolean;
	/** API 주소 기준 경로 (/files/:id) */
	path: string;
}

@Injectable()
export class FilesService {
	constructor(private readonly prisma: PrismaService) {}

	async upload(file: IncomingFile | undefined, admin: string): Promise<UploadView> {
		if (!file || file.size === 0) throw new BadRequestException('올릴 파일이 없습니다.');
		// multer는 파일 이름을 latin1로 읽는다. 한글 이름이 깨지지 않게 UTF-8로 다시 읽는다
		const name = cleanFileName(Buffer.from(file.originalname, 'latin1').toString('utf8'));
		const image = sniffImage(file.buffer);
		const row = await this.prisma.upload.create({
			data: {
				id: newUploadId(),
				name,
				type: image ?? cleanFileType(file.mimetype),
				size: file.size,
				data: new Uint8Array(file.buffer),
				createdBy: admin,
			},
			select: { id: true, name: true, type: true, size: true },
		});
		return { ...row, image: image !== null, path: `/files/${row.id}` };
	}

	async find(id: string) {
		if (!UPLOAD_ID.test(id)) throw new NotFoundException('파일이 없습니다.');
		const row = await this.prisma.upload.findUnique({ where: { id } });
		if (!row) throw new NotFoundException('파일이 없습니다.');
		return { ...row, image: sniffImage(row.data) !== null };
	}
}
