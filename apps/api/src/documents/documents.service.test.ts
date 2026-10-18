import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { AppConfig } from '../config.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { DocumentsService } from './documents.service.js';

const R2 = { accountId: 'acc', accessKeyId: 'AK', secretAccessKey: 'SK', bucket: 'macfolio-files' };

/** 메모리의 Document 표 */
function setup({ r2 = true } = {}) {
	const rows = new Map<string, Record<string, unknown>>();
	const prisma = {
		document: {
			findMany: vi.fn(async () => [...rows.values()]),
			findUnique: vi.fn(async ({ where }: { where: { id: string } }) => rows.get(where.id) ?? null),
			upsert: vi.fn(async ({ create }: { create: Record<string, unknown> }) => {
				const row = { ...create, updatedAt: new Date('2026-10-18T00:00:00Z') };
				rows.set(create.id as string, row);
				return row;
			}),
			update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
				const row = { ...rows.get(where.id)!, ...data };
				rows.set(where.id, row);
				return row;
			}),
			delete: vi.fn(async ({ where }: { where: { id: string } }) => rows.delete(where.id)),
		},
	} as unknown as PrismaService;
	const config = { documents: { r2: r2 ? R2 : undefined } } as AppConfig;
	const service = new DocumentsService(prisma, config);
	const calls: { method: string; url: string }[] = [];
	let answer = (method: string) =>
		new Response(null, { status: 200, headers: method === 'HEAD' ? { 'content-length': '1234' } : {} });
	service.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
		calls.push({ method: init?.method ?? 'GET', url: String(url) });
		return answer(init?.method ?? 'GET');
	}) as typeof fetch;
	return { service, rows, calls, answer: (fn: typeof answer) => (answer = fn) };
}

