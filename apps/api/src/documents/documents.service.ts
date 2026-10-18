import {
	BadRequestException,
	Inject,
	Injectable,
	NotFoundException,
	ServiceUnavailableException,
} from '@nestjs/common';
import {
	DOCUMENT_EXTENSIONS,
	DOCUMENT_FOLDER_KEYS,
	DOCUMENT_FOLDERS,
	DocumentCreate,
	documentExtension,
	type DocumentFile,
	type DocumentFolder,
	DocumentRename,
	DocumentUploadRequest,
	type DocumentUploadTicket,
	parse,
} from '@macfolio/contracts';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { newUploadId, UPLOAD_ID } from '../files/rules.js';
import { r2Url, type R2Credentials } from './r2.js';

/** 올리기 서명 주소의 유효 시간 (초) */
export const UPLOAD_TTL = 300;
/** 서버가 R2에 묻는(HEAD·DELETE) 서명 주소의 유효 시간 (초) */
const CHECK_TTL = 60;

/** 이 서버가 만든 키 모양: <폴더 영어 이름>/<무작위 16자>.<확장자> */
const KEY = /^(resume|portfolio|certificates)\/[\w-]{16}\.(pdf|png|jpg|jpeg|webp)$/;

type Row = {
	id: string;
	folder: string;
	name: string;
	key: string;
	kind: string;
	size: number;
	updatedAt: Date;
};

const view = (row: Row): DocumentFile => ({
	id: row.id,
	folder: row.folder as DocumentFolder,
	name: row.name,
	key: row.key,
	kind: row.kind as DocumentFile['kind'],
	size: row.size,
	updated: row.updatedAt.toISOString().slice(0, 10),
});

const valid = <T>(parsed: { value: T } | { errors: string[] }): T => {
	if ('errors' in parsed) throw new BadRequestException(parsed.errors);
	return parsed.value;
};

/**
 * Finder의 문서 파일 목록과 올리기. 파일은 R2에 있고, 브라우저가 서명 주소로 R2에 바로 올린다 (이 서버를 거치지 않는다).
 * 1. uploadTicket: 관리자·폴더·종류·크기를 확인하고 PUT 서명 주소를 준다 (Content-Length를 서명에 넣어 말한 크기만 받는다)
 * 2. create: R2에 정말 올라갔는지 HEAD로 확인하고 목록에 더한다
 */
@Injectable()
export class DocumentsService {
	/** R2에 묻는 fetch (시험에서 바꾼다) */
	fetch: typeof fetch = (...args) => fetch(...args);

	constructor(
		private readonly prisma: PrismaService,
		@Inject(APP_CONFIG) private readonly config: AppConfig
	) {}

	private get r2(): R2Credentials {
		const r2 = this.config.documents.r2;
		if (!r2) throw new ServiceUnavailableException('서버에 파일 저장소(R2)가 설정되지 않았습니다.');
		return r2;
	}

	/** 폴더 순서, 그 안에서 올린 순서 */
	async list(): Promise<DocumentFile[]> {
		const rows = await this.prisma.document.findMany({ orderBy: { createdAt: 'asc' } });
		return rows.map(view).sort((a, b) => DOCUMENT_FOLDERS.indexOf(a.folder) - DOCUMENT_FOLDERS.indexOf(b.folder));
	}

	uploadTicket(input: unknown): DocumentUploadTicket {
		const { folder, name, size } = valid(parse(DocumentUploadRequest, input));
		const r2 = this.r2;
		const key = `${DOCUMENT_FOLDER_KEYS[folder]}/${newUploadId()}.${documentExtension(name)}`;
		const url = r2Url(r2, 'PUT', key, UPLOAD_TTL, { 'content-length': String(size) });
		return { key, url, expiresIn: UPLOAD_TTL };
	}

	async create(input: unknown, admin: string): Promise<DocumentFile> {
		const { folder, name, key, size } = valid(parse(DocumentCreate, input));
		const ext = documentExtension(name)!;
		if (!KEY.test(key) || !key.startsWith(`${DOCUMENT_FOLDER_KEYS[folder]}/`) || !key.endsWith(`.${ext}`)) {
			throw new BadRequestException('올린 파일의 키가 맞지 않습니다.');
		}
		const head = await this.fetch(r2Url(this.r2, 'HEAD', key, CHECK_TTL), { method: 'HEAD' });
		if (!head.ok) throw new BadRequestException('파일이 저장소에 올라가지 않았습니다. 다시 올려 주세요.');
		if (Number(head.headers.get('content-length')) !== size) {
			throw new BadRequestException('올린 파일의 크기가 맞지 않습니다.');
		}
		const row = await this.prisma.document.upsert({
			where: { key },
			create: { id: newUploadId(), folder, name, key, kind: DOCUMENT_EXTENSIONS[ext], size, createdBy: admin },
			update: { name, size },
		});
		return view(row);
	}

	/** 이름만 바꾼다. 확장자(종류)는 그대로여야 한다 (R2의 파일은 그대로라서) */
	async rename(id: string, input: unknown): Promise<DocumentFile> {
		const { name } = valid(parse(DocumentRename, input));
		const row = await this.find(id);
		if (documentExtension(name) !== row.key.split('.').pop()) {
			throw new BadRequestException(`확장자는 바꿀 수 없습니다 (.${row.key.split('.').pop()}).`);
		}
		return view(await this.prisma.document.update({ where: { id }, data: { name } }));
	}

	/** R2의 파일을 지우고 목록에서 뺀다. R2에 이미 없으면(404) 목록만 뺀다 */
	async remove(id: string): Promise<void> {
		const row = await this.find(id);
		const response = await this.fetch(r2Url(this.r2, 'DELETE', row.key, CHECK_TTL), { method: 'DELETE' });
		if (!response.ok && response.status !== 404) {
			throw new ServiceUnavailableException('저장소에서 파일을 지우지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
		}
		await this.prisma.document.delete({ where: { id } });
	}

	private async find(id: string) {
		const row = UPLOAD_ID.test(id) ? await this.prisma.document.findUnique({ where: { id } }) : null;
		if (!row) throw new NotFoundException('파일이 없습니다.');
		return row;
	}
}
