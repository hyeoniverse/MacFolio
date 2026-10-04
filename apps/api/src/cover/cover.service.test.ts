import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config.js';
import { ProviderFailure } from '../common/demo.js';
import type { CoverClient } from './cover.client.js';
import type { CoverProvider } from './rules.js';
import { CoverService } from './cover.service.js';

/** 공급자마다 성공(true)할지 실패할지 정한 가짜. 부른 차례와 받은 프롬프트를 남긴다 */
const fakeClient = (ok: Partial<Record<CoverProvider, boolean>>) => {
	const called: string[] = [];
	const prompts: string[] = [];
	const client = {
		generate: async (provider: CoverProvider, _keys: unknown, prompt: string) => {
			called.push(provider);
			prompts.push(prompt);
			if (!ok[provider]) throw new ProviderFailure('시간이 너무 걸립니다');
			return { bytes: Buffer.from(`img-${provider}`), mime: 'image/png' };
		},
	} as unknown as CoverClient;
	return { client, called, prompts };
};

const config = loadConfig({ DATABASE_URL: 'postgresql://u:p@localhost:5432/db' });

describe('AI 커버', () => {
	it('Hugging Face로 그리고, 그림은 base64와 종류로 돌려준다', async () => {
		const { client, called, prompts } = fakeClient({ huggingface: true });
		const result = await new CoverService(config, client).generate({ title: '바다', style: 'vintage' }, '1.1.1.1');
		expect(called).toEqual(['huggingface']);
		expect(prompts[0]).toContain('Blog cover image: 바다. Style: vintage');
		expect(result.provider).toBe('huggingface');
		expect(Buffer.from(result.image, 'base64').toString()).toBe('img-huggingface');
		expect(result.mime).toBe('image/png');
		expect(result.remaining).toBe(0);
		expect(result.attempts).toEqual([{ provider: 'huggingface', state: 'ok' }]);
	});

	it('기본은 IP마다 하루 1번, 사이트 전체 5번이고, 그리지 못하면 502로 횟수를 돌려준다', async () => {
		const service = new CoverService(config, fakeClient({ huggingface: true }).client);
		expect(service.status('2.2.2.2')).toEqual({ remaining: 1, perIp: 1, total: 5 });
		await service.generate({ title: '바다' }, '2.2.2.2');
		await expect(service.generate({ title: '바다' }, '2.2.2.2')).rejects.toMatchObject({ status: 429 });
		for (let i = 0; i < 4; i += 1) await service.generate({ title: '바다' }, `9.9.9.${i}`);
		await expect(service.generate({ title: '바다' }, '4.4.4.4')).rejects.toMatchObject({ status: 429 });

		const failing = new CoverService(config, fakeClient({}).client);
		await expect(failing.generate({ title: '바다' }, '3.3.3.3')).rejects.toMatchObject({ status: 502 });
		expect(failing.status('3.3.3.3').remaining).toBe(1);
		await expect(failing.generate({ title: '' }, '3.3.3.3')).rejects.toBeInstanceOf(BadRequestException);
	});
});