describe('문서 파일 올리기', () => {
	it('서명 주소: 폴더 영어 이름 아래 무작위 키, PUT에 크기를 서명한다', () => {
		const { service } = setup();
		const ticket = service.uploadTicket({ folder: '이력서', name: '이력서.PDF', size: 1234 });
		expect(ticket.key).toMatch(/^resume\/[\w-]{16}\.pdf$/);
		const url = new URL(ticket.url);
		expect(url.host).toBe('acc.r2.cloudflarestorage.com');
		expect(url.pathname).toBe(`/macfolio-files/${ticket.key}`);
		expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('content-length;host');
		expect(ticket.expiresIn).toBe(300);
	});

	it('R2가 설정되지 않으면 503, 맞지 않는 요청은 400', () => {
		expect(() => setup({ r2: false }).service.uploadTicket({ folder: '이력서', name: 'a.pdf', size: 1 })).toThrow(
			ServiceUnavailableException
		);
		const { service } = setup();
		expect(() => service.uploadTicket({ folder: '사진', name: 'a.pdf', size: 1 })).toThrow(BadRequestException);
		expect(() => service.uploadTicket({ folder: '이력서', name: 'a.zip', size: 1 })).toThrow(BadRequestException);
	});

	it('다 올리면 HEAD로 크기를 확인하고 목록에 더한다', async () => {
		const { service, calls } = setup();
		const { key } = service.uploadTicket({ folder: '포트폴리오', name: '작업.png', size: 1234 });
		const file = await service.create({ folder: '포트폴리오', name: '작업.png', key, size: 1234 }, 'hyeoniverse');
		expect(calls.at(-1)?.method).toBe('HEAD');
		expect(file).toMatchObject({
			folder: '포트폴리오',
			name: '작업.png',
			key,
			kind: 'image',
			size: 1234,
			updated: '2026-10-18',
		});
		expect(await service.list()).toHaveLength(1);
	});

	it('R2에 없거나, 크기가 다르거나, 다른 폴더·종류의 키면 더하지 않는다', async () => {
		const { service, answer } = setup();
		const { key } = service.uploadTicket({ folder: '이력서', name: 'a.pdf', size: 1234 });
		await expect(service.create({ folder: '자격증', name: 'a.pdf', key, size: 1234 }, 'h')).rejects.toThrow(
			BadRequestException
		);
		await expect(service.create({ folder: '이력서', name: 'a.png', key, size: 1234 }, 'h')).rejects.toThrow(
			BadRequestException
		);
		await expect(
			service.create({ folder: '이력서', name: 'a.pdf', key: '../etc/passwd.pdf', size: 1234 }, 'h')
		).rejects.toThrow(BadRequestException);
		await expect(service.create({ folder: '이력서', name: 'a.pdf', key, size: 99 }, 'h')).rejects.toThrow('크기');
		answer(() => new Response(null, { status: 404 }));
		await expect(service.create({ folder: '이력서', name: 'a.pdf', key, size: 1234 }, 'h')).rejects.toThrow('올라가지');
	});

	it('이름 바꾸기는 확장자를 지켜야 하고, 지우면 R2에서도 지운다', async () => {
		const { service, calls, answer, rows } = setup();
		const { key } = service.uploadTicket({ folder: '이력서', name: 'a.pdf', size: 1234 });
		const file = await service.create({ folder: '이력서', name: 'a.pdf', key, size: 1234 }, 'h');
		await expect(service.rename(file.id, { name: '새 이력서.pdf' })).resolves.toMatchObject({ name: '새 이력서.pdf' });
		await expect(service.rename(file.id, { name: '새 이력서.png' })).rejects.toThrow('확장자');
		await expect(service.rename('없는-아이디-이다-1234', { name: 'b.pdf' })).rejects.toThrow(NotFoundException);

		answer(() => new Response(null, { status: 500 }));
		await expect(service.remove(file.id)).rejects.toThrow(ServiceUnavailableException);
		expect(rows.size).toBe(1);
		answer(() => new Response(null, { status: 204 }));
		await service.remove(file.id);
		expect(calls.at(-1)?.method).toBe('DELETE');
		expect(rows.size).toBe(0);
	});

	it('프로젝트 폴더: projects/<프로젝트 id>/ 아래 키, 다른 프로젝트·문서 폴더의 키는 받지 않는다', async () => {
		const { service } = setup();
		const { key } = service.uploadTicket({ folder: 'project:macfolio', name: '발표.pdf', size: 1234 });
		expect(key).toMatch(/^projects\/macfolio\/[\w-]{16}\.pdf$/);
		await expect(service.create({ folder: 'project:other', name: '발표.pdf', key, size: 1234 }, 'h')).rejects.toThrow(
			BadRequestException
		);
		await expect(service.create({ folder: '이력서', name: '발표.pdf', key, size: 1234 }, 'h')).rejects.toThrow(
			BadRequestException
		);
		await expect(
			service.create(
				{ folder: 'project:macfolio', name: 'a.pdf', key: 'projects/macfolio/x/aaaaaaaaaaaaaaaa.pdf', size: 1234 },
				'h'
			)
		).rejects.toThrow(BadRequestException);
		expect(() => service.uploadTicket({ folder: 'project:../x', name: 'a.pdf', size: 1 })).toThrow(BadRequestException);
		const file = await service.create({ folder: 'project:macfolio', name: '발표.pdf', key, size: 1234 }, 'h');
		expect(file).toMatchObject({ folder: 'project:macfolio', kind: 'pdf', key });
	});

	it('목록: 이력서·포트폴리오·자격증 다음 프로젝트 폴더를 id 순으로, 그 안은 올린 순서', async () => {
		const { service } = setup();
		const add = async (folder: string, name: string) => {
			const { key } = service.uploadTicket({ folder, name, size: 1234 });
			await service.create({ folder, name, key, size: 1234 }, 'h');
		};
		await add('project:zeta', 'z.pdf');
		await add('project:alpha', 'a1.pdf');
		await add('자격증', 'c.pdf');
		await add('project:alpha', 'a2.pdf');
		await add('이력서', 'r.pdf');
		expect((await service.list()).map((file) => file.name)).toEqual(['r.pdf', 'c.pdf', 'a1.pdf', 'a2.pdf', 'z.pdf']);
	});
});
