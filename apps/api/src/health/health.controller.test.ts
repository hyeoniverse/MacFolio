import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { HealthController } from './health.controller.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const controllerWith = (queryRaw: () => Promise<unknown>) =>
	new HealthController({ $queryRaw: vi.fn(queryRaw) } as unknown as PrismaService);

describe('HealthController', () => {
	it('DB에 쿼리가 되면 ok', async () => {
		await expect(controllerWith(async () => [{ '?column?': 1 }]).check()).resolves.toEqual({
			status: 'ok',
			database: 'up',
		});
	});

	it('DB에 연결할 수 없으면 503', async () => {
		const check = controllerWith(async () => {
			throw new Error('connection refused');
		}).check();
		await expect(check).rejects.toBeInstanceOf(ServiceUnavailableException);
	});
});
