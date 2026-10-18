import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { FinderService } from './finder.service.js';

/** 메모리의 FinderLayout 표 (한 행) */
function setup() {
	let row: { data: unknown; updatedBy: string; updatedAt: Date } | null = null;
	const prisma = {
		finderLayout: {
			findUnique: vi.fn(async () => row),
			upsert: vi.fn(async ({ create }: { create: { data: unknown; updatedBy: string } }) => {
				row = { data: create.data, updatedBy: create.updatedBy, updatedAt: new Date('2026-10-19T00:00:00Z') };
				return row;
			}),
		},
	} as unknown as PrismaService;
	return { service: new FinderService(prisma), row: () => row };
}

describe('Finder 폴더 구조', () => {
	it('저장한 적 없으면 빈 구조', async () => {
		expect(await setup().service.getLayout()).toEqual({ folders: [], files: {}, aliases: null, updatedAt: null });
	});

	it('관리자가 저장하면 누구나 같은 구조를 읽는다', async () => {
		const { service, row } = setup();
		const saved = await service.saveLayout(
			{
				folders: [{ id: 'folder:abcd12', name: '발표 자료', parent: 'docs' }],
				files: { 'file:resume/a.pdf': 'folder:abcd12' },
			},
			'admin'
		);
		expect(saved.folders).toEqual([{ id: 'folder:abcd12', name: '발표 자료', parent: 'docs' }]);
		expect(saved.files).toEqual({ 'file:resume/a.pdf': 'folder:abcd12' });
		expect(saved.updatedAt).toBe('2026-10-19T00:00:00.000Z');
		expect(row()?.updatedBy).toBe('admin');
	});

	it('고리·없는 상위 폴더·블로그 아래는 400', async () => {
		const { service } = setup();
		const cycle = {
			folders: [
				{ id: 'folder:aaaa', name: '가', parent: 'folder:bbbb' },
				{ id: 'folder:bbbb', name: '나', parent: 'folder:aaaa' },
			],
		};
		await expect(service.saveLayout(cycle, 'admin')).rejects.toThrow(BadRequestException);
		await expect(
			service.saveLayout({ folders: [{ id: 'folder:aaaa', name: '가', parent: 'blog' }] }, 'admin')
		).rejects.toThrow(BadRequestException);
		await expect(service.saveLayout({ files: { 'file:a.pdf': 'folder:none' } }, 'admin')).rejects.toThrow(
			BadRequestException
		);
	});
});
